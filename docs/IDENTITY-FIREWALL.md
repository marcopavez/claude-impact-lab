# IDENTITY-FIREWALL.md — Vigía

**Estado:** v0.1 (planning).
**Función:** protocolo de autenticación del llamante. Cierra el agujero estructural de "el llamante puede decir cualquier cosa con costo cero". Sin esto, Vigía es un transcriptor con sesgo helpful — un Sonnet escuchando *"soy la nieta de María"* tiende a transferir.

## Premisa

**Vigía es deny-by-default.** El llamante no toca a María hasta ganarse el derecho. La transferencia es excepción que se gana, no default. La política operativa por defecto es **B (secretaria)**: Vigía toma el mensaje, lo resume al cuidador, y el cuidador decide. La política A (filtro permisivo, transferencia tras verificación) es opt-in granular **por contacto**, no global.

Esto se ajusta al modelo de uso real del segmento: las víctimas adultas mayores reciben mayoritariamente llamadas transaccionales o fraudulentas, no conversacionales. Una nieta llamando solo para conversar es la excepción, no la norma.

---

## 1. Pre-configuración del cuidador (5 minutos, una vez)

El **cuidador familiar** (no la abuela) configura desde la PWA antes de activar el desvío. Cuatro componentes:

### 1.1 Whitelist de números

```typescript
type WhitelistEntry = {
  whitelist_id: string;            // ULID
  caregiver_id: string;            // FK al cuidador
  protected_id: string;            // FK a la persona protegida (María)
  phone_e164: string;              // +56XXXXXXXXX, normalizado
  display_name: string;            // "Sofía (nieta)" — aparece en alertas
  relation: 
    | "hijo" | "hija" | "nieto" | "nieta" 
    | "doctor" | "banco_oficial" 
    | "vecino" | "amigo" | "otro";
  policy: "take_message_only" | "pass_after_verification" | "always_pass";
  shared_word_required: boolean;   // por defecto true salvo always_pass
  cross_channel_required: boolean; // por defecto true para family
  cross_channel_phone_e164?: string; // teléfono de WhatsApp del propio whitelisted
                                     // (para confirmar "¿estás llamando a tu abuela?")
  notes?: string;
  created_at: string;
  rotated_at?: string;
};
```

**Reglas de policy:**
- `take_message_only` (default): Vigía toma mensaje, no transfiere. Equivale a Política B pura.
- `pass_after_verification`: Vigía transfiere si pasa shared word + cross-channel ack. Política A condicional.
- `always_pass`: Vigía transfiere tras shared word, sin cross-channel. Reservado para 2-3 contactos críticos (médico, hijo titular emergencia). El cuidador debe activar este flag con confirmación explícita en UI con warning.

**Caller-ID es necesario pero NO suficiente.** V22 del threat model: el caller_id chileno es trivialmente spoofeable. Ningún `policy` ≠ `take_message_only` se aplica solo con caller_id matching.

### 1.2 Shared word familiar

```typescript
type SharedWord = {
  shared_word_id: string;
  caregiver_id: string;
  protected_id: string;
  word_hash: string;               // bcrypt o argon2id; nunca plain
  hint_for_caregiver?: string;     // ayuda-memoria solo para el cuidador, opcional
  created_at: string;
  rotated_at?: string;             // rotación recomendada cada 90d
  active: boolean;
};
```

- 1–3 palabras clave activas simultáneamente. La familia las conoce.
- Idealmente algo no derivable de redes sociales: chiste interno, apodo de un familiar fallecido, frase del abuelo.
- Almacenadas con hash. La verificación es comparación de hash: el llamante dice la palabra → Vigía la transcribe (Deepgram), normaliza (lowercase, NFKC, strip diacritics), hashea, compara.
- **Rotación**: el cuidador puede rotar manualmente. Si una llamada usa la shared word pero falla otras checks (KBA o cross-channel), el sistema marca "shared word potentially leaked" y sugiere al cuidador rotarla.

### 1.3 Preguntas KBA (Knowledge-Based Authentication)

```typescript
type KBAQuestion = {
  kba_id: string;
  caregiver_id: string;
  protected_id: string;
  question_es: string;             // ej. "¿qué postre María hace siempre a sus nietos?"
  expected_answers_hash: string[]; // hashes de respuestas aceptables (sinónimos)
  difficulty: "low" | "medium" | "high";
  category: "family" | "biographical" | "preference" | "anecdote";
  created_at: string;
  used_count: number;              // velocity check; si una KBA se usa mucho, rotar
};
```

- 3–5 preguntas redactadas por el cuidador. Verificación: respuesta del llamante → normalizada → comparada con `expected_answers_hash` (lista para soportar sinónimos: "Coquimbo" / "La Serena" si la pregunta es ambigua).
- **Buenas KBA:** intímas, no publicables. *"¿Cómo le dice María a tu abuela cuando está molesta?"*, *"¿Qué guarda María en el cajón de la mesita de noche?"*, *"¿Cuál fue la primera mascota de la familia?"*.
- **Malas KBA (rechazar en UI):** *"¿Cuál es el segundo nombre de María?"*, *"¿En qué comuna vive?"* — derivables de redes o documentos.
- Vigía elige una al azar de las activas; rotación de orden por sesión.

### 1.4 Canal cross-channel

- WhatsApp Business API conectado al teléfono del **cuidador**.
- Opcionalmente, cada whitelisted entry registra su propio número WhatsApp para verificación dirigida al supuesto familiar.

---

## 2. Protocolo en cuatro niveles

### Nivel 1 — Caller ID lookup + intent rápido

Cuando entra la llamada por Twilio Media Streams:

```
caller_id = normalize_e164(twilio_from_header)

entry = whitelist.findByPhone(caller_id)

if entry == null:
    suspicion_floor = HIGH
    policy = "take_message_only"  // forzado
    reason = "caller_id no reconocido"
elif entry.policy == "always_pass":
    suspicion_floor = LOW
    policy = "always_pass"
    reason = f"contacto crítico ({entry.relation})"
elif entry.policy == "pass_after_verification":
    suspicion_floor = MEDIUM
    policy = "pass_after_verification"
elif entry.policy == "take_message_only":
    suspicion_floor = LOW
    policy = "take_message_only"
```

En paralelo, Sonnet 4.6 (Call Triage) clasifica intent del llamante leyendo el primer transcript stream chunk:

```
intent ∈ {
  claim_family,
  claim_bank,
  claim_authority,    // Carabineros, SII, PDI, Tribunal
  claim_service,      // ISP, courier, utility, AFP
  unclear,
  obvious_scam_pattern  // urgencia + transferencia + sin contexto
}
```

Si `intent == obvious_scam_pattern` → hangup inmediato + cita Sernac/Carabineros + push alert al cuidador. **Sin verificación adicional.**

### Nivel 2 — Verificación según claim

Cada claim tiene un protocolo dedicado.

#### 2.1 `claim_family`

Vigía dice (TTS Twilio Polly Lupe-Neural):

> *"Hola, soy Vigía, el filtro contra estafas de [Nombre]. Esta llamada está siendo analizada para protegerla. Antes de pasar contigo, voy a verificar tu identidad. ¿Cuál es la palabra clave familiar?"*

Tres outcomes:

| Respuesta | Acción |
|---|---|
| Shared word **correcta** (hash match) | Continúa a Nivel 3 con flag `shared_word_ok=true`. |
| Shared word **incorrecta** | Vigía hace 1 pregunta KBA al azar. Si respuesta correcta → continúa con `kba_ok=true, shared_word_ok=false` (marca para sugerir rotación). Si KBA incorrecta → Nivel 4 hangup + alert. |
| **Evade** ("no me la sé / es urgente / pásame con la abuela") | Bandera roja absoluta. Hangup + alert + cita CMF/Sernac sobre fraude por suplantación social. |

**En paralelo (no bloqueante)**, Vigía dispara cross-channel WhatsApp:
- Si `entry.cross_channel_phone_e164` está configurado → WhatsApp al supuesto familiar: *"¿Estás llamando a tu abuela María ahora? Responde sí o no."*. Timeout 30s.
- Si timeout o `no` → cross-channel falla. Combinado con shared word/KBA define decisión final.
- Si `sí` → cross-channel ok.

#### 2.2 `claim_bank`

Vigía dice:
> *"Esta llamada está siendo analizada por Vigía. ¿Cuál es la razón social y RUT de la empresa?"*

Llama a `mcp-cmf.lookup_entity(razon_social | rut)`:
- **No registrada en CMF Prestadores Fintec / Bancos** → hangup + cita CMF + push alert.
- **Registrada pero pide datos / clave / transferencia** → bandera. Los bancos chilenos NO solicitan estos datos en llamadas salientes. Hangup + cita SBIF + push alert. *"Si necesita confirmar algo, llame al número del reverso de su tarjeta."*
- **Registrada y solo informa** (ej. notificación de dispositivo nuevo) → toma mensaje, no transfiere, push al cuidador con resumen + número oficial del banco verificado.

#### 2.3 `claim_authority`

**Regla dura — sin excepciones:** Carabineros, PDI, SII, Tribunales, AFP **no llaman pidiendo dinero, datos sensibles ni transferencias**. Es el cuento del tío canónico.

- Si el llamante pide cualquiera de los anteriores → hangup automático + TTS:
  > *"La institución que dice representar no realiza estas gestiones por teléfono. Para verificar, llame directamente al [número oficial]."*
  + cita Sernac/PDI Cibercrimen + push alert.

- Si el llamante dice ser autoridad pero **no** pide nada → toma mensaje, no transfiere, push al cuidador con resumen y número oficial de la institución (lookup contra CMF/SII allow-list de la sección 7 del threat model).

#### 2.4 `claim_service`

Toma motivo + nombre de empresa, push al cuidador:
> *"[Nombre empresa] llamó a María y dijo: [resumen]. Verifica llamando al número oficial de la empresa."*

**No transfiere.** Las empresas legítimas reintentan o envían comunicación por canal oficial. La urgencia genuina viene del banco, no de un "courier".

#### 2.5 `unclear`

Vigía hace 1–2 preguntas aclaratorias siguiendo template:
> *"Disculpe, no entendí bien. ¿Su llamada es por una emergencia, una notificación, o una consulta?"*

Si sigue ambiguo después de 2 preguntas → toma mensaje. Default conservador.

### Nivel 3 — Política de transferencia

**Vigía transfiere a María únicamente cuando se cumplen TODAS las condiciones aplicables:**

```
def should_transfer(entry, factors):
    if entry is None:
        return False  # número desconocido nunca transfiere
    
    if entry.policy == "take_message_only":
        return False
    
    if entry.policy == "always_pass":
        return factors.shared_word_ok or factors.kba_ok
    
    if entry.policy == "pass_after_verification":
        return (
            (factors.shared_word_ok or factors.kba_ok)
            and factors.cross_channel_ok
        )
    
    return False  # fail-safe
```

**Por qué AND y no OR:**
- Caller-ID solo: spoofeable (V22). No basta.
- Shared word sola: pudo ser robada por ingeniería social previa. No basta.
- Caller-ID + shared word: ya cuesta. Pero atacante con info detallada (caller_id spoof + shared word obtenida vía pretexting) podría pasar.
- Caller-ID + (shared word OR KBA) + cross-channel ack: el atacante necesita controlar el WhatsApp del supuesto familiar **y** conocer la shared word. Combinación realísticamente imposible para fraude oportunista.

### Nivel 4 — Toma de mensaje y push al cuidador

Cuando no se transfiere, Vigía:

1. Dice (TTS):
   > *"María no puede atender ahora. Si quiere dejar un mensaje, soy Vigía y se lo entrego al instante. Si es urgente, María lo recibirá por WhatsApp."*
2. Graba 30–60s adicionales del llamante.
3. Despacha al **Vishing Analyst** (Opus 4.7 + extended thinking) para análisis profundo post-call: patrones, citas regulatorias si aplica, resumen ciudadano.
4. Push al cuidador (Web Push + WhatsApp redundante):
   ```
   📞 Llamada para María
   De: [caller_id o "número desconocido"]
   Reclamó ser: [claim type + texto]
   Veredicto Vigía: [LEGÍTIMA | SOSPECHOSA | FRAUDE]
   Resumen: [3 líneas]
   Audio: [link signed-url 30s]
   Acciones: [contestar después | bloquear | denuncia SERNAC]
   ```
5. Persiste en Supabase con TTL 24h, audio en Storage con expiración firmada, contenido redactado de PII según política `THREAT-MODEL.md` §5.4.

---

## 3. Estados y transiciones (state machine)

```
            ┌─────────┐
            │ IDLE    │
            └────┬────┘
                 │ Twilio webhook /voice/incoming
                 ▼
       ┌─────────────────┐
       │ WHITELIST_LOOKUP│
       └────────┬────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
  [match]           [no match]
       │                 │
       ▼                 ▼
 ┌───────────┐     ┌──────────┐
 │INTENT_DET.│     │INTENT_DET│
 └─────┬─────┘     └─────┬────┘
       │                 │
       ▼                 ▼
 ┌──────────────────────────┐
 │ obvious_scam → HANGUP    │
 ├──────────────────────────┤
 │ claim_authority + dinero │
 │              → HANGUP    │
 ├──────────────────────────┤
 │ claim_family → ASK_SW    │
 ├──────────────────────────┤
 │ claim_bank → MCP_CMF     │
 ├──────────────────────────┤
 │ claim_service → MESSAGE  │
 ├──────────────────────────┤
 │ unclear → CLARIFY (≤2)   │
 └──────────┬───────────────┘
            │
            ▼
       ┌──────────┐
       │ VERIFY   │
       │ (factors)│
       └────┬─────┘
            │
   ┌────────┴────────┐
   ▼                 ▼
[transfer ok]   [otherwise]
   │                 │
   ▼                 ▼
┌─────────┐    ┌──────────┐
│TRANSFER │    │ MESSAGE  │
└────┬────┘    │ + ALERT  │
     │         └──────────┘
     ▼
[end of call]
     │
     ▼
┌─────────────────┐
│ POST_CALL       │
│ Vishing Analyst │
│ (Opus 4.7 +     │
│  extended       │
│  thinking)      │
│ → push al       │
│   cuidador      │
└─────────────────┘
```

---

## 4. Mapeo a vectores del threat model

| Vector | Defensa que aporta este firewall |
|---|---|
| **V21 — Suplantación social ("soy tu nieta")** | Shared word + KBA + cross-channel ack combinados. Single-factor (solo lo que dice) es estructuralmente insuficiente. |
| **V22 — Caller-ID spoofing matching whitelist** | Caller-ID es necesario pero NO suficiente. Toda policy ≠ `take_message_only` exige factor adicional. |
| **V12 — PII exfiltration** | El llamante nunca recibe info de María. Vigía no responde "su RUT es...", no confirma identidad de María. |
| **V9 — Persona hijack** | System prompt del Call Triage anclado a deny-by-default; cualquier intento del llamante de redefinir el rol = bandera. |
| **V13 — Multi-turn jailbreak** | La conversación con el llamante es **single-turn por sesión** desde el punto de vista del agente: contexto crece pero el agente nunca "cede" su rol. |

---

## 5. Esquemas de telemetría

Cada llamada produce un registro auditable:

```typescript
type CallSession = {
  call_session_id: string;         // ULID
  caregiver_id: string;
  protected_id: string;
  twilio_call_sid: string;
  caller_id_e164: string;
  caller_id_in_whitelist: boolean;
  whitelist_entry_id?: string;
  intent_detected: 
    | "claim_family" | "claim_bank" | "claim_authority" 
    | "claim_service" | "unclear" | "obvious_scam_pattern";
  factors: {
    shared_word_attempted: boolean;
    shared_word_ok: boolean;
    kba_attempted: boolean;
    kba_ok: boolean;
    cross_channel_attempted: boolean;
    cross_channel_ok: boolean;
  };
  decision: "transfer" | "message" | "hangup";
  decision_reason: string;
  duration_ms: number;
  triage_model: "sonnet-4-6";
  analyst_model?: "opus-4-7";      // si se ejecutó post-call analysis
  citations: Citation[];           // citaciones del análisis post-call
  alert_sent_via: ("web_push" | "whatsapp" | "sms")[];
  pii_redacted: boolean;
  canary_present: boolean;
  created_at: string;
};
```

Esta tabla NO contiene transcripts ni audio. Audios viven en Storage con TTL 24h. Transcripts se persisten **redactados** según política PII (`THREAT-MODEL.md` §5.4) en una tabla separada con TTL 24h.

---

## 6. Defensa Q&A

| Pregunta probable del jurado | Respuesta defendible |
|---|---|
| *"¿Qué pasa si el estafador dice ser la nieta?"* | María nunca lo escucha. Vigía aplica el firewall: si el caller_id no está whitelisted o falla shared word/KBA o falla cross-channel, no hay transferencia. Toma el mensaje, lo resume al cuidador, el cuidador decide en 5 minutos por WhatsApp. |
| *"¿Y si el estafador conoce la palabra clave?"* | Necesita además controlar el WhatsApp del familiar legítimo y tener un caller-ID spoofeado al número whitelisted. La combinación es multi-factor real. Si fallara, default es no-transferir. Adicionalmente, sospecha de leak dispara rotación sugerida al cuidador. |
| *"¿No le complica la vida al cuidador?"* | 5 minutos de setup una vez. El cuidador estaba viendo todas las llamadas de la abuela igualmente — hoy esa supervisión pasa por su atención no estructurada. Vigía la estructura. |
| *"¿Y si la abuela quiere conversar con su nieta?"* | El cuidador puede marcar a la nieta como `pass_after_verification` con shared word — la nieta dice la palabra una vez al inicio y queda transferida. O marcarla como `always_pass` (médico, hijo titular). Granular. |
| *"¿Por qué no usar voice cloning detection?"* | Out of scope MVP por estado del arte cambiante y datos de referencia que requeriría procesar. La defensa real contra clonación de voz es factor de conocimiento (KBA) + factor de canal (cross-channel WhatsApp). Eso ya está. |

---

## 7. Anti-patrones explícitos

- ❌ **No** confiar solo en caller_id. V22.
- ❌ **No** transferir "para ser amable" con un llamante insistente. Default = no transferir.
- ❌ **No** pedir RUT, datos bancarios o claves a María por la línea (NUNCA — protección de datos + las víctimas no deben acostumbrarse a entregar datos por llamadas).
- ❌ **No** confirmar al llamante si "María está en casa" o "puede contestar". El llamante no es de confianza. Vigía dice *"María no puede atender, deje su mensaje"* sin más detalle.
- ❌ **No** revelar al llamante si su shared word fue correcta o no. Si falla, Vigía pasa a KBA o toma mensaje sin acusar el fallo. Esto evita oracle attack (probar palabras hasta acertar).
- ❌ **No** persistir respuestas KBA en plain text. Hash siempre.
- ❌ **No** loguear shared word ni respuestas KBA — ni siquiera redactadas. La sesión puede saberlas en memoria pero no escribirlas.
