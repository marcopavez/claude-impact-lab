// POST /api/mocks/threat-feeds/sync — endpoint mock que simula la sincronización
// con feeds de amenazas oficiales (CMF Alertas + Sernac + PDI Cibercrimen).
//
// MVP/PoC N20: NO hace ningún call externo. Solo retarda artificialmente la
// respuesta para que el spinner del ContactsManager sea visible y devuelve un
// listado pre-armado de entries blacklist "recién sincronizadas" que el cliente
// agrega a su state local. Distintas de las que vienen pre-cargadas en
// demo-config.json para que el usuario vea el listado crecer.
//
// En producción: webscraping respetuoso (1 req/s) sobre URLs oficiales + cronjob
// semanal con diff incremental. Spec en docs/PLAN.md y docs/SEGURIDAD.md.

import type { ThreatFeedSyncResponse } from "@/lib/api/contacts-mock.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOCK_LATENCY_MS = 1400;

const NEWLY_SYNCED_BLACKLIST = [
  {
    caller_id_e164: "+56229990011",
    display_name: "Suplantación BancoEstado — falso bloqueo de tarjeta",
    source: "CMF Alertas al público",
    source_url:
      "https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-43545.html",
    reason:
      "Llamada que afirma bloqueo de tarjeta y solicita clave dinámica del cliente",
    reported_at: "2026-05-02",
  },
  {
    caller_id_e164: "+56221234567",
    display_name: "Falsa hija pidiendo dinero urgente — patrón emocional",
    source: "PDI Cibercrimen — boletín",
    source_url: "https://www.pdichile.cl",
    reason:
      "Estafa con presión emocional contra adultos mayores; reportes en aumento",
    reported_at: "2026-05-04",
  },
] as const;

export async function POST(): Promise<Response> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const body: ThreatFeedSyncResponse = {
    ok: true,
    scanned_sources: [
      { name: "CMF Alertas al público", entries_found: 1 },
      { name: "Sernac — alertas vigentes", entries_found: 0 },
      { name: "PDI Cibercrimen — boletín", entries_found: 1 },
    ],
    blacklist_new_entries: [...NEWLY_SYNCED_BLACKLIST],
    scanned_at: new Date().toISOString(),
    note_es:
      "Demo conceptual. En producción se haría webscraping respetuoso (1 req/s) + cronjob semanal con diff incremental.",
  };

  return Response.json(body, { status: 200 });
}
