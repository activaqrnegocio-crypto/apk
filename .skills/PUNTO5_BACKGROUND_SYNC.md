# Punto 5: Sincronización en Segundo Plano (Background Sync)

## Entendiendo la Sincronización Actual

### Cómo funciona en PWA

La PWA ya tiene un sistema de sync robusto:

1. **Cuando la app está ABIERTA** (`GlobalSyncWorker`):
   - Cada acción guarda en `outbox` (IndexedDB)
   - Cada 30 segundos verifica si hay pendientes
   - Si hay red, sube todo automáticamente
   - Si no hay red, espera y reintenta con exponential backoff

2. **Cuando la app está CERRADA**:
   - Service Worker hace polling cada 15 segundos
   - Si detecta pendientes, intenta subir
   - **PERO** - en móviles, el Service Worker puede ser detenido por el SO

3. **BackgroundFetch API** (para archivos grandes):
   - Las fotos/videos se suben usando BackgroundFetch
   - Funciona incluso si la pestaña se cierra

### Limitaciones Actuales en APK

| Aspecto | PWA | APK (actual) |
|---------|-----|--------------|
| Sync con app abierta | ✅ GlobalSyncWorker | ✅ GlobalSyncWorker |
| Sync con app cerrada | ⚠️ SW polling (puede ser detenido) | ⚠️ SW polling |
| Archivos grandes | ✅ BackgroundFetch | ❌ No funciona bien |
| Notificaciones de progreso | ✅ In-app | ❌ No hay |

## Objetivo: Background Runner

**Background Runner** permite que la APK sincronice incluso cuando está cerrada.

### Qué hace Background Runner

El plugin `@capacitor/background-runner`:
- Despierta la app periódicamente (ej: cada 15 minutos)
- Ejecuta código JavaScript mientras está en background
- Usa WorkManager de Android (no se detiene fácilmente)

### Lo que NO reemplazamos

❌ No reemplazamos GlobalSyncWorker
❌ No reemplazamos el sistema de sync de la PWA
❌ No cambiamos la lógica de reintentos/backoff

### Lo que SÍ hacemos

✅ Agregamos Background Runner como trigger alternativo
✅ Cuando el Runner despierta → llama a la misma función de sync
✅ Los archivos grandes siguen usando BackgroundFetch (del navegador)

## Arquitectura de Sync Resultante

```
                    ┌─────────────────────────────────────────┐
                    │                 APK                      │
                    └─────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
    ┌─────┴─────┐           ┌───────┴───────┐           ┌─────┴─────┐
    │ App ABIERTA│           │  App CERRADA  │           │  App en   │
    │           │           │               │           │  BACKGROUND│
    └─────┬─────┘           └───────┬───────┘           └─────┬─────┘
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│ GlobalSyncWorker│     │   custom-sw.js      │     │ BackgroundRunner│
│ (polling 30s)   │     │   (polling 15s)     │     │ (cada 15 min)   │
│                 │     │   ⚠️ Puede ser      │     │                 │
│                 │     │   detenido por SO  │     │ Despierta app   │
└────────┬────────┘     └──────────┬──────────┘     └────────┬────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │       OUTBOX              │
                    │  (SQLite nativo en APK)   │
                    │  (IndexedDB en PWA)        │
                    └──────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
              ┌─────────┐                   ┌─────────┐
              │ BunnyCDN│                   │  VPS    │
              │ (files) │                   │  (API)  │
              └─────────┘                   └─────────┘
```

## Lo que el usuario nota

| Escenario | PWA | APK (con Background Runner) |
|-----------|-----|----------------------------|
| App abierta - datos suben | ✅ Automático | ✅ Automático |
| App cerrada - datos suben | ⚠️ Puede no sync | ✅ Background Runner |
| App recibe push - sincroniza | ✅ | ✅ |
| Muchos datos pendientes - sync | ✅ | ✅ Mejor |
| App abierta después de estar cerrada | Sincroniza | Sincroniza + Background Runner ayudó |

## Beneficio Real

**El sync es más confiable en APK** porque:
1. Background Runner despierta la app periódicamente
2. Even when GlobalSyncWorker fails, Background Runner ensures sync
3. SQLite keeps outbox safe even if app is killed

## Cómo minimizamos trabajo

### NO Reimplementamos

❌ No creamos nueva lógica de sync
❌ No cambiamos las funciones de upload
❌ No cambiamos el manejo de errores o reintentos
❌ No cambiamos el servidor

### SÍ Conectamos

✅ Background Runner → llama a `processOutboxSync()` existente
✅ SQLite outbox → misma función de sync del servidor
✅ El mismo código que funciona en PWA, funciona en APK

## Hitos de Implementación

### Hito 5.1: Configurar Background Runner
- Crear `src/lib/background-task.ts` con el task a ejecutar
- Registrar task en `capacitor.config.ts`
- Configurar intervalo en AndroidManifest

### Hito 5.2: Conectar con sync existente
- El task de Background Runner simplemente llama a `processOutboxSync()`
- No hay lógica nueva, solo un nuevo trigger

### Hito 5.3: Testear en dispositivo
- Cerrar app completamente
- Crear datos offline
- Esperar 15 minutos
- Abrir app → verificar que sincronizó

## Checklist de Validación

- [ ] PWA sync funciona igual que antes
- [ ] APK sync cuando app está abierta
- [ ] APK sync cuando app está cerrada (Background Runner)
- [ ] No hay datos perdidos en outbox
- [ ] Sincronización igual de rápida que PWA

## Nota sobre BackgroundFetch

El BackgroundFetch para archivos grandes **ya existe** en el custom-sw.js de la PWA.

En APK:
- Los archivos pequeños (<1MB) suben con GlobalSyncWorker
- Los archivos grandes siguen usando BackgroundFetch API del navegador
- Background Runner ayuda a mantener el sync activo

**No necesitamos implementar nada extra para archivos** - el código existente de la PWA funciona.