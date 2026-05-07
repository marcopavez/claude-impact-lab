// Tipos compartidos entre los endpoints mock del ContactsManager
// (/api/mocks/threat-feeds/sync y /api/mocks/institutional-registry/sync) y el
// componente client que los consume.

export type WhitelistPolicy =
  | "always_pass"
  | "pass_after_verification"
  | "take_message_only";

export type WhitelistContact = {
  caller_id_e164: string;
  display_name: string;
  relationship: string;
  policy: WhitelistPolicy;
  shared_word_required: boolean;
  cross_channel_phone_e164: string | null;
};

export type BlacklistContact = {
  caller_id_e164: string;
  display_name: string;
  source: string;
  source_url: string;
  reason: string;
  reported_at: string;
};

export type InstitutionalCategory =
  | "banco"
  | "afp"
  | "isapre"
  | "organismo_publico"
  | "salud_publica";

export type InstitutionalContact = {
  caller_id_e164: string;
  display_name: string;
  category: InstitutionalCategory;
  source: string;
  source_url: string;
  verified_at: string;
};

export type ScanSourceSummary = {
  name: string;
  entries_found: number;
};

export type ThreatFeedSyncResponse = {
  ok: true;
  scanned_sources: ScanSourceSummary[];
  blacklist_new_entries: BlacklistContact[];
  scanned_at: string;
  note_es: string;
};

export type InstitutionalRegistrySyncResponse = {
  ok: true;
  scanned_sources: ScanSourceSummary[];
  institutional_new_entries: InstitutionalContact[];
  scanned_at: string;
  note_es: string;
};

export type ContactsImportPhonebookResponse = {
  ok: true;
  imported_entries: WhitelistContact[];
  scanned_at: string;
  note_es: string;
};
