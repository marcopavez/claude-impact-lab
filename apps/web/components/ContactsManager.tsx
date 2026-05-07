"use client";

// ContactsManager — sección colapsable bajo el hero que muestra el firewall de
// identidad de Vigía: contactos confiables (whitelist), números bloqueados
// (blacklist) y números oficiales de instituciones.
//
// MVP/PoC N20: lectura inicial desde data/demo-config.json (props.initial). Tres
// botones de "sincronización" disparan endpoints mock que retardan respuesta y
// devuelven entries adicionales — el usuario las ve agregarse al state local.
// Read-only desde el punto de vista del usuario; las entries no se persisten.
//
// En producción: webscraping respetuoso (1 req/s) + cronjob semanal sobre CMF
// Alertas, Sernac, PDI Cibercrimen, Registro CMF Prestadores y Subtel. La UI
// declara explícitamente que ese flujo es viable pero no implementado en MVP.

import { useEffect, useState, useTransition } from "react";

import {
  AlertOctagonIcon,
  BanIcon,
  InfoIcon,
  LoaderIcon,
  RefreshIcon,
  ShieldCheckIcon,
} from "./icons";
import type {
  BlacklistContact,
  ContactsImportPhonebookResponse,
  InstitutionalContact,
  InstitutionalRegistrySyncResponse,
  ThreatFeedSyncResponse,
  WhitelistContact,
} from "../lib/api/contacts-mock.types";
import {
  listPersonalBlacklist,
  PERSONAL_BLACKLIST_EVENT,
  type PersonalBlacklistEntry,
  removeFromPersonalBlacklist,
} from "../lib/storage/personal-blacklist";

type Props = {
  initial: {
    whitelist: WhitelistContact[];
    blacklist: BlacklistContact[];
    institutional: InstitutionalContact[];
  };
};

type SyncState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; addedCount: number; sources: string[] }
  | { kind: "error"; message: string };

const POLICY_LABEL: Record<WhitelistContact["policy"], string> = {
  always_pass: "Pasa siempre",
  pass_after_verification: "Verificar antes",
  take_message_only: "Solo tomar mensaje",
};

const CATEGORY_LABEL: Record<InstitutionalContact["category"], string> = {
  banco: "Banco",
  afp: "AFP",
  isapre: "Isapre",
  organismo_publico: "Organismo público",
  salud_publica: "Salud",
};

function formatPhone(e164: string): string {
  // Formato amigable +56 9 XXXX XXXX o +56 22 XXX XXXX para CL.
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

function formatDateChile(iso: string): string {
  // Formato corto chileno: "06-05-2026". Si la fecha no parsea, devolvemos
  // el ISO crudo para no romper el render.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function ContactsManager({ initial }: Props) {
  const [whitelist, setWhitelist] = useState<WhitelistContact[]>(
    initial.whitelist,
  );
  const [blacklist, setBlacklist] = useState<BlacklistContact[]>(
    initial.blacklist,
  );
  const [institutional, setInstitutional] = useState<InstitutionalContact[]>(
    initial.institutional,
  );
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  const [importState, setImportState] = useState<SyncState>({ kind: "idle" });
  const [threatState, setThreatState] = useState<SyncState>({ kind: "idle" });
  const [registryState, setRegistryState] = useState<SyncState>({
    kind: "idle",
  });

  // Blacklist personal del usuario (IndexedDB, client-only). Se hidrata en
  // mount + se refresca via custom event para mantenerse en sync con el
  // PersonalBlacklistButton del VerdictPanel.
  const [personalBlacklist, setPersonalBlacklist] = useState<
    PersonalBlacklistEntry[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const entries = await listPersonalBlacklist();
      if (!cancelled) {
        // Más reciente primero — el cuidador suele querer ver lo último que bloqueó.
        entries.sort((a, b) => b.added_at.localeCompare(a.added_at));
        setPersonalBlacklist(entries);
      }
    }
    void refresh();
    function onChanged() {
      void refresh();
    }
    window.addEventListener(PERSONAL_BLACKLIST_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(PERSONAL_BLACKLIST_EVENT, onChanged);
    };
  }, []);

  async function handleRemovePersonal(callerId: string) {
    await removeFromPersonalBlacklist(callerId);
    // El custom event refresca el state via el effect de arriba; igual filtramos
    // localmente para feedback inmediato.
    setPersonalBlacklist((prev) =>
      prev.filter((e) => e.caller_id_e164 !== callerId),
    );
  }

  const [, startTransition] = useTransition();

  function markRecentlyAdded(ids: string[]) {
    setRecentlyAdded((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    // El badge "Recién sincronizado" desaparece a los 8s para no desviar la
    // atención del flujo principal de subir audio.
    window.setTimeout(() => {
      setRecentlyAdded((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }, 8000);
  }

  async function syncPhonebook() {
    setImportState({ kind: "loading" });
    try {
      const res = await fetch("/api/mocks/phonebook-import/sync", {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ContactsImportPhonebookResponse;

      const existing = new Set(whitelist.map((c) => c.caller_id_e164));
      const fresh = data.imported_entries.filter(
        (c) => !existing.has(c.caller_id_e164),
      );
      startTransition(() => {
        setWhitelist((prev) => [...prev, ...fresh]);
        markRecentlyAdded(fresh.map((c) => c.caller_id_e164));
        setImportState({
          kind: "success",
          addedCount: fresh.length,
          sources: ["Agenda del teléfono"],
        });
      });
    } catch (err) {
      setImportState({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "No pudimos importar tus contactos.",
      });
    }
  }

  async function syncThreatFeeds() {
    setThreatState({ kind: "loading" });
    try {
      const res = await fetch("/api/mocks/threat-feeds/sync", {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ThreatFeedSyncResponse;

      const existing = new Set(blacklist.map((c) => c.caller_id_e164));
      const fresh = data.blacklist_new_entries.filter(
        (c) => !existing.has(c.caller_id_e164),
      );
      startTransition(() => {
        setBlacklist((prev) => [...prev, ...fresh]);
        markRecentlyAdded(fresh.map((c) => c.caller_id_e164));
        setThreatState({
          kind: "success",
          addedCount: fresh.length,
          sources: data.scanned_sources.map((s) => s.name),
        });
      });
    } catch (err) {
      setThreatState({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "No pudimos consultar los feeds de amenazas.",
      });
    }
  }

  async function syncInstitutionalRegistry() {
    setRegistryState({ kind: "loading" });
    try {
      const res = await fetch("/api/mocks/institutional-registry/sync", {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as InstitutionalRegistrySyncResponse;

      const existing = new Set(institutional.map((c) => c.caller_id_e164));
      const fresh = data.institutional_new_entries.filter(
        (c) => !existing.has(c.caller_id_e164),
      );
      startTransition(() => {
        setInstitutional((prev) => [...prev, ...fresh]);
        markRecentlyAdded(fresh.map((c) => c.caller_id_e164));
        setRegistryState({
          kind: "success",
          addedCount: fresh.length,
          sources: data.scanned_sources.map((s) => s.name),
        });
      });
    } catch (err) {
      setRegistryState({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "No pudimos consultar el registro institucional.",
      });
    }
  }

  return (
    <details
      className="surface-card group"
      // Cerrado por default — no estorba el flujo principal de subir audio.
    >
      <summary
        className="flex items-center justify-between gap-4 p-5 sm:p-6 cursor-pointer list-none"
        aria-controls="contacts-content"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--color-brand)] text-white"
          >
            <ShieldCheckIcon className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[color:var(--color-text)] leading-tight">
              Contactos protegidos
            </h2>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {whitelist.length} confiables · {blacklist.length} bloqueados ·{" "}
              {institutional.length} oficiales · {personalBlacklist.length}{" "}
              bloqueados por ti
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
        id="contacts-content"
        className="border-t border-[var(--color-border)] px-5 sm:px-6 py-5 sm:py-6 flex flex-col gap-8"
      >
        <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
          Vigía cruza el número de cada llamada con tres listados: tus
          contactos confiables, los números reportados por organismos oficiales
          como peligrosos, y los números oficiales de bancos, AFPs e
          instituciones. Eso ayuda a decidir si la llamada se transfiere, se
          bloquea o se trata con cautela.
        </p>

        {/* ===================== WHITELIST ===================== */}
        <ContactSection
          title="Tus contactos confiables"
          description="Familia, vecinos y servicios habituales. Idealmente vienen de tu agenda del teléfono."
          icon={<ShieldCheckIcon className="w-5 h-5" />}
          accent="safe"
          count={whitelist.length}
          syncButton={{
            label: "Importar desde mi teléfono",
            loadingLabel: "Leyendo tu agenda…",
            onClick: syncPhonebook,
            state: importState,
            productionNote:
              "En producción: Contacts Picker API (Android Chrome) con permiso explícito por contacto, o cargar un archivo de contactos .vcf.",
          }}
          empty="Aún no hay contactos confiables. Importá tu agenda para comenzar."
        >
          {whitelist.map((c) => (
            <li
              key={c.caller_id_e164}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded border border-[var(--color-border)] bg-[var(--color-safe-bg)]"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[color:var(--color-text)]">
                    {c.display_name}
                  </span>
                  {recentlyAdded.has(c.caller_id_e164) && (
                    <NewlyAddedBadge />
                  )}
                </div>
                <span className="text-sm text-[color:var(--color-text-muted)]">
                  {c.relationship} · {formatPhone(c.caller_id_e164)}
                </span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-[color:var(--color-safe)] text-[color:var(--color-safe-fg)] font-medium self-start sm:self-center whitespace-nowrap">
                {POLICY_LABEL[c.policy]}
              </span>
            </li>
          ))}
        </ContactSection>

        {/* ===================== BLACKLIST ===================== */}
        <ContactSection
          title="Números bloqueados"
          description="Números reportados por la CMF, Sernac y la PDI como asociados a estafas. Si alguno de estos llama, Vigía corta de inmediato."
          icon={<AlertOctagonIcon className="w-5 h-5" />}
          accent="danger"
          count={blacklist.length}
          syncButton={{
            label: "Sincronizar con CMF y Sernac",
            loadingLabel: "Consultando feeds oficiales…",
            onClick: syncThreatFeeds,
            state: threatState,
            productionNote:
              "En producción: webscraping respetuoso (1 req/s) sobre CMF Alertas + Sernac + PDI Cibercrimen, ejecutado por un cronjob semanal.",
          }}
          empty="Sin números bloqueados todavía."
        >
          {blacklist.map((c) => (
            <li
              key={c.caller_id_e164}
              className="flex flex-col gap-2 p-3 rounded border border-[var(--color-border)] bg-[var(--color-danger-bg)]"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[color:var(--color-text)]">
                      {c.display_name}
                    </span>
                    {recentlyAdded.has(c.caller_id_e164) && (
                      <NewlyAddedBadge />
                    )}
                  </div>
                  <span className="text-sm text-[color:var(--color-text-muted)]">
                    {formatPhone(c.caller_id_e164)} · reportado el{" "}
                    {c.reported_at}
                  </span>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-[color:var(--color-danger)] text-[color:var(--color-danger-fg)] font-medium self-start whitespace-nowrap">
                  Bloquear
                </span>
              </div>
              <p className="text-sm text-[color:var(--color-text-muted)]">
                {c.reason}
              </p>
              <p className="text-xs text-[color:var(--color-text-subtle)]">
                Fuente: {c.source}
              </p>
            </li>
          ))}
        </ContactSection>

        {/* ===================== INSTITUTIONAL ===================== */}
        <ContactSection
          title="Números oficiales de instituciones"
          description="Bancos, AFPs, isapres y organismos públicos verificados. Si llaman desde estos números, igualmente se aplican las reglas de verificación de Vigía."
          icon={<InfoIcon className="w-5 h-5" />}
          accent="brand"
          count={institutional.length}
          syncButton={{
            label: "Sincronizar registro oficial",
            loadingLabel: "Consultando registros institucionales…",
            onClick: syncInstitutionalRegistry,
            state: registryState,
            productionNote:
              "En producción: webscraping respetuoso del Registro CMF Prestadores Fintec + Subtel asignación de numeración + cronjob semanal con verificación cross-source.",
          }}
          empty="Sin instituciones registradas."
        >
          {institutional.map((c) => (
            <li
              key={c.caller_id_e164}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded border border-[var(--color-border)] bg-white"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[color:var(--color-text)]">
                    {c.display_name}
                  </span>
                  {recentlyAdded.has(c.caller_id_e164) && <NewlyAddedBadge />}
                </div>
                <span className="text-sm text-[color:var(--color-text-muted)]">
                  {formatPhone(c.caller_id_e164)} · {c.source}
                </span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-brand-fg)] font-medium self-start sm:self-center whitespace-nowrap">
                {CATEGORY_LABEL[c.category]}
              </span>
            </li>
          ))}
        </ContactSection>

        {/* ===================== PERSONAL BLACKLIST ===================== */}
        {/*
          Sección 4: bloqueados por el cuidador desde el VerdictPanel. Vive en
          IndexedDB del navegador (no toca el server, no persiste en DB) y se
          mantiene en sync con el PersonalBlacklistButton vía custom event.
        */}
        <section className="flex flex-col gap-3">
          <header className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="text-[color:var(--color-danger)]"
            >
              <BanIcon className="w-5 h-5" />
            </span>
            <h3 className="text-base font-semibold text-[color:var(--color-text)]">
              Bloqueados por mí
            </h3>
            <span className="text-sm text-[color:var(--color-text-subtle)]">
              ({personalBlacklist.length})
            </span>
          </header>

          <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
            Números que tú bloqueaste manualmente desde el resultado de un
            análisis. Se guardan solo en este teléfono — Vigía no los envía a
            ningún servidor.
          </p>

          {personalBlacklist.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {personalBlacklist.map((entry) => (
                <li
                  key={entry.caller_id_e164}
                  className="flex flex-col gap-2 p-3 rounded border border-[var(--color-border)] bg-[var(--color-danger-bg)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[color:var(--color-text)]">
                        {formatPhone(entry.caller_id_e164)}
                      </span>
                      <span className="text-sm text-[color:var(--color-text-muted)]">
                        Agregado el {formatDateChile(entry.added_at)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleRemovePersonal(entry.caller_id_e164)
                      }
                      className="btn-ghost self-start"
                      aria-label={`Quitar ${entry.caller_id_e164} de mis bloqueados`}
                    >
                      <span>Quitar de bloqueados</span>
                    </button>
                  </div>
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    {entry.reason}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-[color:var(--color-text-subtle)]">
              Aún no has bloqueado ningún número manualmente. Cuando analices
              un audio sospechoso, podrás bloquear el número desde el
              resultado.
            </p>
          )}
        </section>
      </div>
    </details>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

type Accent = "safe" | "danger" | "brand";

const ACCENT_TEXT: Record<Accent, string> = {
  safe: "text-[color:var(--color-safe)]",
  danger: "text-[color:var(--color-danger)]",
  brand: "text-[color:var(--color-brand)]",
};

type SyncButton = {
  label: string;
  loadingLabel: string;
  onClick: () => void;
  state: SyncState;
  productionNote: string;
};

function ContactSection({
  title,
  description,
  icon,
  accent,
  count,
  syncButton,
  empty,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: Accent;
  count: number;
  syncButton: SyncButton;
  empty: string;
  children: React.ReactNode;
}) {
  const isLoading = syncButton.state.kind === "loading";

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className={ACCENT_TEXT[accent]}>
          {icon}
        </span>
        <h3 className="text-base font-semibold text-[color:var(--color-text)]">
          {title}
        </h3>
        <span className="text-sm text-[color:var(--color-text-subtle)]">
          ({count})
        </span>
      </header>

      <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
        {description}
      </p>

      {count > 0 ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : (
        <p className="text-sm italic text-[color:var(--color-text-subtle)]">
          {empty}
        </p>
      )}

      <div className="flex flex-col gap-2 mt-1">
        <button
          type="button"
          onClick={syncButton.onClick}
          disabled={isLoading}
          className="self-start inline-flex items-center gap-2 px-4 py-2 rounded border-2 border-[color:var(--color-brand)] text-[color:var(--color-brand)] bg-[color:var(--color-surface)] font-medium hover:bg-[color:var(--color-surface-2)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <LoaderIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>{syncButton.loadingLabel}</span>
            </>
          ) : (
            <>
              <RefreshIcon className="w-4 h-4" aria-hidden="true" />
              <span>{syncButton.label}</span>
            </>
          )}
        </button>

        {syncButton.state.kind === "success" && (
          <SyncResultMessage
            kind="success"
            text={
              syncButton.state.addedCount > 0
                ? `Listo: agregamos ${syncButton.state.addedCount} ${
                    syncButton.state.addedCount === 1 ? "número" : "números"
                  } nuevos. Fuentes consultadas: ${syncButton.state.sources.join(", ")}.`
                : `Sin novedades. Fuentes consultadas: ${syncButton.state.sources.join(", ")}.`
            }
          />
        )}

        {syncButton.state.kind === "error" && (
          <SyncResultMessage
            kind="error"
            text={`No pudimos sincronizar: ${syncButton.state.message}`}
          />
        )}

        <p className="text-xs text-[color:var(--color-text-subtle)] leading-relaxed">
          <strong>Demo conceptual:</strong> {syncButton.productionNote}
        </p>
      </div>
    </section>
  );
}

function SyncResultMessage({
  kind,
  text,
}: {
  kind: "success" | "error";
  text: string;
}) {
  const cls =
    kind === "success"
      ? "bg-[color:var(--color-safe-bg)] text-[color:var(--color-safe)] border-[color:var(--color-safe)]"
      : "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)] border-[color:var(--color-danger)]";
  return (
    <p
      role="status"
      className={`text-sm px-3 py-2 rounded border ${cls} leading-relaxed`}
    >
      {text}
    </p>
  );
}

function NewlyAddedBadge() {
  return (
    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-brand-fg)]">
      Recién sincronizado
    </span>
  );
}
