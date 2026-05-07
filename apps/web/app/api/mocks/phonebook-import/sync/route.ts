// POST /api/mocks/phonebook-import/sync — endpoint mock que simula la lectura
// de la agenda telefónica del cuidador (Contacts Picker API en Android Chrome /
// Share Sheet en iOS / acceso nativo en V2).
//
// MVP/PoC N20: NO accede a la agenda real (la PWA web no tiene permiso para
// eso sin user gesture + APIs específicas que aún tienen soporte fragmentado).
// Solo retarda la respuesta y devuelve un set de contactos plausibles.
//
// En producción: Contacts Picker API (Chrome Android) con prompt de permiso
// explícito por contacto + fallback a importar vCard (.vcf) cargado por el
// cuidador. Usuario decide policy por contacto.

import type { ContactsImportPhonebookResponse } from "@/lib/api/contacts-mock.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOCK_LATENCY_MS = 1100;

const IMPORTED_CONTACTS = [
  {
    caller_id_e164: "+56998877665",
    display_name: "Sofía",
    relationship: "nieta",
    policy: "pass_after_verification" as const,
    shared_word_required: true,
    cross_channel_phone_e164: "+56998877665",
  },
  {
    caller_id_e164: "+56945123789",
    display_name: "Don Raúl (vecino)",
    relationship: "vecino",
    policy: "take_message_only" as const,
    shared_word_required: false,
    cross_channel_phone_e164: null,
  },
] as const;

export async function POST(): Promise<Response> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const body: ContactsImportPhonebookResponse = {
    ok: true,
    imported_entries: [...IMPORTED_CONTACTS],
    scanned_at: new Date().toISOString(),
    note_es:
      "Demo conceptual. En producción se usaría Contacts Picker API (Android Chrome) con prompt de permiso explícito por contacto, o fallback a importar un archivo vCard cargado por el cuidador.",
  };

  return Response.json(body, { status: 200 });
}
