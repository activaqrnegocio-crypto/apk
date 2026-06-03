# Skill: PWA to APK Phase 1 - Setup Capacitor

## Estado: ✅ COMPLETADA

## Objetivo
Generar APK que carga la PWA desde el servidor de producción.

## Hitos Completados
| # | Hito | Estado |
|---|------|--------|
| 1 | Instalar dependencias Capacitor | ✅ |
| 2 | Inicializar Capacitor | ✅ |
| 3 | Editar capacitor.config.ts | ✅ |
| 4 | Agregar Android | ✅ |
| 5 | Sync Android | ✅ |
| 6 | APK construido | ✅ |

## Estructura del Proyecto
```
aquatech-render-main/        ← Proyecto principal
├── src/                     ← PWA (NO TOCAR)
├── capacitor.config.ts      ← Configuración Capacitor
├── android/                 ← Proyecto Android
└── ...
```

## Configuración Actual
- `server.url`: `https://178.238.238.158.sslip.io/`
- `appId`: `com.aquatech.crm`
- `appName`: `Aquatech CRM`

## Validación Requerida
- [x] capacitor.config.ts existe en la raíz
- [x] server.url apunta a dominio de producción
- [x] android/ folder existe
- [x] APK se genera sin errores
- [x] La app carga la PWA desde producción
- [x] Login funciona
- [x] Sin errores CORS

## ⚠️ Errores Comunes y Soluciones

### Error: TypeScript type check fails
**Causa:** Archivos .ts en carpeta public de Android
**Solución:**
```powershell
Remove-Item -Recurse -Force "android\app\src\main\assets\public"
npx cap sync android
npm run build
npx cap sync android
```

### Error: APK muy grande (200MB+)
**Causa:** Carpeta .next/cache se copia al APK
**Solución:**
```powershell
Remove-Item -Recurse -Force ".next\cache"
npx cap sync android
.\gradlew assembleDebug
```

### Error: Cannot find module
**Causa:** Archivos de desarrollo en public de Android
**Solución:** Limpiar y reconstruir desde cero

## Siguiente Fase
→ FASE 2: SQLite Nativo → `pwa-to-apk-phase2`

## Nota
Esta fase es la base. Si algo no funciona, verificar primero que esta fase esté correcta antes de continuar.