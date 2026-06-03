# Skill: PWA to APK Phase 6 - Integración SQLite + Background Runner

## Estado: ⏳ PENDIENTE

## Objetivo
Integrar SQLite nativo y Background Runner con el custom-sw.js para que el APK funcione offline correctamente.

## Problema que Resuelve
Los plugins están instalados (fases 2 y 3) pero no están integrados con el custom-sw.js que es quien maneja el outbox de sincronización.

## Arquitectura
- **custom-sw.js** → Necesita detectar `Capacitor.isNativePlatform()` y usar:
  - `native-storage.ts` en vez de `db.outbox` (Dexie) para Android
  - El Background Runner para procesar outbox cuando la app está cerrada

## Pasos a Seguir

### 1. Modificar custom-sw.js para detectar plataforma nativa

En la sección de imports/variables del custom-sw.js, agregar:

```javascript
// Detectar si es Android nativo
var isAndroidNative = false;
if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform) {
  isAndroidNative = window.Capacitor.isNativePlatform();
}
```

### 2. Crear puente JavaScript -> Native Storage

```javascript
// En custom-sw.js - funciones para interactuar con SQLite nativo
async function nativeAddToOutbox(item) {
  if (!isAndroidNative) return false;
  try {
    await window.Capacitor.Plugins.CapacitorSQLite.execute({
      statement: 'INSERT INTO outbox (id, type, payload, createdAt) VALUES (?, ?, ?, ?)',
      values: [item.id, item.type, JSON.stringify(item.payload), item.createdAt]
    });
    return true;
  } catch (e) {
    console.error('[SW] nativeAddToOutbox error:', e);
    return false;
  }
}

async function nativeGetOutboxPending() {
  if (!isAndroidNative) return [];
  try {
    const result = await window.Capacitor.Plugins.CapacitorSQLite.query({
      statement: 'SELECT * FROM outbox WHERE processed = 0 ORDER BY createdAt ASC'
    });
    return result.values.map(row => ({
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload),
      createdAt: row.createdAt
    }));
  } catch (e) {
    console.error('[SW] nativeGetOutboxPending error:', e);
    return [];
  }
}

async function nativeMarkOutboxProcessed(id) {
  if (!isAndroidNative) return;
  try {
    await window.Capacitor.Plugins.CapacitorSQLite.execute({
      statement: 'UPDATE outbox SET processed = 1 WHERE id = ?',
      values: [id]
    });
  } catch (e) {
    console.error('[SW] nativeMarkOutboxProcessed error:', e);
  }
}
```

### 3. Modificar processOutboxSync para usar el storage correcto

En `_internalProcessOutbox`, en vez de:
```javascript
const pending = await db.outbox.where('status').equals('pending').toArray();
```

Usar:
```javascript
let pending;
if (isAndroidNative) {
  pending = await nativeGetOutboxPending();
} else {
  pending = await db.outbox.where('status').equals('pending').toArray();
}
```

### 4. Modificar donde se agrega al outbox

Reemplazar:
```javascript
await db.outbox.add({...})
```

Con:
```javascript
const outboxItem = {...};
if (isAndroidNative) {
  await nativeAddToOutbox(outboxItem);
} else {
  await db.outbox.add(outboxItem);
}
```

### 5. Configurar Background Runner para procesar outbox

En `src/lib/background-service.ts` (ya existe), asegurar que se llame `processOutboxSync` cuando el background despierta.

## Checklist de Implementación
- [ ] Detectar `Capacitor.isNativePlatform()` en custom-sw.js
- [ ] Implementar `nativeAddToOutbox()`, `nativeGetOutboxPending()`, `nativeMarkOutboxProcessed()`
- [ ] Modificar `_internalProcessOutbox` para usar storage según plataforma
- [ ] Modificar todos los `db.outbox.add()` para routing Android/nativo
- [ ] Integrar Background Runner con processOutboxSync
- [ ] Rebuild APK y probar en dispositivo

## Siguiente Fase
→ FASE 5: Hardware + Play Store

## Nota
Esta es la fase CRÍTICA que une todo. Sin esta integración, los plugins de SQLite y Background Runner están instalados pero no hacen nada.
