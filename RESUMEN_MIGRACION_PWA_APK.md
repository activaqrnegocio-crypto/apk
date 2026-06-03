# PWA → APK: RESUMEN DE MIGRACIÓN AQUATECH CRM
## Análisis de Documentos de Plan de Migración

**Fecha:** 30 Mayo 2026  
**Fuente:** Documentos en `pwa a apk/`

---

## 📋 CONCLUSIONES GENERALES

### ¿Qué es esto?
Migração de la PWA existente a APK nativa via **Capacitor** (opción híbrida). Se envuelve la PWA en un WebView nativo Android, agregando:
- SQLite nativo (más robusto que IndexedDB)
- Background Sync nativo (WorkManager)
- FCM para notificaciones push
- Acceso a hardware nativo (GPS, cámara, Filesystem)

### Restricciones Fundamentales
1. **La PWA NO se modifica** - Funciona exactamente como está
2. **Código compartido** - La PWA vive en el VPS, la APK carga la misma URL
3. **Un único deploy** - GitHub → VPS actualiza ambos
4. **Solo cambios nativos requieren Play Store** - Código sigue igual

---

## 🚫 PROHIBIDO / RESTRICCIONES

| # | Restricción | Razón |
|---|-------------|-------|
| 1 | **Nunca saltar fases** | Cada fase depende de la anterior |
| 2 | **Nunca ejecutar fase sin validar anterior** | Cada fase tiene validación obligatoria |
| 3 | **No modificar la PWA** | Debe funcionar igual antes y después |
| 4 | **No tocar el Service Worker** | Sigue activo y procesa outbox cuando puede |
| 5 | **FCM solo para Android** | iOS/PWA sigue con VAPID |
| 6 | **No dejar keystore en repo** | Debe guardarse en lugar seguro |
| 7 | **No publicar sin testing en dispositivo real** | Emulador no es suficiente |
| 8 | **Capacitor se instala DENTRO del proyecto** | No carpeta separada |

---

## ✅ LO QUE SE VA A HACER (POR FASE)

### FASE 1: SETUP CAPACITOR
**Objetivo:** Generar APK que carga la PWA desde el servidor de producción

**Estructura:**
```
aquatech-render-main/        ← TODO INTACTO
├── src/
├── capacitor.config.ts       ← NUEVO
├── android/                  ← NUEVO (generado)
└── ...todo lo demás
```

**Hitos (en orden correcto):**

| # | Hito | Comando |
|---|------|---------|
| 1 | Instalar dependencias | `npm install @capacitor/core @capacitor/cli @capacitor/android` |
| 2 | Inicializar Capacitor | `npx cap init` (genera capacitor.config.ts) |
| 3 | **Editar capacitor.config.ts** | Agregar server.url y appId |
| 4 | Agregar Android | `npx cap add android` |
| 5 | **Sync Android** | `npx cap sync android` (instala plugins) |
| 6 | Abrir Android Studio | `npx cap open android` |
| 7 | Probar en dispositivo | USB debugging |
| 8 | Generar APK debug | Build > Build APK(s) |

> ⚠️ **IMPORTANTE:** `npx cap sync` es más completo que `npx cap copy` porque sync también instala los plugins. Se necesita sync cada vez que se agregue un plugin nativo (Fases 2, 3, 4).

**capacitor.config.ts:**
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'AquaTech CRM',
  webDir: 'out',
  server: {
    url: 'https://tu-dominio.com',  // ← URL DE PRODUCCIÓN
    cleartext: false,  // HTTPS obligatorio
  },
};

export default config;
```

**⚠️ Notas críticas:**
- **server.url** → Apunta a producción, NO genera build estático
- Con `server.url` activo, Capacitor **ignora `webDir` completamente**
- Si usas Server Actions (GROQ marketing), funcionan porque carga de producción

**Validación:**
- [ ] capacitor.config.ts existe en la raíz
- [ ] server.url apunta a tu dominio de producción
- [ ] android/ folder existe
- [ ] APK se instala en dispositivo
- [ ] La app carga la PWA desde producción
- [ ] Login funciona
- [ ] Sin errores CORS
- [ ] **→ CONTINUAR CON FASE 2**

---

### FASE 2: SQLITE NATIVO
**Objetivo:** Reemplazar Dexie/IndexedDB por SQLite nativo Android

**Problema que resuelve:** Android puede limpiar IndexedDB bajo presión de memoria → destruye el outbox de sincronización

**Solución:**
1. Crear `src/lib/native-storage.ts` (misma interfaz que Dexie)
2. El SW sigue usando Dexie (para iOS/PWA)
3. Android usa SQLite nativo

**Implementación:**
- Reemplazar `dexieDb.outbox` → `storage.addToOutbox()`
- Mantener capa de abstracción para ambos platforms

**Validación:**
- DB SQLite creada en primer arranque sin errores
- Item en outbox persiste al matar y reabrir app
- Datos sobreviven a presión de memoria desde Android Studio

---

### FASE 3: BACKGROUND SYNC
**Objetivo:** Procesar outbox aunque la app esté cerrada o Android haya matado el proceso

**Problema que resuelve:** SW poller (15s) muere cuando Android mata el proceso → operador no ve su trabajo reflejado hasta reabrir app

**Solución:**
1. Crear `src/lib/sync-processor.ts` - mapea OutboxItem → endpoint API
2. Usar Background Fetch nativo (proceso separado del OS)
3. Corre aunque el usuario leave la app

**Arquitectura coexiste:**
- SW (custom-sw.js v377) → procesa outbox cuando app está en primer plano
- Background Fetch nativo → procesa cuando app está en background o cerrada
- Ambos usan el mismo outbox SQLite + idempotencia (SyncLog)

**Validación:**
- Sin conexión + mensaje agregado → sale cuando reconnecta
- App en background + mensaje offline → sale correctamente
- App cerrada completamente + mensaje offline → Background Fetch lo procesa
- Reiniciar dispositivo sin abrir app → Background Fetch se ejecuta
- Sin duplicados en servidor (SyncLog funciona)

---

### FASE 4: PUSH FCM
**Objetivo:** Notificaciones push confiables en Android

**Estrategia dual:**
- **Android:** FCM (Firebase Cloud Messaging) - canal oficial Google
- **iOS/PWA:** VAPID (web-push) - mantenido

**Backend requerido:**
```
FIREBASE_PROJECT_ID=aquatech-crm
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@aquatech-crm.iam.gserviceaccount.com
```

**Validación:**
- Al abrir app → aparece diálogo de permiso de notificaciones
- Asignar operador a proyecto → recibe notificación aunque app esté cerrada
- Mensaje nuevo en chat → llega como push en Android
- Sin duplicados (no llega por VAPID y FCM a la vez)

---

### FASE 5: HARDWARE NATIVO + PLAY STORE
**Objetivo:** Acceso a GPS/cámara/filesystem nativo y publicación

**Plugins a usar:**
- GPS alta precisión
- Cámara en background
- Filesystem para archivos grandes (reemplaza base64/Cache API)

**Keystore:**
- Llave privada para firmar APK
- **GUARDAR EN LUGAR SEGURO** (no en repo)

**Publicación:**
- Tiempo revisión Google: 1-3 días primera versión, 1 día actualizaciones
- Notificaciones push funcionan en versión Play Store (no solo debug)

---

## 📁 ESTRUCTURA DEL PROYECTO

```
d:\Abel paginas\Aquatech\
│
├── crm mayo\
│   └── aquatech-render-main\        ← PWA ACTUAL (NO TOCAR)
│
├── aquatech-app-capacitor\           ← NUEVO PROYECTO
│   ├── capacitor.config.ts
│   ├── android/
│   ├── src/
│   └── package.json
│
└── pwa a apk\                        ← DOCUMENTACIÓN
    ├── 00_PLAN_GENERAL.docx
    ├── 01_FASE1_SETUP_CAPACITOR.docx
    ├── 02_FASE2_SQLITE_NATIVO.docx
    ├── 03_FASE3_BACKGROUND_SYNC.docx
    ├── 04_FASE4_PUSH_FCM.docx
    ├── 05_FASE5_HARDWARE_PLAYSTORE.docx
    └── files.zip
```

---

## 🔄 FLUJO DE FUNCIONAMIENTO

```
USUARIO INSTALA APP DESDE PLAY STORE
    │
    ▼
APP AL ABRIRSE:
├── server.url = https://tu-vps.com
├── Carga TODA la PWA en WebView
│
OFFLINE:
├── SQLite nativo guarda datos localmente
├── Funciona sin internet
│
BACKGROUND SYNC (aunque app cerrada):
├── WorkManager sincroniza cada 15 min
├── Aunque el usuario haya matado la app
├── Survive a reinicios
│
ACTUALIZACIONES:
├── Deploy: GitHub → VPS
├── PWA se actualiza ✅
├── App nativa se actualiza (mismo lugar) ✅
├── Users NO descargan nada
│
NOTIFICACIONES:
├── Android: FCM
├── iOS/PWA: VAPID
```

---

## 📊 COMPARATIVA PWA vs APK

| Aspecto | PWA Actual | APK Nativa |
|---------|------------|------------|
| Offline | IndexedDB ⚠️ | SQLite ✅ |
| Background Sync | SW polling ❌ | WorkManager ✅ |
| Persistencia | Puede limpiarse | Robusta |
| Se actualiza | GitHub → VPS ✅ | GitHub → VPS ✅ |
| Users descargan | No | No (código) |
| Push | VAPID | FCM ✅ |
| Play Store | No | Sí |
| GPS/Cámara | Browser API | Nativo ✅ |

---

## ⚠️ RIESGOS IDENTIFICADOS

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Service Worker conflict | Media | Disable SW si necesario |
| Plugin no funciona | Baja | Usar versiones estables |
| Android mata proceso | Baja | WorkManager retry automático |
| IndexedDB limpiado | Alta en Android | SQLite nativo (Fase 2) |

---

## 📦 PLUGINS CAPACITOR

| Plugin | Propósito |
|--------|-----------|
| @capacitor/core | Bridge nativo |
| @capacitor/cli | Comandos |
| @capacitor/splash-screen | Pantalla inicio |
| @capacitor/status-bar | Barra estado |
| @capacitor/push-notifications | Notificaciones |
| @capacitor/network | Estado red |
| @capacitor-community/sqlite | DB offline robusta |
| @capacitor-community/background-fetch | Background sync nativo |

---

## 🚀 PRÓXIMOS PASOS

1. Confirmar URL del VPS
2. Crear carpeta `aquatech-app-capacitor`
3. Seguir FASE1 document
4. Validar cada fase antes de avanzar
5. Testing en dispositivo real (no emulador)
6. Publicar en Play Store

---

## 📚 DOCUMENTACIÓN RELACIONADA

| Documento | Descripción |
|-----------|-------------|
| `OPCION3_CAPACITOR.md` | Guía completa implementación |
| `RESUMEN_PROYECTO_APP_ANDROID.md` | Resumen ejecutivo |
| `PROJECT_DOCUMENTATION.md` | Documentación técnica CRM |

---

*Documento creado: 30 Mayo 2026*
*Proyecto: AquaTech CRM - PWA to APK Migration*