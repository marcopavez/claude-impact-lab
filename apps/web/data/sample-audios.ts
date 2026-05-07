// Audios de muestra para que el cuidador (o el jurado en demo en vivo) pueda
// probar Vigía sin grabar ni subir nada. Los archivos viven en
// apps/web/public/demo-audios/ y fueron renderizados por TTS desde
// apps/web/data/scripts/scams.json.
//
// Selección y caller_id sugerido por audio están elegidos para que un solo
// click muestre los TRES caminos canónicos del firewall sin que Marco tenga
// que tipear nada en vivo:
//
//   1. cuento-del-tio   → caller_id desconocido  → cascada COMPLETA fraud HIGH
//                          (Triage hangup → Vishing patterns → Notifier denuncia)
//   2. banco-oficial    → caller_id desconocido  → cascada simple LOW
//                          (Triage lookup_cmf_then_take_message → Notifier "verifica con banco")
//   3. nieto-happy-path → caller_id whitelist     → early-exit whitelist MEDIUM
//                          (firewall.local → banner "Pedro · verifica antes de devolver")
//
// Si Marco quiere demostrar early-exit blacklist, puede pegar manualmente en
// el campo caller_id un número de la blacklist demo (+56222119988, +56229447766,
// +56224431122) — no agregamos un cuarto botón para no abrumar.

export type SampleAudio = {
  /** ID estable, también es el filename: /demo-audios/<id>.mp3. */
  id: string;
  /** Etiqueta corta del botón (≤24 chars). */
  label: string;
  /** Sub-label que explica QUÉ tipo de llamada es, en lenguaje 65+. */
  description: string;
  /**
   * Camino canónico del firewall que dispara este sample. Se muestra como tag
   * en el botón para que el jurado entienda en 0.5s que estos 3 botones cubren
   * los 3 desenlaces del firewall.
   */
  expected_outcome:
    | "cascada_fraud_high"
    | "cascada_low"
    | "early_exit_whitelist";
  /**
   * caller_id en formato E.164 que se autollenará en el form al hacer click.
   * No se hardcodea como "número real" — son números demo coherentes con el
   * config.
   */
  suggested_caller_id: string;
  /** MIME del archivo en public/demo-audios. */
  mime: "audio/mpeg";
  /** Tamaño aprox. en bytes (informativo, no validado). */
  size_hint_bytes: number;
};

export const SAMPLE_AUDIOS: readonly SampleAudio[] = [
  {
    id: "cuento-del-tio",
    label: "Cuento del tío",
    description:
      "Llaman diciendo ser un familiar accidentado y piden plata urgente.",
    expected_outcome: "cascada_fraud_high",
    suggested_caller_id: "+56956789012",
    mime: "audio/mpeg",
    size_hint_bytes: 96_000,
  },
  {
    id: "banco-oficial",
    label: "Falsa solicitud de banco",
    description:
      "Banco confirma un movimiento sin pedir datos. Vigía verifica si es legítimo.",
    expected_outcome: "cascada_low",
    suggested_caller_id: "+56222334455",
    mime: "audio/mpeg",
    size_hint_bytes: 156_000,
  },
  {
    id: "nieto-happy-path",
    label: "Nieta legítima",
    description:
      "El nieto Pedro saluda a la abuela. El firewall lo reconoce de la lista de contactos.",
    expected_outcome: "early_exit_whitelist",
    suggested_caller_id: "+56987654321",
    mime: "audio/mpeg",
    size_hint_bytes: 132_000,
  },
];

/** Ruta pública del archivo MP3 dentro de Vercel/Next public/. */
export function sampleAudioUrl(id: string): string {
  return `/demo-audios/${id}.mp3`;
}

/** Etiqueta humana corta para el tag del camino esperado. */
export const SAMPLE_OUTCOME_LABEL_ES: Record<
  SampleAudio["expected_outcome"],
  string
> = {
  cascada_fraud_high: "Estafa · cascada completa",
  cascada_low: "Verifica con banco",
  early_exit_whitelist: "Atajo del firewall",
};
