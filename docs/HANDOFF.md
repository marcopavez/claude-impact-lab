# HANDOFF.md — Continuar Vigía en otro computador

> **Propósito:** instrucciones para continuar trabajando en este proyecto desde otro computador donde Claude Code Max esté instalado pero no tenga la memoria persistente de la sesión original.

## Qué es lo que viaja en el repo y qué no

**Viaja en el repo (todo en `git pull`):**
- `CLAUDE.md` — operacional del proyecto. Claude Code lo carga automáticamente al iniciar sesión en el repo.
- `docs/EVENT/{BASES,RUBRICA,DATOS,PROBLEMA,README}.md` — texto literal del evento.
- `docs/{IDEA,FICHA-CIVICA,MVP-JUEVES,PLAN-48H,PROMPTS,SUB-CHECKS,THREAT-MODEL,IDENTITY-FIREWALL,CAREGIVER-PWA,HANDOFF}.md` — toda la planificación técnica.
- `docs/MEMORY/*.md` — **copia de la memoria persistente de Claude Code** del computador original. NO se carga automáticamente; hay que bootstrap-earla con el script (siguiente sección).

**No viaja:**
- La memoria activa de Claude Code en el otro computador (parte por par del filesystem local del usuario, no del repo).
- El historial de conversación de la sesión original. No se transfiere.

## Bootstrap en el otro computador (3 pasos)

### 1. Clonar el repo

```bash
git clone https://github.com/marcopavez/claude-impact-lab.git
cd claude-impact-lab
```

### 2. Restaurar la memoria de Claude Code

La memoria de Claude Code vive en `~/.claude/projects/<projectFolder>/memory/` donde `<projectFolder>` es el path absoluto del repo con `\`, `:`, y `/` reemplazados por `-`. El script calcula esto automáticamente.

**Windows (PowerShell):**

```powershell
.\scripts\bootstrap-memory.ps1
```

**Linux / macOS (bash):**

```bash
bash scripts/bootstrap-memory.sh
```

El script:
- Calcula el folder name de Claude Code para el path actual del repo.
- Crea `~/.claude/projects/<projectFolder>/memory/` si no existe.
- Copia todos los `.md` de `docs/MEMORY/` a esa ruta.
- Imprime la ruta destino para verificación.

**Si prefieres hacerlo a mano:**

```bash
# Identifica tu path actual del repo. Ej. en Windows: D:\Repositorios\claude-impact-lab
# Reemplaza \, :, y / por -. Ej. resulta: D--Repositorios-claude-impact-lab
# Copia los archivos:
mkdir -p "$HOME/.claude/projects/<TU-PROJECT-FOLDER>/memory"
cp docs/MEMORY/*.md "$HOME/.claude/projects/<TU-PROJECT-FOLDER>/memory/"
```

### 3. Abrir Claude Code en el repo

```bash
claude
```

(o el comando equivalente de tu instalación.)

Claude Code carga automáticamente `CLAUDE.md`. La memoria que copiaste en el paso 2 estará disponible para Claude desde la primera respuesta.

## Verificación rápida (en la nueva sesión)

Pregunta a Claude:

> *"¿Sabes en qué proyecto estoy trabajando y qué decisiones N1 a N18 están cerradas?"*

Si Claude responde con detalle (Vigía secretaria con firewall de identidad, segmento adultos mayores 65+, las 18 decisiones cerradas, stack Twilio + Deepgram + Polly + PWA cuidador, etc.) → la memoria se cargó correctamente.

Si responde de forma genérica → revisa que `bootstrap-memory` haya corrido sin errores y que los archivos estén en `~/.claude/projects/<projectFolder>/memory/MEMORY.md`.

## Mantener la memoria sincronizada entre computadores

Cuando trabajes en cualquier computador:

1. **Antes de cerrar sesión / cambiar de computador:** copia tu memoria local a `docs/MEMORY/` y commitea.
   - Windows: `Copy-Item "$env:USERPROFILE\.claude\projects\<projectFolder>\memory\*.md" "docs\MEMORY\" -Force`
   - Linux/macOS: `cp ~/.claude/projects/<projectFolder>/memory/*.md docs/MEMORY/`
2. **Al iniciar sesión en otro computador:** `git pull` + corre el script de bootstrap.

Hay un script auxiliar `scripts/sync-memory-to-repo.ps1` / `.sh` que automatiza el paso 1.

## Notas importantes

- **Memoria persistente vs memoria del repo:** la memoria persistente en `~/.claude/...` es la fuente de verdad para Claude Code. `docs/MEMORY/` es un snapshot para portabilidad. Si modificas memoria en una sesión, recordá sincronizarla al repo antes de cambiar de computador.
- **Conflictos al sincronizar entre computadores:** si trabajaste en dos computadores en paralelo y ambos modificaron memoria, los archivos `.md` van a tener merge conflicts en git. Revisa cada uno y consolida antes de commitear.
- **No commitees `.env`** ni archivos con secrets. El repo solo contiene `.env.example`.
- **Sesiones nuevas en el mismo repo recogen automáticamente la memoria local**, no necesitan bootstrap. El script es solo para el primer setup en un computador nuevo.

## Estado actual del proyecto al momento del handoff

- **Pivote phone-first cerrado.** Vigía es secretaria con firewall de identidad, no asistente WhatsApp/web genérico.
- **Segmento único MVP:** adultos mayores 65+ Chile (~2.4M).
- **18 decisiones técnicas cerradas** (N1-N18) documentadas en `docs/THREAT-MODEL.md` §9 y `docs/MEMORY/project_decisions_locked.md`.
- **Stack confirmado:** Twilio Programmable Voice + Media Streams + Deepgram Nova-3 (default) + whisper.cpp local (fallback) + Twilio Polly Lupe-Neural + Sonnet 4.6/Opus 4.7/Haiku 4.5 + PWA Next.js installable + Supabase + WhatsApp Cloud API.
- **Identity Firewall** documentado en `docs/IDENTITY-FIREWALL.md` con 4 niveles, schemas, política configurable per-contacto.
- **PWA Cuidador** especificada en `docs/CAREGIVER-PWA.md`.
- **Threat model v0.2 phone-first** con 22 vectores (V1-V22) en `docs/THREAT-MODEL.md`.
- **Set golden adversarial draft** ≥35 inputs phone-first esbozado en `docs/THREAT-MODEL.md` §8 — pendiente concretar inputs y expected outputs.
- **Pre-ventana:** sigue habiendo restricción de NO emitir calls al API Anthropic ni commitear código de aplicación antes de la apertura de ventana de build (`feedback_build_window.md` en memoria).
- **Próximo bloque técnico sugerido (a elección de Marco):** (a) contratos entre agentes a nivel implementación con JSON schemas y tool definitions; (b) profundización Twilio Media Streams + WebSocket relay + frame buffering; (c) concretar set golden adversarial con expected outputs.
