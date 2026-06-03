# Skill: PWA to APK Phase 2 - SQLite Nativo

## Estado: ⏳ PENDIENTE

## Objetivo
Reemplazar Dexie/IndexedDB por SQLite nativo Android para persistencia robusta.

## Problema que Resuelve
Android puede limpiar IndexedDB bajo presión de memoria → destruye el outbox de sincronización

## Arquitectura Coexiste
- **PWA/iOS:** Sigue usando Dexie/IndexedDB
- **Android:** Usa SQLite nativo via `@capacitor-community/sqlite`

## Pasos a Seguir

### 1. Instalar Plugin SQLite
```bash
npm install @capacitor-community/sqlite
npx cap sync android
```

### 2. Crear Capa de Abstracción
Crear `src/lib/native-storage.ts` con la misma interfaz que Dexie:
- `storage.addToOutbox(item)`
- `storage.getOutbox()`
- `storage.removeFromOutbox(id)`
- `storage.clearOutbox()`

### 3. Detectar Plataforma
```typescript
import { Capacitor } from '@capacitor/core';

const useNativeStorage = Capacitor.isNativePlatform();
```

### 4. Implementar Fallback
```typescript
// Si no hay SQLite nativo, usar Dexie como fallback
const storage = useNativeStorage ? nativeStorage : dexieStorage;
```

## Validación Requerida
- [ ] DB SQLite creada en primer arranque sin errores
- [ ] Item en outbox persiste al matar y reabrir app
- [ ] Datos sobreviven a presión de memoria desde Android Studio

## Checklist de Implementación
- [ ] Plugin instalado (`@capacitor-community/sqlite`)
- [ ] `src/lib/native-storage.ts` creado
- [ ] Integración con custom-sw.js para usar SQLite en Android
- [ ] Prueba en dispositivo real

## Siguiente Fase
→ FASE 3: Background Sync → `pwa-to-apk-phase3`

## Nota
El Service Worker (`custom-sw.js`) sigue usando Dexie para iOS/PWA. Solo Android usa SQLite nativo.