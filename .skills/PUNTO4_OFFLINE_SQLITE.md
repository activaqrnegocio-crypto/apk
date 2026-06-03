# Punto 4: Offline en APK - SQLite vs IndexedDB

## Pregunta: ¿Qué es "offline nativo"?

Hay dos conceptos que a veces se confunden:

### 1. Offline de datos (qué datos tienes disponibles sin internet)
- **PWA**: Usa IndexedDB (Dexie) para guardar datos localmente
- **APK**: Puede usar SQLite nativo para guardar datos
- Ambos permiten que la app funcione sin internet

### 2. Offline de archivos (fotos, videos, audios)
- **PWA**: Guarda en IndexedDB (lento para archivos grandes)
- **APK**: Guarda en el filesystem del teléfono (más rápido, más espacio)
- Ya implementado con `@capacitor/filesystem`

## La verdad sobre SQLite en esta APK

### Lo que NO es SQLite
❌ SQLite NO es "offline más poderoso"
❌ SQLite NO reemplaza IndexedDB para todo
❌ SQLite NO hace que la app funcione offline automáticamente

### Lo que SÍ es SQLite
✅ SQLite es una base de datos local más ESTABLE que IndexedDB
✅ SQLite sobrevive mejor cuando el WebView se cierra/crash
✅ SQLite tiene mejor rendimiento para queries complejos
✅ SQLite consume menos memoria que IndexedDB

## Cuándo importa SQLite

| Escenario | IndexedDB (PWA) | SQLite (APK) |
|----------|-----------------|--------------|
| App en foreground | ✅ Bien | ✅ Mejor |
| App en background | ⚠️ Puede perder datos si WebView crash | ✅ Más seguro |
| Mucho tráfico de datos | ⚠️ Puede ralentizar | ✅ Más rápido |
| Sincronización compleja | ✅ Bien | ✅ Mejor |
| Consulta offline de datos | ✅ Bien | ✅ Bien |

## Lo que realmente haremos

**MINIMIZAR TRABAJO** - No cambiaremos todo el sistema offline.

### Mantenemos:
- ✅ IndexedDB (Dexie) para la mayoría de datos
- ✅ Sistema de sync existente
- ✅ Service Worker para cache

### Agregamos:
- **SQLite SOLO para el OUTBOX** (cola de sincronización)
- El outbox es la parte más crítica - si se pierde, se pierden datos
- SQLite nativo es más seguro que IndexedDB para el outbox

### NO Agregamos:
❌ No reescribimos toda la base de datos a SQLite
❌ No cambiamos cómo se guardan proyectos, clientes, etc.
❌ No creamos una nueva capa de datos

## Arquitectura Resultante

```
┌─────────────────────────────────────────────────────────────┐
│                      APK (Android)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐     ┌─────────────────────────────────┐   │
│   │  SQLite     │     │  IndexedDB (Dexie)              │   │
│   │  OUTBOX     │     │  - Proyectos                    │   │
│   │  (nativo)   │     │  - Clientes                      │   │
│   └─────────────┘     │  - Chat messages                 │   │
│        ↓              │  - Galleries                     │   │
│   Background Runner    └─────────────────────────────────┘   │
│   (sync cuando cerrado)        ↓                            │
│                               GlobalSyncWorker               │
│                               (sync cuando abierto)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Lo que el usuario ve

| Escenario | PWA | APK |
|-----------|-----|-----|
| Sin internet - crear proyecto | ✅ Funciona | ✅ Funciona |
| Sin internet - ver proyectos | ✅ Funciona | ✅ Funciona |
| Sin internet - chat | ✅ Funciona | ✅ Funciona |
| Recupera internet | ✅ Sincroniza | ✅ Sincroniza |
| App en background | ⚠️ Puede perder outbox | ✅ Outbox seguro en SQLite |

## Beneficio Real para el Usuario

**El usuario NO nota diferencia** en el uso normal.
La diferencia está en:
- Menos pérdidas de datos si la app se cierra inesperadamente
- Mejor manejo de sincronización cuando hay muchas notificaciones/updates

## Hitos de Implementación

### Hito 4.1: Crear src/lib/native-sqlite.ts
- Conectar con `@capacitor-community/sqlite`
- Exponer funciones: `addToOutbox()`, `getPending()`, `markProcessed()`

### Hito 4.2: Modificar custom-sw.js
- Agregar `isAndroidNative = Capacitor.isNativePlatform()`
- Hacer routing: SQLite para APK, IndexedDB para PWA

### Hito 4.3: Probar offline
- Cerrar app → abrir sin internet → crear datos
- Reconectar → verificar que sincroniza

## Miedo: ¿Romperá la PWA?

**NO** - El routing es:
```javascript
if (Capacitor.isNativePlatform()) {
  // SQLite (APK only)
} else {
  // IndexedDB (PWA) - exactamente igual que antes
}
```