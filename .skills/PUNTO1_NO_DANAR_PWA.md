# Punto 1: NO DAÑAR LA PWA

## Principio Fundamental

**LA PWA DEBE FUNCIONAR EXACTAMENTE IGUAL ANTES Y DESPUÉS DE LA MIGRACIÓN**

## Cómo lo aseguramos

### Código Compartido vs Código Específico

| Tipo | Ubicación | Ejemplo |
|------|-----------|---------|
| Compartido | `src/components/*`, `src/lib/*` | Solo se lee, no se cambia lógica PWA |
| Compartido con routing | `custom-sw.js`, `storage.ts` | Se agrega `if (Capacitor.isNativePlatform())` |
| APK only | `src/lib/native-sqlite.ts` | Solo se usa cuando `Capacitor.isNativePlatform()` es true |
| Configuración | `capacitor.config.ts` | Solo afecta a Android Studio, no a Next.js |

### Estrategia de Cambios "Safe"

```typescript
// ❌ NO HACER - Esto rompería la PWA
const db = new SQLiteDatabase();

// ✅ HACER - Solo afecta APK, PWA sigue igual
if (Capacitor.isNativePlatform()) {
  const db = new SQLiteDatabase(); // Solo para APK
} else {
  const db = indexedDB.open('aquatech'); // PWA sigue igual
}
```

### Lo que NO se toca

- ❌ `src/app/**` - Rutas de Next.js
- ❌ `src/components/**` - Componentes UI (excepto para agregar botones nativos APK)
- ❌ `src/actions/**` - Server Actions
- ❌ Base de datos del servidor (Prisma/PostgreSQL)
- ❌ `src/lib/db.ts` - Cliente Prisma
- ❌ `src/lib/dexie.ts` - Definición de IndexedDB

### Lo que SÍ se puede tocar con cuidado

- ⚠️ `public/custom-sw.js` - Service Worker (agregar routing APK/PWA)
- ⚠️ `src/lib/storage.ts` - Agregar fallback para SQLite
- ⚠️ `src/lib/sync-processor.ts` - Detectar plataforma para sync

### Validación Obligatoria

Antes de cada sesión:
1. Abrir PWA en Chrome (incógnito)
2. Probar funcionalidad core: login, crear proyecto, chat, sincronización
3. Verificar que NO hay errores en consola
4. Solo después de validar PWA, proceder con cambios APK

## Regla de Oro

> "Si un cambio afecta a la PWA, NO se hace. Buscar alternativa que solo afecte APK."

## Checklist PWA Safety

- [ ] Login funciona en PWA
- [ ] Crear proyecto funciona en PWA
- [ ] Chat funciona en PWA
- [ ] Galería sube archivos en PWA
- [ ] Sync de offline a online funciona en PWA
- [ ] Sin errores en consola de Chrome