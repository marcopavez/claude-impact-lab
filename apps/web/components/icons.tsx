// Iconos SVG inline para Vigía. Reemplazan los emojis 🎙️ ⚡ ✅ ⚠️ 🔒
// que tenían contraste inconsistente entre OS y se veían amateur para
// el público target +65.
//
// Diseño: stroke 2px, viewBox 24x24, currentColor para heredar color de
// texto. Tamaño se controla con Tailwind className (w-6 h-6, w-12 h-12,
// w-16 h-16). El aria-hidden="true" es default — el ícono nunca contiene
// info que no esté en el texto adyacente. Si se necesita ícono "solo",
// pasar { aria-hidden: false, role: "img", "aria-label": "..." }.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": "true" as const,
} satisfies SVGProps<SVGSVGElement>;

/** Escudo lleno — marca de Vigía + verdict legítimo. */
export function ShieldIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/** Escudo con check interior — verdict "legítimo / seguro". */
export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Octágono con signo de exclamación — verdict "estafa / peligro alto". */
export function AlertOctagonIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2Z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/** Triángulo con signo de exclamación — verdict "sospechoso / atención". */
export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** Círculo con check — paso completado en el stepper de loading. */
export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Círculo con info "i" — verdict neutral. */
export function InfoIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/** Micrófono — zona de drop del audio. */
export function MicIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

/** Sparkle/destello — usado en "Análisis con Claude". */
export function SparkleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 L 13.8 9.6 L 20.5 11.4 L 13.8 13.2 L 12 19.8 L 10.2 13.2 L 3.5 11.4 L 10.2 9.6 Z" />
      <path d="M19 3v3" />
      <path d="M19 18v3" />
      <path d="M5 18v3" />
    </svg>
  );
}

/** Altavoz — botón "Escuchar veredicto" (TTS). */
export function VolumeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

/** Altavoz tachado — estado activo del TTS (clic para detener). */
export function VolumeMuteIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

/** Círculo vacío — paso pendiente en stepper. */
export function CircleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/** Loader/arc — paso activo en stepper (usar con animate-spin). */
export function LoaderIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/** Cruz simple — cerrar / borrar archivo seleccionado. */
export function CloseIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Candado — placeholder de PII redactada. */
export function LockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Refresh / retry — botón reintentar. */
export function RefreshIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

/** Megáfono — frase defensiva contra futuras llamadas. */
export function MegaphoneIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

/** Persona en círculo — cuidador o familiar de confianza. */
export function UserIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** Círculo con barra — bloquear / prohibir. */
export function BanIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

/** Portapapeles — botón copiar al portapapeles. */
export function ClipboardIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
