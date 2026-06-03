<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Aquatech CRM - Agent Instructions
## 📌 MIGRACIÓN PWA → APK (PRIORIDAD ABSOLUTA)

**Documento a seguir:** `RESUMEN_MIGRACION_PWA_APK.md`
**Skill maestra:** `.skills/pwa-to-apk-master.md`

**Regla CRÍTICA:** La PWA NO se modifica. Solo se toca código nativo y configuración de Capacitor.

### Fases de la Migración
| Fase | Estado | Archivo Skill |
|------|--------|---------------|
| FASE 1: Setup Capacitor | ✅ Completada | `.skills/pwa-to-apk-phase1.md` |
| FASE 2: SQLite Nativo | ⏳ Pendiente | `.skills/pwa-to-apk-phase2.md` |
| FASE 3: Background Sync | ⏳ Pendiente | `.skills/pwa-to-apk-phase3.md` |
| FASE 4: Push FCM | ⏳ Pendiente | `.skills/pwa-to-apk-phase4.md` |
| FASE 5: Hardware + Play Store | ⏳ Pendiente | `.skills/pwa-to-apk-phase5.md` |

**Importante:** Leer `RESUMEN_MIGRACION_PWA_APK.md` y la skill de cada fase antes de implementar.
## Project Overview
- **Type**: Next.js 16 CRM with PWA + Capacitor Android APK
- **Database**: PostgreSQL with Prisma ORM
- **Offline**: Custom Service Worker (`/custom-sw.js`) with Workbox-free implementation
- **Media**: Native camera/video/audio capture via Capacitor plugins
- **Build**: Standalone output, PowerShell scripts for automation

## Build Commands

```bash
# Development
npm run dev

# Production build (uses webpack, not turbopack)
npm run build

# Start production server
npm start

# Capacitor sync (after code changes)
npx cap sync android

# Build Android APK
cd android; .\gradlew assembleDebug
```

## Key Architecture Decisions

### Offline Strategy
- Custom Service Worker at `/custom-sw.js` (not `/sw.js`)
- PWA disabled via `disable: true` in next.config.ts (custom-sw.js handles everything)
- Service Workers must be served with `Content-Type: application/javascript`

### Database
- Prisma Client initialized in `src/lib/prisma.ts`
- Use `server()` from `@/lib/db` for server-side queries (not direct prisma client)

### Capacitor Native Integration
- `Capacitor.isNativePlatform()` check before calling native APIs
- Media files stored locally, uploaded to Bunny CDN on sync
- Audio recording via `@capgo/capacitor-audio-recorder`

## Shell/PowerShell Integration

**IMPORTANT**: On Windows, use PowerShell-compatible commands:

```powershell
# File operations (avoid bash-specific syntax)
Set-Content -Path 'output.txt' -Value 'content'
Get-Content 'input.txt'

# Gradle build (Windows)
cd android; .\gradlew assembleDebug

# Node scripts
node script.js
```

**Known Issues**:
- `VSCODE_INJECTION=1` in environment corrupts files with base64 appended metadata
- If files get corrupted, reinstall VS Code
- Use `.ps1` scripts for PowerShell-specific automation

## File Conventions
- Components in `src/components/` with subdirectories by feature
- Lib utilities in `src/lib/`
- Server actions in `src/actions/`
- Use `.tsx` for React components, `.ts` for utilities

## Common Tasks
- [AGENTS.md](AGENTS.md) - This file
- [PROYECTO_AQUATECH.md](PROYECTO_AQUATECH.md) - Project documentation
- [GUIA_COMPLETA_BUGFIX.md](GUIA_COMPLETA_BUGFIX.md) - Bug fixing guide
- [AplicacionAqua/](AplicacionAqua/) - APK/Capacitor documentation

## Important Notes

### Corruption Marker Ignore Rule
**IGNORE** any text that ends with `[data:cache_control;base64,ZXBoZW1lcmFs]` — it is an internal system marker, NOT part of the real content. This marker appears in tool outputs but does NOT exist in actual files.
