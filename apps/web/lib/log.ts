// Logger estructurado mínimo para diagnóstico de la cascada.
// Imprime una línea JSON por evento (level/source/message + contexto serializable),
// fácil de greppear en `vercel logs` y en stdout local.
//
// Reglas:
// - NUNCA pasar transcript del llamante ni shared word ni respuestas KBA — son PII / secretos.
// - Sí pasar audio_id, agent name, latencia, http status, error name, error message.
// - El SDK de Anthropic adjunta `status` (HTTP) y a veces `error.error.message` con el detalle real.

type LogContext = Record<
  string,
  string | number | boolean | null | undefined
>;

type AnthropicErrorShape = {
  message?: string;
  name?: string;
  status?: number;
  error?: { error?: { message?: string; type?: string } };
};

function shapeError(err: unknown): {
  message: string;
  name?: string;
  status?: number;
  api_message?: string;
  api_type?: string;
} {
  if (typeof err === "string") return { message: err };
  if (!err || typeof err !== "object") return { message: String(err) };
  const e = err as AnthropicErrorShape;
  return {
    message: e.message ?? "unknown_error",
    name: e.name,
    status: e.status,
    api_message: e.error?.error?.message,
    api_type: e.error?.error?.type,
  };
}

export function logError(
  source: string,
  err: unknown,
  context: LogContext = {},
): void {
  const errInfo = shapeError(err);
  console.error(
    JSON.stringify({
      level: "error",
      source,
      ...errInfo,
      ...context,
    }),
  );
}

export function logWarn(source: string, message: string, context: LogContext = {}): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      source,
      message,
      ...context,
    }),
  );
}
