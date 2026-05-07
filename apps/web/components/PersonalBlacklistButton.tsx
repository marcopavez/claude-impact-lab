"use client";

// PersonalBlacklistButton — botón que togglea el caller_id en la blacklist
// personal del usuario (IndexedDB, client-only).
//
// Decisiones:
//   - El estado inicial se hidrata desde IndexedDB en useEffect; mientras
//     tanto el botón muestra "Bloquear este número" para no parpadear y no
//     promete acción que no podrá cumplir.
//   - Si el caller_id es el default simbólico (+56000000000) el botón queda
//     deshabilitado con tooltip explicativo: en MVP el cuidador puede subir
//     un audio sin ingresar número, pero entonces no hay nada que bloquear.
//   - onClick es async pero el botón se deshabilita durante la operación
//     para evitar doble-click race.

import { useCallback, useEffect, useState } from "react";

import { AUDIO_PROCESS_LIMITS } from "../lib/api/audio-process.types";
import {
  addToPersonalBlacklist,
  isInPersonalBlacklist,
  PERSONAL_BLACKLIST_EVENT,
  removeFromPersonalBlacklist,
} from "../lib/storage/personal-blacklist";
import { BanIcon } from "./icons";

type Props = {
  callerId: string;
  defaultReason: string;
  sourceAudioId?: string;
};

export function PersonalBlacklistButton({
  callerId,
  defaultReason,
  sourceAudioId,
}: Props) {
  const isDefaultCallerId =
    callerId === AUDIO_PROCESS_LIMITS.defaultCallerId;
  const [isBlocked, setIsBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  // Hidratar estado inicial desde IndexedDB + suscribirse al evento global
  // para que múltiples botones (o el ContactsManager) se mantengan en sync.
  useEffect(() => {
    if (isDefaultCallerId) return;
    let cancelled = false;
    void (async () => {
      const blocked = await isInPersonalBlacklist(callerId);
      if (!cancelled) setIsBlocked(blocked);
    })();
    function onChanged() {
      void (async () => {
        const blocked = await isInPersonalBlacklist(callerId);
        if (!cancelled) setIsBlocked(blocked);
      })();
    }
    window.addEventListener(PERSONAL_BLACKLIST_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(PERSONAL_BLACKLIST_EVENT, onChanged);
    };
  }, [callerId, isDefaultCallerId]);

  const onToggle = useCallback(async () => {
    if (isDefaultCallerId || busy) return;
    setBusy(true);
    try {
      if (isBlocked) {
        await removeFromPersonalBlacklist(callerId);
        setIsBlocked(false);
      } else {
        await addToPersonalBlacklist({
          caller_id_e164: callerId,
          reason: defaultReason,
          added_at: new Date().toISOString(),
          source_audio_id: sourceAudioId,
        });
        setIsBlocked(true);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, callerId, defaultReason, isBlocked, isDefaultCallerId, sourceAudioId]);

  if (isDefaultCallerId) {
    return (
      <button
        type="button"
        disabled
        className="btn-ghost"
        title="Necesitas ingresar un número en el formulario para bloquearlo."
        aria-label="Bloquear este número (deshabilitado: no se ingresó número en el formulario)"
      >
        <BanIcon className="w-5 h-5" aria-hidden="true" />
        <span>Bloquear este número</span>
      </button>
    );
  }

  const label = isBlocked ? "Quitar de bloqueados" : "Bloquear este número";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className="btn-ghost"
      aria-pressed={isBlocked}
      aria-label={label}
    >
      <BanIcon className="w-5 h-5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
