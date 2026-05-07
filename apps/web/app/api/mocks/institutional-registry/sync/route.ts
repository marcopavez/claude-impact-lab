// POST /api/mocks/institutional-registry/sync — endpoint mock que simula la
// sincronización con el registro de números oficiales de instituciones
// relevantes (bancos CMF, AFPs, isapres, organismos públicos).
//
// MVP/PoC N20: NO hace ningún call externo. Retarda la respuesta para mostrar
// un spinner real y devuelve entries adicionales que el cliente agrega al
// state local junto a las pre-cargadas de demo-config.json.
//
// En producción: webscraping respetuoso del Registro CMF Prestadores Fintec +
// Subtel asignación de numeración + cronjob semanal con verificación
// cross-source. Spec en docs/PLAN.md y docs/SEGURIDAD.md.

import type { InstitutionalRegistrySyncResponse } from "@/lib/api/contacts-mock.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOCK_LATENCY_MS = 1400;

const NEWLY_SYNCED_INSTITUTIONS = [
  {
    caller_id_e164: "+56226912000",
    display_name: "Banco Santander Chile — Atención cliente",
    category: "banco" as const,
    source: "Registro CMF Prestadores",
    source_url: "https://www.cmfchile.cl",
    verified_at: "2026-05-04",
  },
  {
    caller_id_e164: "+56226608000",
    display_name: "Isapre Banmédica — Mesa de ayuda",
    category: "isapre" as const,
    source: "Sitio oficial Isapre",
    source_url: "https://www.banmedica.cl",
    verified_at: "2026-05-04",
  },
  {
    caller_id_e164: "+56222000000",
    display_name: "Hospital Clínico UC — Central telefónica",
    category: "salud_publica" as const,
    source: "Sitio oficial UC Christus",
    source_url: "https://www.ucchristus.cl",
    verified_at: "2026-05-04",
  },
] as const;

export async function POST(): Promise<Response> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const body: InstitutionalRegistrySyncResponse = {
    ok: true,
    scanned_sources: [
      { name: "Registro CMF Prestadores", entries_found: 1 },
      { name: "Subtel — asignación de numeración", entries_found: 0 },
      { name: "Sitios oficiales de instituciones", entries_found: 2 },
    ],
    institutional_new_entries: [...NEWLY_SYNCED_INSTITUTIONS],
    scanned_at: new Date().toISOString(),
    note_es:
      "Demo conceptual. En producción se haría webscraping respetuoso del Registro CMF Prestadores + Subtel + cronjob semanal con verificación cross-source.",
  };

  return Response.json(body, { status: 200 });
}
