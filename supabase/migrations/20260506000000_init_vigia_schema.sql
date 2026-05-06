-- Vigía — schema inicial MVP audio-first (N19, 2026-05-06).
-- Fuente canónica de tipos: docs/SEGURIDAD.md §6, §9, §7.
-- Decisiones:
--   * caregiver_id = auth.users.id (UUID nativo Supabase Auth magic link).
--   * protected_id = UUID propio (un cuidador puede tener N protegidos en V2; MVP 1:1).
--   * audio_uploads.storage_path apunta al bucket Supabase Storage; signed URLs se
--     emiten on-demand con TTL 24h (no persistimos URLs firmadas).
--   * shared_words.word_hash y kba_questions.expected_answers_hash[] guardan argon2id
--     calculado server-side en la app (PG no tiene argon2 nativo).
--   * pgvector dimensión 1024 = Voyage voyage-3.
--   * RLS: deny-by-default; cada tabla tiene policy "owner = auth.uid()".

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============================================================
-- Enums
-- ============================================================
create type whitelist_policy as enum (
  'take_message_only',
  'pass_after_verification',
  'always_pass'
);

create type whitelist_relation as enum (
  'hijo', 'hija', 'nieto', 'nieta',
  'doctor', 'banco_oficial',
  'vecino', 'amigo', 'otro'
);

create type kba_difficulty as enum ('low', 'medium', 'high');
create type kba_category   as enum ('family', 'biographical', 'preference', 'anecdote');

-- Verdict del Vishing Analyst sobre el audio.
create type audio_verdict as enum ('fraud', 'suspicious', 'legit');

-- Severidad del push al cuidador (decisión por nivel — N19).
create type push_severity as enum ('HIGH', 'MEDIUM', 'LOW');

-- Estado del procesamiento async del audio.
create type audio_status as enum (
  'uploaded',
  'transcribing',
  'analyzing',
  'completed',
  'failed'
);

-- ============================================================
-- protected_persons — adulto mayor protegido por Vigía.
-- ============================================================
create table protected_persons (
  protected_id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  first_name   text not null check (length(first_name) between 1 and 80),
  notes        text,
  created_at   timestamptz not null default now()
);
create index protected_persons_caregiver_idx on protected_persons(caregiver_id);

-- ============================================================
-- whitelists — contactos pre-aprobados (docs/SEGURIDAD.md §9.1)
-- ============================================================
create table whitelists (
  whitelist_id              uuid primary key default gen_random_uuid(),
  caregiver_id              uuid not null references auth.users(id) on delete cascade,
  protected_id              uuid not null references protected_persons(protected_id) on delete cascade,
  phone_e164                text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  display_name              text not null check (length(display_name) between 1 and 80),
  relation                  whitelist_relation not null,
  policy                    whitelist_policy not null default 'take_message_only',
  shared_word_required      boolean not null default true,
  cross_channel_required    boolean not null default true,
  cross_channel_phone_e164  text check (cross_channel_phone_e164 is null or cross_channel_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  notes                     text,
  created_at                timestamptz not null default now(),
  rotated_at                timestamptz,
  unique (protected_id, phone_e164)
);
create index whitelists_caregiver_idx on whitelists(caregiver_id);
create index whitelists_protected_phone_idx on whitelists(protected_id, phone_e164);

-- ============================================================
-- shared_words — palabras clave familiares (docs/SEGURIDAD.md §9.2)
-- ============================================================
create table shared_words (
  shared_word_id     uuid primary key default gen_random_uuid(),
  caregiver_id       uuid not null references auth.users(id) on delete cascade,
  protected_id       uuid not null references protected_persons(protected_id) on delete cascade,
  word_hash          text not null,                -- argon2id, server-side
  hint_for_caregiver text,
  created_at         timestamptz not null default now(),
  rotated_at         timestamptz,
  active             boolean not null default true
);
create index shared_words_protected_active_idx
  on shared_words(protected_id) where active;

-- ============================================================
-- kba_questions — preguntas KBA (docs/SEGURIDAD.md §9.3)
-- ============================================================
create table kba_questions (
  kba_id                 uuid primary key default gen_random_uuid(),
  caregiver_id           uuid not null references auth.users(id) on delete cascade,
  protected_id           uuid not null references protected_persons(protected_id) on delete cascade,
  question_es            text not null check (length(question_es) between 5 and 280),
  expected_answers_hash  text[] not null check (array_length(expected_answers_hash, 1) >= 1),
  difficulty             kba_difficulty not null default 'medium',
  category               kba_category not null,
  created_at             timestamptz not null default now(),
  used_count             integer not null default 0
);
create index kba_questions_protected_idx on kba_questions(protected_id);

-- ============================================================
-- audio_uploads — el corazón del MVP audio-first (N19)
-- ============================================================
create table audio_uploads (
  audio_id          uuid primary key default gen_random_uuid(),
  caregiver_id      uuid not null references auth.users(id) on delete cascade,
  protected_id      uuid references protected_persons(protected_id) on delete set null,
  storage_path      text not null,                -- bucket/path; signed URL se emite on-demand
  storage_bucket    text not null default 'audio-uploads',
  duration_seconds  numeric(6,2) check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 600)),
  mime_type         text not null check (mime_type in ('audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/x-wav', 'audio/webm')),
  caller_id_e164    text check (caller_id_e164 is null or caller_id_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  consent_checked   boolean not null default false,  -- N10 reformulada: checkbox al subir
  status            audio_status not null default 'uploaded',
  -- Resultado de la cascada (poblado al cerrar el pipeline)
  transcript        text,                         -- redactado de PII antes de persistir
  verdict           audio_verdict,
  push_severity     push_severity,
  rationale         text,
  citations_count   integer not null default 0,
  models_used       text[] not null default '{}', -- ['claude-sonnet-4-6', 'claude-opus-4-7', ...]
  tools_used        text[] not null default '{}',
  latency_ms        integer,
  uploaded_at       timestamptz not null default now(),
  processed_at      timestamptz,
  expires_at        timestamptz not null default now() + interval '24 hours',
  constraint consent_required check (consent_checked = true)
);
create index audio_uploads_caregiver_idx on audio_uploads(caregiver_id, uploaded_at desc);
create index audio_uploads_expires_idx   on audio_uploads(expires_at) where status != 'failed';

-- ============================================================
-- audio_citations — citation trail por audio (auditable A6)
-- ============================================================
create table audio_citations (
  citation_id   uuid primary key default gen_random_uuid(),
  audio_id      uuid not null references audio_uploads(audio_id) on delete cascade,
  source_id     text not null,                    -- enum lógico: wiki_legal_fintech, bcn_leyfacil, ...
  source_url    text not null check (source_url ~ '^https://'),
  quote         text not null check (length(quote) >= 20),
  validated     boolean not null default false,   -- post-validador (substring + Levenshtein 0.95)
  match_ratio   numeric(4,3),                     -- mejor ratio si Levenshtein
  created_at    timestamptz not null default now()
);
create index audio_citations_audio_idx on audio_citations(audio_id);

-- ============================================================
-- source_cache — fetch cache para citation validator (§7)
-- ============================================================
create table source_cache (
  url           text primary key,
  etag          text,
  content_text  text not null,
  content_hash  text not null,                    -- sha256 hex
  fetched_at    timestamptz not null default now()
);
create index source_cache_fetched_idx on source_cache(fetched_at);

-- ============================================================
-- wiki_legal_chunks — RAG embeddings (Voyage voyage-3 = 1024 dim)
-- ============================================================
create table wiki_legal_chunks (
  chunk_id    uuid primary key default gen_random_uuid(),
  source_id   text not null,
  source_url  text not null,
  title       text,
  chunk_text  text not null,
  chunk_index integer not null,
  embedding   vector(1024) not null,
  created_at  timestamptz not null default now(),
  unique (source_url, chunk_index)
);
-- IVFFlat con cosine; lists tuneable post-ingest (≈ sqrt(N)).
create index wiki_legal_chunks_embedding_idx
  on wiki_legal_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index wiki_legal_chunks_source_idx on wiki_legal_chunks(source_id);

-- ============================================================
-- push_subscriptions — Web Push API VAPID (N17)
-- ============================================================
create table push_subscriptions (
  subscription_id  uuid primary key default gen_random_uuid(),
  caregiver_id     uuid not null references auth.users(id) on delete cascade,
  endpoint         text not null,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  unique (caregiver_id, endpoint)
);
create index push_subscriptions_caregiver_idx on push_subscriptions(caregiver_id);

-- ============================================================
-- RLS — deny-by-default + owner = auth.uid()
-- ============================================================
alter table protected_persons   enable row level security;
alter table whitelists          enable row level security;
alter table shared_words        enable row level security;
alter table kba_questions       enable row level security;
alter table audio_uploads       enable row level security;
alter table audio_citations     enable row level security;
alter table push_subscriptions  enable row level security;
-- source_cache y wiki_legal_chunks son globales (read-only para usuarios; escritura via service role).
alter table source_cache        enable row level security;
alter table wiki_legal_chunks   enable row level security;

-- caregiver_id = auth.uid()
create policy protected_persons_owner   on protected_persons   for all using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());
create policy whitelists_owner          on whitelists          for all using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());
create policy shared_words_owner        on shared_words        for all using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());
create policy kba_questions_owner       on kba_questions       for all using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());
create policy audio_uploads_owner       on audio_uploads       for all using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());
create policy push_subscriptions_owner  on push_subscriptions  for all using (caregiver_id = auth.uid()) with check (caregiver_id = auth.uid());

-- audio_citations heredan del audio padre.
create policy audio_citations_owner on audio_citations
  for all using (
    exists (
      select 1 from audio_uploads a
      where a.audio_id = audio_citations.audio_id
        and a.caregiver_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from audio_uploads a
      where a.audio_id = audio_citations.audio_id
        and a.caregiver_id = auth.uid()
    )
  );

-- source_cache + wiki_legal_chunks: lectura pública para usuarios autenticados;
-- escritura solo via service role (que bypassea RLS).
create policy source_cache_read       on source_cache       for select using (auth.role() = 'authenticated');
create policy wiki_legal_chunks_read  on wiki_legal_chunks  for select using (auth.role() = 'authenticated');
