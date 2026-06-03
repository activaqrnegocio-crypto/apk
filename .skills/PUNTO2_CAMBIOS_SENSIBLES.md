# Punto 2: Reporte de Cambios Sensibles

## Definición de Cambio Sensible

Un **cambio sensible** es cualquier modificación que:
1. Afecta el Service Worker (`custom-sw.js`)
2. Modifica la lógica de sincronización
3. Cambia cómo se guardan los datos offline
4. Altere el flujo de authentication/authorization
5. Modifique el manejo de errores de red

## Cambios que Reportaremos ANTES de implementar

### Nivel ALTO - Reporte Obligatorio

| Cambio | Ubicación | Por qué es sensible |
|--------|-----------|---------------------|
| Routing APK/PWA en Service Worker | `custom-sw.js` | Si falla, sync no funciona |
| Cambios en outbox | `storage.ts` | Si falla, datos se pierden |
| Modificación de sync logic | `sync-processor.ts` | Afecta todas las sincronizaciones |

### Nivel MEDIO - Reporte con anticipación

| Cambio | Ubicación |
|--------|-----------|
| Agregar nuevos campos a IndexedDB | `dexie.ts` |
| Cambiar timing del poller | `custom-sw.js` |
| Modificar estructura de datos sync | `sync-processor.ts` |

### Nivel BAJO - Solo confirmar

| Cambio | Ubicación |
|--------|-----------|
| Configuración de Capacitor | `capacitor.config.ts` |
| Permisos Android | `AndroidManifest.xml` |
| Imports de plugins | Componentes |

## Template de Reporte

```
## Cambio Sensible: [NOMBRE]

### Ubicación
`ruta/del/archivo.ts`

### Qué hace el cambio
[Explicación simple]

### Por qué es necesario
[Razón de negocio]

### Efecto en PWA
[Cómo afecta a la PWA actual]

### Efecto en APK
[Cómo mejora la APK]

### Alternativas considered
[Otras opciones evaluadas]

### Rollback plan
[Cómo revertir si falla]

### Aprobación
[ ] Apruebo este cambio
```

## Ejemplo de Reporte

```
## Cambio Sensible: Routing SQLite en custom-sw.js

### Ubicación
`public/custom-sw.js`

### Qué hace el cambio
Cuando Capacitor.isNativePlatform() es true, el outbox se guarda en SQLite nativo en vez de IndexedDB.

### Por qué es necesario
SQLite nativo es más estable en Android que IndexedDB del WebView, especialmente cuando la app está en background.

### Efecto en PWA
NULO - El routing solo se ejecuta cuando isAndroidNative es true. PWA usa el path original de IndexedDB.

### Efecto en APK
- Datos offline se guardan en SQLite nativo
- Sincronización más confiable en background

### Alternativas considered
1. No hacer nada - seguir con IndexedDB → Sync menos confiable
2. Forzar SQLite para todos → Rompería PWA ❌

### Rollback plan
Cambiar el routing a `false` desactiva SQLite y vuelve a IndexedDB.

### Aprobación
[ ] Proceder
[ ] Modificar
[ ] Cancelar
```

## Frecuencia de Reportes

- **Antes de cada cambio sensible**, enviar reporte
- **Durante la implementación**, reportar progreso
- **Después de implementar**, confirmar que PWA sigue funcionando

## Criterios de Parada

Si en cualquier momento:
1. La PWA muestra errores nuevos
2. La sincronización de PWA falla
3. El Service Worker de PWA no registra correctamente

**SE PARA** inmediatamente y se revierte el último cambio antes de continuar.