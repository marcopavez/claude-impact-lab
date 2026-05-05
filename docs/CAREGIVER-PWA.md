# CAREGIVER-PWA.md — Vigía

**Estado:** v0.1 (planning).
**Función:** especificación técnica de la aplicación del **cuidador familiar** — la única superficie de configuración de Vigía. La persona protegida (María, abuela 65+) **no usa esta app**; solo recibe llamadas filtradas. La app es para hijos/hijas/nietos que asumen rol de monitor.

## Decisión: PWA installable, no app nativa

Argumentos completos en la conversación de planning. Resumen técnico:

**Ganamos con PWA installable:**
- Distribución sin App Store: una URL que abre, login con magic link, configurado en 5 minutos.
- Demo del jurado: una URL pública sirve de demo en cualquier dispositivo.
- "Add to Home Screen" en Android (Chrome) e iOS (Safari) deja un ícono fullscreen indistinguible de app nativa.
- Web Push API funciona en Chrome/Edge/Firefox, Safari iOS 16.4+, Safari macOS 16.4+.
- Reduce 1 PWA vs 2 apps nativas (o 1 React Native con bridge debugging y builds Mac+Xcode).

**Lo que la app nativa daría que NO necesitamos para MVP:**
- Captura de audio de llamada en Android (`CALL_AUDIO_CAPTURE` desde API 29) — no aplica porque el audio lo captura Twilio Media Streams en el server, no el cliente.
- Lectura de contactos del SIM — no aplica; la whitelist se ingresa manualmente en setup.
- Background audio listening — out of scope (Companion Mode descartado).

**Roadmap honesto:** *"MVP es PWA installable. App nativa Android/iOS es V2 cuando justifique las capabilities nativas."*. Esto es defendible en Q&A.

---

## 1. Stack

| Capa | Elección | Justificación |
|---|---|---|
| Framework | **Next.js 15 App Router** + React 19 | RSC reduce bundle inicial, server actions simplifican backend, mismo lenguaje TS que `apps/api`. |
| UI | Tailwind CSS + shadcn/ui | Componentes accesibles, override fácil, sin lock-in. Skill `frontend-design` para refinar identidad visual sin look genérico. |
| Auth | **Supabase Auth — magic link al email** | Sin password, mejor seguridad y mejor UX. MFA por WhatsApp a futuro. |
| DB | Supabase Postgres | Misma instancia que el resto del backend. RLS por `caregiver_id`. |
| Storage | Supabase Storage | Audio temporal con TTL 24h y signed URLs. |
| Push | **Web Push API + VAPID** | Web Push como canal primario. WhatsApp Cloud API redundante para alertas críticas (`HIGH risk hangup`, `caller verification failed`). SMS Twilio como tercer fallback. |
| PWA | `manifest.json` + service worker + iconos 192/512 + theme color | "Add to Home Screen" funcional Android e iOS. |
| State | TanStack Query + Zustand para UI local | Reducir round-trips a Supabase, optimistic updates en config. |
| i18n | Solo es-CL en MVP | Multi-idioma (migrantes) en roadmap. |

**Estructura de directorio:**
```
apps/web-caregiver/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (app)/
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── settings/
│   │   ├── live/[callSessionId]/
│   │   └── layout.tsx
│   ├── api/
│   │   └── push/subscribe/
│   ├── manifest.ts
│   └── layout.tsx
├── components/
│   ├── ui/                  // shadcn primitives
│   ├── whitelist/
│   ├── kba/
│   └── live-transcript/
├── lib/
│   ├── supabase/
│   ├── push/
│   └── crypto/              // hashing de shared word + KBA
└── public/
    ├── sw.js                // service worker
    └── icons/               // 192, 512, maskable
```

---

## 2. Cuatro pantallas

### 2.1 Onboarding (5 pasos, primer login)

Wizard con barra de progreso. Cada paso con un botón "Siguiente" desactivado hasta que cumpla la validación mínima.

**Paso 1 — Identidad del cuidador y de la persona protegida**
- Campos: tu nombre, tu relación con la persona protegida, su nombre, su edad, ciudad.
- *"María, 78 años, Ñuñoa, eres su hija."* — un párrafo en lenguaje claro, no formulario corporativo.

**Paso 2 — Whitelist (mínimo 3 contactos para activar)**
- Agregar contactos: nombre, relación, teléfono. Validación de formato chileno (+569XXXXXXXX o número fijo).
- Por cada contacto, slider entre 3 políticas con explicación visual:
  - 🟢 *"Siempre pasar"* (ej. médico): se transfiere tras palabra clave. Sin verificación cruzada.
  - 🟡 *"Pasar tras verificación"* (ej. hijo titular): palabra clave + confirmación por WhatsApp del propio familiar.
  - ⚪ *"Tomar mensaje"* (default — recomendado para nietos, vecinos): no transfiere, te llega el resumen a ti.
- Mínimo 3 contactos para activar el firewall. Recomendado: agrega también el banco oficial y el médico de cabecera con sus números reales.

**Paso 3 — Palabra clave familiar**
- Input con generador de sugerencias *(no obligatorio)*. Hint sobre buenas/malas palabras: *"Algo que solo la familia sepa. Evita el nombre del perro si está en Instagram. Mejor: el chiste interno, el apodo de un fallecido, la frase del abuelo."*
- Permite hasta 3 palabras simultáneas. Hash bcrypt server-side al guardar.
- Slider de rotación recomendada cada 90d.

**Paso 4 — Preguntas de seguridad (KBA)**
- 3 preguntas mínimo, hasta 5. Por cada una: pregunta + lista de respuestas aceptables (sinónimos).
- Validación UI sobre "buenas KBA":
  - ❌ Rechazar / advertir si la pregunta menciona "segundo nombre", "RUT", "fecha de nacimiento", "comuna" — derivable de fuentes públicas.
  - ✅ Sugerir templates: *"¿Cómo le decía [persona] a [otra persona]?"*, *"¿Qué guardaba [persona] en el cajón de su mesa de noche?"*.
- Hash server-side de las respuestas normalizadas.

**Paso 5 — Activación**
- Mostrar el número Twilio Vigía + las instrucciones GSM por operador chileno (Movistar, Entel, WOM, VTR) para activar **desvío de llamadas**:
  - Desvío incondicional: `**21*<numeroVigía>#` — todas las llamadas.
  - Desvío si no contesta: `**61*<numeroVigía>**Xs#` (Xs = segundos).
  - Desvío si está ocupada o sin señal: `**67*` y `**62*` respectivamente.
- Recomendación clara: para MVP "Vigía secretaria" → **desvío incondicional**. La persona protegida deja de contestar el celular; Vigía contesta por ella.
- Botón "ya activé el desvío" envía SMS de prueba al número de María para confirmar.

### 2.2 Dashboard

Vista por defecto post-login. Lista cronológica de llamadas procesadas:

```
┌────────────────────────────────────────────────────┐
│  📞 hace 12 min · +56 9 XXXX XXXX                  │
│  Reclamó ser: nieta · Veredicto: 🚨 SOSPECHOSO     │
│  "Hola abuela, soy Sofía, tuve un accidente..."    │
│  Decisión Vigía: Tomó mensaje, no transfirió.      │
│  [▶ escuchar 0:23] [✓ legítima] [⚠ denunciar]      │
└────────────────────────────────────────────────────┘
```

Cada tarjeta muestra:
- Caller ID + nombre matched o "número desconocido".
- Intent detectado + veredicto Vigía.
- Resumen 3 líneas (lenguaje ciudadano, sin jerga).
- Audio link (signed URL, 30s, expira 24h).
- Decisión (`transfer | message | hangup`) + motivo.
- Citaciones regulatorias del Vishing Analyst si las hubo.
- Acciones del cuidador: marcar legítima (rotación pasiva: si el caller_id repite y el cuidador siempre marca legítima → sugerir agregarlo a whitelist), denunciar (genera template SERNAC pre-llenado vía Denuncia Builder).

Panel lateral con métricas:
- Llamadas filtradas hoy / semana / mes.
- Distribución por veredicto (donut: legit / sospechosa / fraude).
- Top callers spam.

### 2.3 Configuración

Tabs:
- **Whitelist:** lista editable. Cada entrada con cambio de policy, rotación de notes, archivado.
- **Palabra clave:** lista de hashes activos con hint y fecha de creación. Botón "rotar" genera nuevo input + invalida el viejo.
- **KBA:** lista editable de preguntas con respuestas. Velocity counter (cuántas veces se usó cada pregunta).
- **Notificaciones:** toggle Web Push, número WhatsApp del cuidador, número SMS fallback.
- **Persona protegida:** datos básicos.
- **Cuenta:** logout, exportar datos (Ley 21.719 ARCO+ portabilidad), eliminar cuenta (cascade delete).

### 2.4 Alerta en vivo (modal fullscreen)

Cuando hay una llamada activa siendo procesada:

- Push notification dispara (web push + WhatsApp). Si el cuidador tiene la PWA abierta o la abre desde el push:
- **Modal fullscreen** con transcript streaming via SSE desde `apps/api/voice/transcript-stream`:
  ```
  ┌──────────────────────────────────────┐
  │  🔴 LLAMADA EN VIVO · 0:18           │
  │  De: +56 9 XXXX XXXX (no whitelist)  │
  │                                      │
  │  Llamante: "Hola abuela, soy        │
  │  Sofía, tu nieta. Tuve un accidente │
  │  y necesito que me transfieras..."   │
  │                                      │
  │  Vigía: "Antes de pasar contigo,    │
  │  ¿cuál es la palabra clave          │
  │  familiar?"                          │
  │                                      │
  │  Llamante: "Ay no me acuerdo, pero  │
  │  es urgente, pásame con la abuela"  │
  │                                      │
  │  ⚠ FRAUDE ALTA PROBABILIDAD          │
  │                                      │
  │  [tomar control] [colgar ya] [dejar │
  │   que Vigía decida]                  │
  └──────────────────────────────────────┘
  ```
- Botón "tomar control" permite al cuidador hablar con el llamante directamente (Twilio call transfer al móvil del cuidador).
- Si el cuidador no responde en 30s, Vigía decide según protocolo (default conservador: hangup + message).

---

## 3. PWA assets

**`app/manifest.ts`:**
```typescript
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vigía — Cuidador',
    short_name: 'Vigía',
    description: 'Filtro contra estafas telefónicas para tu familia.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0F19',
    theme_color: '#0B0F19',
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['productivity', 'utilities', 'social'],
    lang: 'es-CL',
  };
}
```

**Service worker (`public/sw.js`):** registrado vía `next-pwa` o equivalente liviano. Funciones:
- Recibir Web Push (`pushsubscriptionchange` + `push` events).
- Mostrar notificaciones nativas (`registration.showNotification`).
- Click handler que abre la PWA en `/live/[callSessionId]` o `/dashboard`.
- Cache mínimo de UI shell para offline (solo el chrome, no datos).

**VAPID keys:** generadas en setup, persistidas en env de Vercel + secret de Supabase Edge Function.

---

## 4. Backend — endpoints expuestos por la PWA

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/push/subscribe` | POST | Persiste subscription Web Push del cuidador |
| `/api/push/unsubscribe` | POST | Idem revoke |
| `/api/whitelist` | GET/POST/PATCH/DELETE | CRUD de whitelist con RLS |
| `/api/shared-word` | GET/POST/DELETE | CRUD de shared words (hashed) |
| `/api/kba` | GET/POST/PATCH/DELETE | CRUD de KBA questions |
| `/api/calls` | GET | Listado paginado de `CallSession` con filtros |
| `/api/calls/[id]` | GET | Detalle + signed URL de audio |
| `/api/calls/[id]/feedback` | POST | Cuidador marca legítima / fraude / denunciar |
| `/api/calls/[id]/take-control` | POST | Conecta al cuidador a la llamada activa vía Twilio |
| `/api/voice/transcript-stream` | GET (SSE) | Stream de transcripts en vivo de la llamada activa |
| `/api/export` | POST | Genera ZIP con datos del cuidador (Ley 21.719 ARCO+) |
| `/api/account` | DELETE | Cascade delete del cuidador y dependencias (right to be forgotten) |

Todos con RLS Postgres por `caregiver_id`. Auth Supabase verifica JWT en middleware.

---

## 5. Privacidad y compliance

- **Ley 21.719** ARCO+: la PWA expone export y delete por diseño (Sección 4 endpoints).
- **PII en tránsito:** TLS obligatorio. Vercel + Supabase ya lo proveen.
- **PII en reposo:** shared words y KBA respuestas hasheadas (bcrypt o argon2id). Caller_id se persiste en E.164 sin enmascaramiento porque es necesario para la lógica de whitelist; el cuidador puede ver el caller_id pero NUNCA es expuesto a María.
- **Audios:** TTL 24h, signed URLs expiran al cerrar la página.
- **Transcripts:** redactados por regex PII (RUT, tarjetas, cuentas) antes de persistir.
- **Sesiones:** JWT con expiración 7d, refresh token rotativo.

---

## 6. Out of scope MVP (declarado)

- App nativa Android/iOS — roadmap V2.
- Multi-idioma (es-MX, es-AR, en, pt) — roadmap V2 cuando incorporemos segmento migrantes.
- Multi-cuidador por persona protegida (varios hijos coordinando) — V2.
- Exportación FHIR/HL7 a registros médicos — V2 si entra el segmento de pacientes con cuidador formal.
- Voice cloning detection — out of scope, decisión N4.
- Integración con WhatsApp/Telegram del cuidador para responder al llamante en su nombre — V2.

---

## 7. Defensa Q&A

| Pregunta probable | Respuesta |
|---|---|
| *"¿Por qué PWA y no app nativa?"* | Cero fricción de distribución, no requiere App Store review. Add-to-Home-Screen en iOS y Android queda como ícono indistinguible. Web Push cubre alertas. Para audio capture nativo en Android y otras capabilities, V2 cuando la base de usuarios lo justifique. |
| *"¿Por qué la abuela no usa la app?"* | Diseño deliberado. El segmento adultos mayores 65+ tiene baja adopción de apps nuevas. Vigía se adapta al canal que ya usan (llamada telefónica) y traslada la fricción digital al cuidador, que está mejor equipado. |
| *"¿Y si el cuidador no responde el push?"* | Vigía decide según protocolo deny-by-default: si después de 30s sin respuesta del cuidador y el firewall no autorizó transferencia, toma mensaje y hangup. Default conservador. |
| *"¿Cómo onboarding sin que el cuidador olvide la palabra clave?"* | El sistema persiste un hint solo visible al cuidador, no la palabra plain. Si la olvida y nadie de la familia la sabe, rota a una nueva. Las shared words son rotables por diseño. |
