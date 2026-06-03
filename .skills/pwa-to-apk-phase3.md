# Skill: PWA to APK Phase 3 - Background Sync

## Estado: ✅ COMPLETADA

## Objetivo
Procesar outbox de sincronización aunque la app esté cerrada o Android haya matado el proceso.

## Problema que Resuelve
El SW poller (15s) muere cuando Android mata el proceso → operador no ve su trabajo reflejado hasta reabrir app

## Arquitectura Coexiste
- **custom-sw.js (v377)** → Procesa outbox cuando app está en primer plano
- **Background Fetch nativo** → Procesa cuando app está en background o cerrada
- Ambos usan el mismo outbox SQLite + idempotencia (SyncLog)

## Pasos a Seguir

### 1. Instalar Plugin Background Runner
```bash
npm install @capacitor/background-runner
npx cap sync android
```

### 2. Configurar Android Manifest
Agregar permisos en `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

### 3. Crear Service de Background
Crear lógica que se ejecuta cuando el background runner despierta

### 4. Implementar SyncProcessor
```typescript
// src/lib/sync-processor.ts
// Mapea OutboxItem → endpoint API
// Lee de SQLite nativo (Fase 2)
// Procesa y marca como synced
```

## Validación Requerida
- [ ] Sin conexión + mensaje agregado → sale cuando reconnecta
- [ ] App en background + mensaje offline → sale correctamente
- [ ] App cerrada completamente + mensaje offline → Background Fetch lo procesa
- [ ] Reiniciar dispositivo sin abrir app → Background Fetch se ejecuta
- [ ] Sin duplicados en servidor (SyncLog funciona)

## Checklist de Implementación
- [ ] Plugin instalado (`@capacitor/background-runner`)
- [ ] Permisos en AndroidManifest.xml
- [ ] Lógica de background sync implementada
- [ ] Prueba en dispositivo real (cerrar app completamente)
- [ ] Verificar que no hay duplicados (SyncLog)

## Siguiente Fase
→ FASE 4: Push FCM → `pwa-to-apk-phase4`

## Nota
El Service Worker sigue activo para la PWA. El background runner es adicional para Android cuando la app está cerrada.