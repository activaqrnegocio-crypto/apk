# OPCIÓN 3: Capacitor + Plugins (HÍBRIDO) - GUÍA COMPLETA

> **REGLA PRINCIPAL**: La PWA actual NO se toca. Funciona exactamente como está ahora.

---

## 📋 Resumen

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Crear APK que carga tu PWA + mejoras nativas |
| **Tecnología** | Capacitor + Plugins (SQLite + Background Fetch) |
| **server.url** | Apunta a tu VPS |
| **Resultado** | APK que carga tu PWA tal cual |
| **Offline** | SQLite nativo (más robusto que IndexedDB) |
| **Background Sync** | WorkManager nativo |
| **Deploy** | GitHub → VPS → PWA y APK se actualizan solos |

---

## 🎯 Cómo funciona

```
┌─────────────────────────────────────────────────────────────────┐
│  APK (App Nativa)                                               │
│  ├── server.url = https://tu-vps.com                           │
│  ├── Cuando abre → carga tu PWA completa en WebView            │
│  ├── Plugin SQLite → DB local para offline REAL                │
│  └── Plugin Background Fetch → Sync nativo en segundo plano    │
│                                                                 │
│  Los plugins nativos añaden:                                    │
│  ├── Offline más robusto (SQLite en vez de IndexedDB)         │
│  └── Background sync real (WorkManager en vez de SW polling)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| Service Worker conflict con WebView | Medio | Testing, disable SW si necesario |
| Plugin compatibility | Bajo | Usar plugins oficiales de Capacitor |
| Android kills background | Bajo | WorkManager tiene retry automático |

---

## 📁 Estructura del Proyecto

```
d:\Abel paginas\Aquatech\
├── crm mayo\
│   └── aquatech-render-main\         ← TU PWA (NO SE TOCA) ❌
│
├── aquatech-app-capacitor\            ← NUEVO PROYECTO ✅
│   ├── capacitor.config.ts            # Config con server.url
│   ├── android/                       # Generado por Capacitor
│   ├── src/
│   │   └── index.ts                   # Entry point (mínimo)
│   └── package.json
```

---

## 🔧 Stack Tecnológico

| Componente | Librería | Propósito |
|------------|----------|-----------|
| Contenedor | @capacitor/core | Bridge nativo |
| CLI | @capacitor/cli | Comandos cap |
| DB Offline | @capacitor-community/sqlite | SQLite nativo Android |
| Background Sync | @capacitor-community/background-fetch | WorkManager |
| Push Notifications | @capacitor/push-notifications | Notificaciones |
| Network Status | @capacitor/network | Detectar conexión |
| Splash Screen | @capacitor/splash-screen | Pantalla de inicio |

---

## 📦 Instalación - Paso a Paso

### Paso 1: Crear proyecto

```bash
cd "d:\Abel paginas\Aquatech"

# Crear carpeta para el proyecto
mkdir aquatech-app-capacitor
cd aquatech-app-capacitor

# Inicializar npm
npm init -y
```

### Paso 2: Instalar Capacitor Core y CLI

```bash
npm install @capacitor/core @capacitor/cli
```

### Paso 3: Inicializar Capacitor

```bash
npx cap init "Aquatech CRM" "com.aquatech.crm"
```

**Te preguntará:**
- `npm scripts`: pon `npx cap sync` (o deja vacío)
- `App name`: `Aquatech CRM`
- `Package ID`: `com.aquatech.crm`

### Paso 4: Instalar Plugins

```bash
# Splash Screen
npm install @capacitor/splash-screen

# Status Bar
npm install @capacitor/status-bar

# Push Notifications (para futuro)
npm install @capacitor/push-notifications

# Network Status
npm install @capacitor/network

# SQLite (offline robusto)
npm install @capacitor-community/sqlite

# Background Fetch (sync en segundo plano)
npm install @capacitor-community/background-fetch
```

### Paso 5: Crear capacitor.config.ts

```typescript
// capacitor.config.ts - EN LA RAÍZ DEL PROYECTO
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'Aquatech CRM',
  
  // ═══ MODO SERVER (Carga desde tu VPS) ═══
  server: {
    url: 'https://tu-dominio-o-ip.com', // ⚠️ CAMBIAR A TU URL REAL
    cleartext: false, // HTTPS obligatorio
  },
  
  // ═══ PLUGINS ═══
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#036BB2',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#036BB2',
    },
    BackgroundFetch: {
      minimumFetchInterval: 900, // 15 minutos
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
    },
  },

  // ═══ ANDROID ═══
  android: {
    allowMixedContent: true, // Para cargar de tu servidor
    captureInput: true,
    webContentsDebuggingEnabled: true, // Solo en dev
    backgroundColor: '#036BB2',
    includePlugins: [
      '@capacitor-community/sqlite',
      '@capacitor-community/background-fetch',
      '@capacitor/push-notifications',
      '@capacitor/network',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
    ],
  },
};

export default config;
```

### Paso 6: Agregar Android

```bash
npx cap add android
```

### Paso 7: Sincronizar

```bash
npx cap sync android
```

### Paso 8: Abrir en Android Studio

```bash
npx cap open android
```

En Android Studio puedes:
- Run → Run 'app' (para probar en dispositivo)
- Build → Generate Signed Bundle / APK (para producción)

---

## 🔄 Cómo funciona el Offline en esta opción

### Sin plugins (tu PWA actual):
```
IndexedDB → Puede ser limpiado por Android
Service Worker → Puede ser killed por Android
Polling cada 15s → Gasto de batería
```

### Con Plugin SQLite:
```
SQLite → Base de datos real en dispositivo
         No se limpia, persiste reinicios
         Más robusto que IndexedDB
         Acceso directo a datos
```

### Con Plugin Background Fetch:
```
WorkManager → Sincroniza en segundo plano nativo
              Survive a reinicios del dispositivo
              Se ejecuta aunque app esté cerrada
              Battery optimized por Android
```

---

## 📱 Build y Publicación

### Build de prueba (debug APK):

```bash
# En Android Studio:
# Run → Run 'app' (con dispositivo conectado)
# O Build → Build APK(s) → Debug
```

El APK debug estará en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Build de producción (release):

```bash
# En Android Studio:
# Build → Generate Signed Bundle / APK
# Seleccionar AAB (para Play Store)
# Firmar con keystore
```

El AAB estará en:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Publicar en Play Store:

1. Crear app en [Google Play Console](https://play.google.com/console)
2. Subir `.aab` generado
3. Llenar información de store:
   - Screenshots (teléfono, tablet)
   - Descripción
   - Ícono 512x512
4. Configurar pricing y distribución
5. Enviar a revisión
6. Una vez aprobado, disponible para descarga

---

## 🔄 Flujo de Actualizaciones

### Cambios de código (React, CSS, páginas):

```
1. Haces cambios en tu PWA
2. Deploy normal: GitHub → VPS
3. La APK carga del mismo servidor
4. PWA ve cambios ✅
5. App nativa ve cambios ✅
6. Users NO descargan nada ✅
```

### Cambios nativos (nuevo plugin, nuevo permiso):

```
1. Agregas plugin nuevo en package.json
2. npx cap sync android
3. Build nueva APK/AAB en Android Studio
4. Subes a Play Console
5. Google revisa (horas a días)
6. Users reciben actualización automática
```

---

## ⚠️ Service Worker - Consideraciones

El Service Worker de tu PWA puede conflictuar con el WebView de Capacitor.

**Si hay problemas de carga o plugins no funcionan:**

```typescript
// En capacitor.config.ts
android: {
  webContentsDebuggingEnabled: false, // Cambiar a false en prod
}
```

**Si el SW sigue causando problemas:**
- Considerar deshabilitar SW en la PWA para la versión de la app
- O configurar el SW para que no intercepte requests del WebView

---

## 📋 Checklist de Implementación

```
□ 1. Crear carpeta aquatech-app-capacitor
□ 2. npm init -y
□ 3. npm install @capacitor/core @capacitor/cli
□ 4. npx cap init
□ 5. npm install todos los plugins
□ 6. Crear capacitor.config.ts con tu URL
□ 7. npx cap add android
□ 8. npx cap sync android
□ 9. npx cap open android
□ 10. Probar que la APK carga tu PWA
□ 11. Configurar Splash Screen (color, ícono)
□ 12. Configurar íconos de app (mipmap)
□ 13. Probar offline (desconectar red)
□ 14. Probar background sync
□ 15. Build release APK/AAB
□ 16. Publicar en Play Store
```

---

## ❓ Preguntas para antes de proceder

1. **¿Tu VPS tiene HTTPS válido?** (necesario para que funcione bien)
2. **¿Puedes probar en un dispositivo Android real?** (el emulador no sirve para todo)
3. **¿Tienes keystore de producción?** (para firmar APK de release)
4. **¿Cuál es la URL exacta de tu servidor?** (para配置 server.url)

---

## 📞 Comandos frecuentes

```bash
# Sincronizar cambios web → nativo
npx cap sync

# Solo copiar archivos (sin instalar plugins)
npx cap copy

# Abrir Android Studio
npx cap open android

# Ejecutar en dispositivo
npx cap run android

# Ver estado
npx cap doctor
```

---

*Documento creado: 28 Mayo 2026*
*Opción 3: Capacitor + Plugins (Híbrido)*