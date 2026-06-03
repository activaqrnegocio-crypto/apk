# Skill: PWA to APK Migration Master Plan

## Propósito
Esta es la skill MADRE que orchestration toda la migración de PWA a APK híbrida para Aquatech CRM.

## Documento Fuente
`RESUMEN_MIGRACION_PWA_APK.md` - Leer ANTES de comenzar cualquier fase.

## Reglas CRÍTICAS de la Migración
1. **La PWA NO se modifica** - Funciona exactamente como está
2. **Nunca saltar fases** - Cada fase depende de la anterior
3. **Nunca ejecutar fase sin validar anterior** - Cada fase tiene validación obligatoria
4. **No tocar el Service Worker** - Sigue activo y procesa outbox cuando puede
5. **FCM solo para Android** - iOS/PWA sigue con VAPID
6. **No dejar keystore en repo** - Debe guardarse en lugar seguro
7. **No publicar sin testing en dispositivo real** - Emulador no es suficiente

## Arquitectura de la Solución
- **PWA** → Vive en VPS, funciona igual que antes
- **APK** → WebView nativo que carga la PWA desde producción
- **Plugins nativos** → SQLite, Background Sync, GPS, Cámara, FCM
- **Un único deploy** → GitHub → VPS actualiza ambos

## Fases de la Migración

### ✅ FASE 1: Setup Capacitor (COMPLETADA)
- Objetivo: Generar APK que carga la PWA desde el servidor de producción
- Estado: **COMPLETADA**
- Validación: APK existe, apunta a producción, PWA intacta
- Skill: `pwa-to-apk-phase1`

### ⏳ FASE 2: SQLite Nativo
- Objetivo: Reemplazar Dexie/IndexedDB por SQLite nativo Android
- Resuelve: Android puede limpiar IndexedDB bajo presión de memoria
- Skill: `pwa-to-apk-phase2`

### ⏳ FASE 3: Background Sync
- Objetivo: Procesar outbox aunque la app esté cerrada o Android haya matado el proceso
- Resuelve: SW poller (15s) muere cuando Android mata el proceso
- Skill: `pwa-to-apk-phase3`

### ⏳ FASE 4: Push FCM
- Objetivo: Notificaciones push confiables en Android
- Resuelve: Notificaciones no llegan cuando app está cerrada
- Skill: `pwa-to-apk-phase4`

### ⏳ FASE 5: Hardware Nativo + Play Store
- Objetivo: GPS, cámara, filesystem nativo y publicación
- Resuelve: Acceso a hardware nativo y publicación en Play Store
- Skill: `pwa-to-apk-phase5`

## Workflow para continuar migración
1. Leer `RESUMEN_MIGRACION_PWA_APK.md`
2. Identificar siguiente fase pendiente
3. Leer skill de esa fase
4. Implementar según instrucciones
5. Validar según checklist de la fase
6. Actualizar estado en AGENTS.md
7. Continuar con siguiente fase

## Nota sobre el proyecto actual
- El proyecto ya tiene FASE 1 completada (Capacitor instalado y funcionando)
- APK actual carga PWA desde `https://178.238.238.158.sslip.io/`
- Lo único modificado son archivos de configuración, NO la PWA