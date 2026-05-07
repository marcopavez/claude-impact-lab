"use client";

// RecentAnalysesPanel — historial de los últimos 10 análisis del cuidador.
//
// Vive en IndexedDB del navegador (lib/storage/history.ts), no toca el server,
// no rompe N20 (cero PII en reposo en server: el cuidador puede ver "ya
// analicé este número" sin que Vigía guarde nada del lado del backend).
//
// Decisiones de UX:
//   - Solo se renderiza si hay ≥1 entry. La sección no estorba el flujo
//     principal de subir audio en el primer uso.
//   - Sin botón "ver análisis completo": el MVP es stateless, no podemos
//     recuperar el verdict original. Solo metadata (caller_id, headline,
//     verdict, severity, timestamp). Si el cuidador quiere análisis fresco,
//     vuelve a subir un audio del mismo número.
//   - Badge de severidad tipado igual al VerdictPanel para coherencia visual.
//   - Tag "Atajo del firewall" cuando was_early_exit=true: refuerza al jurado
//     que el firewall existió en ese análisis (M3 + B2).

import { useCallback, useEffect, useState } from "react";

import {
  clearHistory,
  HISTORY_EVENT,
  listHistory,
  removeHistoryEntry,
  type HistoryEntry,
  type HistoryVerdict,
} from "../lib/storage/history";
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  InfoIcon,
  ShieldCheckIcon,
} from "./icons";

// ============================================================
// Helpers
// ============================================================

function formatPhone(e164: string): string {
  if (!e164.startsWith("+56")) return e164;
  const rest = e164.slice(3);
  if (rest.length === 9 && rest.startsWith("9")) {
    return `+56 9 ${rest.slice(1, 5)} ${rest.slice(5)}`;
  }
  if (rest.length >= 8) {
    const area = rest.slice(0, 2);
    const a = rest.slice(2, 5);
    const b = rest.slice(5);
    return `+56 ${area} ${a} ${b}`;
  }
  return e164;
}

function formatRelative(iso: string, nowMs: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (diffSec < 60) return "hace unos segundos";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `hace ${m} ${m === 1 ? "minuto" : "minutos"}`;
  }
  if (diffSec < 86_400) {
    const h = Math.floor(diffSec / 3600);
    return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  }
  const d = Math.floor(diffSec / 86_400);
  if (d <= 7) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  // Más de 7 días: fecha corta chilena.
  const date = new Date(then);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `el ${dd}-${mm}`;
}

const VERDICT_LABEL_ES: Record<HistoryVerdict, string> = {
  fraud: "Estafa detectada",
  suspicious: "Llamada sospechosa",
  legit: "Llamada legítima",
  unknown: "Resultado inconcluso",
  blacklist_match: "Número en lista oficial de amenazas",
  whitelist_pass: "Contacto confiable — pasa siempre",
  whitelist_verify: "Contacto confiable — verificar antes",
  whitelist_message: "Contacto confiable — solo mensaje",
};

type SeverityVisual = {
  bg: string;
  fg: string;
  border: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
};

const SEVERITY_VISUAL: Record<HistoryEntry["severity"], SeverityVisual> = {
  HIGH: {
    bg: "var(--color-danger)",
    fg: "var(--color-danger-fg)",
    border: "var(--color-danger)",
    Icon: AlertOctagonIcon,
  },
  MEDIUM: {
    bg: "var(--color-warning)",
    fg: "var(--color-warning-fg)",
    border: "var(--color-warning)",
    Icon: AlertTriangleIcon,
  },
  LOW: {
    bg: "var(--color-safe)",
    fg: "var(--color-safe-fg)",
    border: "var(--color-safe)",
    Icon: ShieldCheckIcon,
  },
};

// ============================================================
// Componente
// ============================================================

export function RecentAnalysesPanel() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [confirmingClear, setConfirmingClear] = useState(false);

  // Hidratar desde IndexedDB en mount + refrescar al recibir el custom event
  // que disparan addToHistory / clearHistory / removeHistoryEntry.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const list = await listHistory();
      if (!cancelled) setEntries(list);
    }
    void refresh();
    function onChanged() {
      void refresh();
    }
    window.addEventListener(HISTORY_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(HISTORY_EVENT, onChanged);
    };
  }, []);

  // Refresca el "hace X minutos" cada 60s. Evita ver "hace unos segundos"
  // congelado durante toda una sesión larga.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const handleRemove = useCallback(async (audioId: string) => {
    await removeHistoryEntry(audioId);
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      window.setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    await clearHistory();
    setConfirmingClear(false);
  }, [confirmingClear]);

  // Render: nothing si no hay entries (incluye estado de hidratación inicial).
  if (entries === null || entries.length === 0) return null;

  return (
    <details className="surface-card group">
      <summary
        className="flex items-center justify-between gap-4 p-5 sm:p-6 cursor-pointer list-none"
        aria-controls="recent-analyses-content"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--color-brand)] text-white"
          >
            <CheckCircleIcon className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[color:var(--color-text)] leading-tight">
              Análisis recientes
            </h2>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {entries.length} {entries.length === 1 ? "audio" : "audios"}{" "}
              analizados — solo en este teléfono
            </p>
          </div>
        </div>
        <span
          aria-hidden="true"
          className="text-[color:var(--color-text-subtle)] text-2xl leading-none transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>

      <div
        id="recent-analyses-content"
        className="border-t border-[var(--color-border)] px-5 sm:px-6 py-5 sm:py-6 flex flex-col gap-4"
      >
        <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
          Los últimos {entries.length}{" "}
          {entries.length === 1 ? "análisis se guardó" : "análisis se guardaron"}{" "}
          solo en este teléfono. Vigía no envía esta lista a ningún servidor —
          si abres Vigía en otro dispositivo, no la verás.
        </p>

        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const sty = SEVERITY_VISUAL[e.severity];
            return (
              <li
                key={e.audio_id}
                className="flex flex-col gap-2 p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ background: sty.bg, color: sty.fg }}
                  >
                    <sty.Icon className="w-4 h-4" />
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <p className="font-semibold text-[color:var(--color-text)] leading-tight">
                      {e.headline}
                    </p>
                    <p className="text-sm text-[color:var(--color-text-muted)]">
                      {VERDICT_LABEL_ES[e.verdict]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemove(e.audio_id)}
                    className="btn-ghost flex-shrink-0"
                    aria-label={`Quitar este análisis del historial`}
                    title="Quitar del historial"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--color-text-subtle)]">
                  <span className="font-mono text-[color:var(--color-text-muted)]">
                    {formatPhone(e.caller_id_e164)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={e.created_at}>
                    {formatRelative(e.created_at, nowMs)}
                  </time>
                  {e.was_early_exit ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]"
                        aria-label="Resuelto por el firewall local sin llamar a Claude"
                      >
                        <InfoIcon className="w-3 h-3" />
                        Atajo del firewall
                      </span>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => void handleClear()}
            className="btn-ghost"
            aria-label={
              confirmingClear
                ? "Confirmar borrar todo el historial"
                : "Borrar todo el historial de análisis"
            }
          >
            {confirmingClear ? "¿Seguro? Toca de nuevo" : "Limpiar historial"}
          </button>
        </div>
      </div>
    </details>
  );
}
