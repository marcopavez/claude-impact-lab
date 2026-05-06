This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Audios demo (ElevenLabs TTS)

Vigía renderiza los 3 escenarios canónicos del PLAN N19 (cuento del tío + banco oficial + familiar legítimo) más 2 extras opcionales (oracle attack + voice clone con whitelist) a `public/demo-audios/<id>.mp3`. Los textos viven en `data/scripts/scams.json` y derivan del golden set adversarial (`apps/eval/golden-set/triage.jsonl`).

### Setup

1. Copiá `.env.example` (raíz del repo) a `apps/web/.env.local` y completá `ELEVENLABS_API_KEY`.
2. Asegurate de tener `tsx` disponible (`npm i -g tsx` o vía workspace).

### Elegir voces es-CL / es-LA

ElevenLabs no etiqueta voces como `es-CL` directamente. Listá las voces de tu cuenta filtradas por idioma español o acento latino:

```bash
npm run voices:list
npm run voices:list -- chilean   # filtra por término
npm run voices:list -- mauro
```

Copiá los `voice_id` que prefieras a `data/scripts/scams.json` reemplazando los placeholders `REPLACE_WITH_*`.

### Renderizar audios

```bash
npm run render:scams              # solo los 3 default (canónicos PLAN.md N19)
npm run render:scams -- --all     # incluye los 2 extras (oracle, voice clone)
npm run render:scams -- --id cuento-del-tio  # uno específico
npm run render:scams -- --force   # re-renderiza aunque exista
```

Modelo TTS por defecto: `eleven_v3`. Output: `public/demo-audios/<id>.mp3`. El script es idempotente (skip si el archivo ya existe sin `--force`).

> **Importante**: el primer call al API ocurre dentro de la ventana de build (≥ 6-may 00:00). Activa el sub-check **B3** (consola Anthropic / ElevenLabs con uso real durante la ventana). No correr antes.
