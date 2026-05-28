# Plan: Logout + Sync Fix

## 🔴 Problema 1 — La caché no se limpia al cerrar sesión

**Archivo**: `src/components/Sidebar.tsx` — función `handleLogout`

**Estado actual**: Borra parcialmente:
- `Dexie.delete()` en `.then()` sin await → no se completa
- Service Worker NO se desregistra
- Caches `aquatech-static` y `aquatech-fonts` se conservan
- El redirect a login ocurre antes de que termine la limpieza

**Fix**:
1. Convertir a `async/await` completo
2. Desregistrar TODOS los Service Workers
3. Borrar TODOS los caches (sin excepción)
4. Borrar TODAS las bases de datos IndexedDB
5. `localStorage.clear()` + `sessionStorage.clear()`
6. Redirect SOLO después de terminar

---

## 🔴 Problema 2 — Sync indicator verde incorrecto al re-login

**Archivos**: `src/components/GlobalSyncWorker.tsx` + `src/components/ManualSyncButton.tsx`

**Estado actual**:
- Al re-login, el throttle de 30s impide sincronizar inmediatamente
- El `ManualSyncButton` encuentra `cacheMetadata` viejo (de otro usuario) y muestra verde aunque no haya sync fresco

**Fix**:
1. `GlobalSyncWorker`: detectar login fresco (cacheMetadata vacío) → forzar sync sin throttle
2. `ManualSyncButton`: no mostrar verde si los datos de caché son de otro usuario/sesión
3. `ManualSyncButton`: agregar estado `checking` (amarillo) mientras verifica

---

## Orden de implementación

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `Sidebar.tsx` | Logout completo: SW unregister + IndexedDB delete + cache delete + storage clear |
| 2 | `GlobalSyncWorker.tsx` | Forzar sync en login fresco (sin throttle) |
| 3 | `ManualSyncButton.tsx` | Estado checking + no mentir verde |
