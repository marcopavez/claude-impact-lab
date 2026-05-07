"use client";

// DamageControlCard — "¿la persona ya entregó datos o dinero?".
//
// Convierte a Vigía de "detector" en "respuesta a incidente". El veredicto
// dice si la llamada fue estafa; este card dice qué hacer en los próximos
// 30 minutos si el daño ya ocurrió.
//
// Decisiones:
//   - Cero LLM: la lista de acciones es determinista, derivada de los
//     patterns_detected del Vishing Analyst + claimed_entity. El mismo input
//     produce siempre el mismo output, defendible en Q&A "¿alucinás
//     consejos?" → "no, son rules-based".
//   - Cerrado por default: Vigía NO asume que el daño ocurrió. Solo el
//     cuidador sabe si la persona protegida entregó algo. Mostrar las
//     acciones colapsadas evita alarmismo cuando no hay daño.
//   - Solo se renderiza si severity ≥ MEDIUM: para LOW (banco real,
//     familiar legítimo) las acciones de "bloqueá tarjeta" no aplican.
//   - Cuando hay suplantacion_bancaria, mostramos números OFICIALES del
//     institutional_registry. Esto cierra el loop "no llames al número que
//     apareció — llamá a este otro que sí está verificado en el Registro
//     CMF".

import { useState } from "react";

import demoConfig from "../data/demo-config.json";
import type { VishingPattern } from "../lib/agents/vishing-analyst";
import type { NotificationSeverity } from "../lib/agents/caregiver-notifier";
import type { InstitutionalContact } from "../lib/api/contacts-mock.types";
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  InfoIcon,
} from "./icons";

// ============================================================
// Catálogo de acciones (rule-based, sin LLM)
// ============================================================

type ActionKey =
  | "call_official_bank"
  | "block_card"
  | "change_password"
  | "reverse_transfer"
  | "call_real_family"
  | "sernac_4242"
  | "no_pay_phone_fines"
  | "block_contact_social"
  | "stop_transfers"
  | "denuncia_pdi"
  | "denuncia_sernac"
  | "call_official_utility"
  | "block_rut_registro_civil"
  | "monitor_dicom"
  | "verify_with_shared_word";

type ActionPriority = "critical" | "important";

type ActionDef = {
  key: ActionKey;
  priority: ActionPriority;
  title: string;
  body: string;
  /** Flag para inyectar la lista de teléfonos oficiales del institutional_registry. */
  showBanks?: boolean;
  links?: { label: string; url: string }[];
};

const ACTIONS: Record<ActionKey, ActionDef> = {
  call_official_bank: {
    key: "call_official_bank",
    priority: "critical",
    title: "Llama YA al número oficial de tu banco",
    body: "Si la persona protegida entregó clave, OTP, CVV o datos de tarjeta, el banco puede bloquearla y reversar transferencias recientes. Cada minuto cuenta. Marca tú al número de la tarjeta o de la app oficial — nunca al número del que te llamaron.",
    showBanks: true,
  },
  block_card: {
    key: "block_card",
    priority: "critical",
    title: "Pide bloqueo de la tarjeta bancaria",
    body: "Dile al ejecutivo del banco que se entregaron datos de tarjeta. El bloqueo es inmediato; emiten una nueva en pocos días.",
  },
  change_password: {
    key: "change_password",
    priority: "critical",
    title: "Cambia la clave desde la app oficial",
    body: "Hazlo desde la app o el sitio del banco escribiendo la dirección a mano. Nunca desde un link recibido por SMS o WhatsApp. Si la persona protegida no recuerda cómo, hazlo tú por ella.",
  },
  reverse_transfer: {
    key: "reverse_transfer",
    priority: "critical",
    title: "Si transfirieron plata, pide reverso al banco",
    body: "Algunas operaciones se pueden reversar dentro de las primeras 24 horas. Insiste con el ejecutivo y cita tu derecho a denuncia bajo Ley 21.521 (Fintech) si opone resistencia.",
  },
  call_real_family: {
    key: "call_real_family",
    priority: "critical",
    title: "Llama al familiar real al número que ya tienes guardado",
    body: "Confirma si lo del accidente, detención o aduana realmente ocurrió. En la enorme mayoría de los cuentos del tío, el familiar está bien y nunca llamó.",
  },
  sernac_4242: {
    key: "sernac_4242",
    priority: "important",
    title: "Llama gratis al *4242 (Sernac)",
    body: "Línea gratuita desde cualquier teléfono chileno. Te orientan paso a paso y pueden abrir la denuncia mientras estás al teléfono.",
    links: [{ label: "Sernac", url: "https://www.sernac.cl" }],
  },
  no_pay_phone_fines: {
    key: "no_pay_phone_fines",
    priority: "important",
    title: "Autoridades reales NUNCA cobran por teléfono",
    body: "PDI, Carabineros, SII y Tribunales no piden depósitos ni transferencias por llamada. Si te dijeron de una causa o citación, ve presencialmente a la oficina más cercana o consulta el sitio oficial.",
  },
  block_contact_social: {
    key: "block_contact_social",
    priority: "important",
    title: "Bloquea al contacto en redes",
    body: "Bloquéalo en WhatsApp, Facebook e Instagram. Antes de bloquear, saca capturas de pantalla — sirven para la denuncia en la PDI.",
  },
  stop_transfers: {
    key: "stop_transfers",
    priority: "critical",
    title: "Corta todas las transferencias futuras",
    body: "Aunque cueste, parar el flujo de plata es lo que detiene el daño. La PDI tiene unidad especializada en estafas afectivas y estos casos se resuelven solo así.",
  },
  denuncia_pdi: {
    key: "denuncia_pdi",
    priority: "important",
    title: "Denuncia en la PDI Cibercrimen",
    body: "Tienen oficinas en regiones y un canal online. Lleva capturas de pantalla, movimientos bancarios y cualquier comprobante.",
    links: [{ label: "PDI Cibercrimen", url: "https://www.pdichile.cl" }],
  },
  denuncia_sernac: {
    key: "denuncia_sernac",
    priority: "important",
    title: "Haz la denuncia en Sernac",
    body: "Si suplantaron una marca o cobraron por algo inexistente, Sernac puede aplicar multas y abre un expediente formal.",
    links: [{ label: "Sernac", url: "https://www.sernac.cl" }],
  },
  call_official_utility: {
    key: "call_official_utility",
    priority: "critical",
    title: "Llama al servicio por su número oficial",
    body: "Si era una supuesta empresa (Enel, Aguas Andinas, Movistar, Entel, VTR, Metrogas), busca el número en la última boleta o en su sitio oficial. NO uses el número que te llamó.",
  },
  block_rut_registro_civil: {
    key: "block_rut_registro_civil",
    priority: "important",
    title: "Activa el bloqueo de tu RUT",
    body: "Si entregaron RUT, evita que se abran cuentas o créditos a nombre de la persona protegida. El bloqueo en el Registro Civil es gratuito y se hace online.",
    links: [
      { label: "Registro Civil", url: "https://www.registrocivil.cl" },
    ],
  },
  monitor_dicom: {
    key: "monitor_dicom",
    priority: "important",
    title: "Revisa DICOM y boletín comercial por 3 meses",
    body: "Si aparecen deudas o movimientos a nombre de la persona protegida, denuncia inmediata. La primera consulta del mes es gratuita.",
  },
  verify_with_shared_word: {
    key: "verify_with_shared_word",
    priority: "critical",
    title: "Si vuelven a llamar, exige la palabra clave familiar",
    body: "Las voces se pueden imitar. Una palabra acordada solo en familia (que no esté en redes sociales) es la defensa real contra clonación de voz.",
  },
};

const PATTERN_ACTIONS: Partial<Record<VishingPattern, ActionKey[]>> = {
  cuento_del_tio: ["call_real_family", "reverse_transfer"],
  suplantacion_bancaria: [
    "call_official_bank",
    "block_card",
    "change_password",
    "reverse_transfer",
  ],
  suplantacion_autoridad: ["no_pay_phone_fines", "sernac_4242"],
  premio_oferta: ["block_card", "denuncia_sernac"],
  utilidad_servicio: ["call_official_utility", "block_card"],
  romance_emocional: ["stop_transfers", "block_contact_social", "denuncia_pdi"],
  voice_clone_signal: ["verify_with_shared_word"],
  // urgency_pressure y secrecy_request son señales generales, no triggers
  // específicos — se cubren con las acciones generales.
};

const ALWAYS_INCLUDE: ActionKey[] = [
  "sernac_4242",
  "block_rut_registro_civil",
  "monitor_dicom",
];

function buildActionList(patterns: VishingPattern[]): ActionDef[] {
  // Set para dedupe sin perder orden de inserción.
  const keys = new Map<ActionKey, true>();
  for (const p of patterns) {
    const fromPattern = PATTERN_ACTIONS[p];
    if (!fromPattern) continue;
    for (const k of fromPattern) keys.set(k, true);
  }
  for (const k of ALWAYS_INCLUDE) keys.set(k, true);

  const list = Array.from(keys.keys()).map((k) => ACTIONS[k]);
  // Críticas primero, luego importantes — orden estable dentro de cada grupo.
  return list.sort((a, b) => {
    if (a.priority === b.priority) return 0;
    return a.priority === "critical" ? -1 : 1;
  });
}

// ============================================================
// Lista de bancos oficiales desde el institutional_registry
// ============================================================

function getOfficialBanks(): InstitutionalContact[] {
  return (demoConfig.institutional_registry as InstitutionalContact[]).filter(
    (c) => c.category === "banco",
  );
}

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

// ============================================================
// Componente
// ============================================================

type Props = {
  patterns: VishingPattern[];
  severity: NotificationSeverity;
};

export function DamageControlCard({ patterns, severity }: Props) {
  // useState siempre ANTES de cualquier return condicional para respetar
  // la regla de hooks. El early return debe ir después.
  const [open, setOpen] = useState<"yes" | "not_yet" | null>(null);

  // Solo aplica cuando hay riesgo plausible: severity HIGH o MEDIUM.
  // Para LOW (banco real, familia legítima) las acciones de "bloquear tarjeta"
  // serían alarmistas y no aplicarían.
  if (severity === "LOW") return null;

  const actions = buildActionList(patterns);
  const showBanksAtLeastOnce = actions.some((a) => a.showBanks);
  const banks = showBanksAtLeastOnce ? getOfficialBanks() : [];
  const criticalCount = actions.filter((a) => a.priority === "critical").length;
  const subtitle =
    criticalCount > 0
      ? `Solo tú sabes si pasó. Si pasó, hay ${criticalCount} ${criticalCount === 1 ? "paso urgente" : "pasos urgentes"} para limitar el daño.`
      : "Solo tú sabes si pasó. Si pasó, estos son los pasos para limitar el daño.";

  return (
    <section
      aria-labelledby="damage-control-heading"
      className="surface-card overflow-hidden flex flex-col"
      style={{
        borderColor: "var(--color-warning)",
        borderWidth: "2px",
      }}
    >
      <div
        className="verdict-stripe"
        style={{ background: "var(--color-warning)" }}
        aria-hidden="true"
      />
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <header className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full"
            style={{
              background: "var(--color-warning)",
              color: "var(--color-warning-fg)",
            }}
          >
            <AlertTriangleIcon className="w-6 h-6" />
          </span>
          <div className="flex flex-col gap-1 min-w-0">
            <h2
              id="damage-control-heading"
              className="font-display text-2xl font-bold leading-tight text-[color:var(--color-text)]"
            >
              ¿La persona protegida ya entregó datos o dinero?
            </h2>
            <p className="text-base text-[color:var(--color-text-muted)] leading-relaxed">
              {subtitle}
            </p>
          </div>
        </header>

        <div
          className="flex flex-col sm:flex-row gap-2"
          role="group"
          aria-label="¿La persona protegida ya entregó datos o dinero?"
        >
          <button
            type="button"
            onClick={() => setOpen(open === "yes" ? null : "yes")}
            className={open === "yes" ? "btn-primary" : "btn-secondary"}
            aria-pressed={open === "yes"}
          >
            Sí, ya entregó algo
          </button>
          <button
            type="button"
            onClick={() => setOpen(open === "not_yet" ? null : "not_yet")}
            className={open === "not_yet" ? "btn-primary" : "btn-secondary"}
            aria-pressed={open === "not_yet"}
          >
            Aún no — solo quiero estar preparado
          </button>
        </div>

        {open === "not_yet" ? (
          <div
            role="status"
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 flex items-start gap-3"
          >
            <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-[color:var(--color-brand)]" />
            <p className="text-sm text-[color:var(--color-text)] leading-relaxed">
              Bien hecho. Si la persona protegida no entregó nada, lo más
              importante ya está cubierto: el plan de denuncia listo arriba y la
              frase defensiva para si vuelven a llamar. Vuelve a este panel solo
              si después descubres que sí pasó algo.
            </p>
          </div>
        ) : null}

        {open === "yes" ? (
          <div className="flex flex-col gap-4">
            {/* Crítico — primer bloque */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm uppercase tracking-wide font-bold text-[color:var(--color-danger)] flex items-center gap-2">
                <AlertOctagonIcon className="w-4 h-4" />
                Lo más urgente — hazlo en los próximos minutos
              </h3>
              <ol className="flex flex-col gap-3">
                {actions
                  .filter((a) => a.priority === "critical")
                  .map((a) => (
                    <ActionItem
                      key={a.key}
                      action={a}
                      banks={a.showBanks ? banks : []}
                    />
                  ))}
              </ol>
            </div>

            {/* Importante — segundo bloque */}
            {actions.some((a) => a.priority === "important") ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm uppercase tracking-wide font-bold text-[color:var(--color-warning)] flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4" />
                  Importante — en las próximas horas
                </h3>
                <ol className="flex flex-col gap-3">
                  {actions
                    .filter((a) => a.priority === "important")
                    .map((a) => (
                      <ActionItem
                        key={a.key}
                        action={a}
                        banks={a.showBanks ? banks : []}
                      />
                    ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ============================================================
// Sub-componente: una acción
// ============================================================

function ActionItem({
  action,
  banks,
}: {
  action: ActionDef;
  banks: InstitutionalContact[];
}) {
  return (
    <li
      className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 flex flex-col gap-2"
    >
      <p className="font-semibold text-[color:var(--color-text)] leading-snug">
        {action.title}
      </p>
      <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
        {action.body}
      </p>

      {banks.length > 0 ? (
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] p-3">
          <p className="text-xs font-semibold text-[color:var(--color-text-muted)] mb-2 uppercase tracking-wide">
            Números oficiales verificados
          </p>
          <ul className="flex flex-col gap-1.5">
            {banks.map((b) => (
              <li
                key={b.caller_id_e164}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <span className="text-sm text-[color:var(--color-text)]">
                  {b.display_name}
                </span>
                <a
                  href={`tel:${b.caller_id_e164}`}
                  className="font-mono text-sm text-[color:var(--color-brand)] underline self-start sm:self-auto"
                  aria-label={`Llamar a ${b.display_name} al ${b.caller_id_e164}`}
                >
                  {formatPhone(b.caller_id_e164)}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[color:var(--color-text-subtle)] mt-2 leading-relaxed">
            Verificados en el Registro CMF. Toca el número para llamar.
          </p>
        </div>
      ) : null}

      {action.links && action.links.length > 0 ? (
        <div className="flex flex-row flex-wrap gap-2">
          {action.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline text-[color:var(--color-brand)]"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      ) : null}
    </li>
  );
}
