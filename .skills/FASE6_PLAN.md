# FASE 6: Integración SQLite + Background Runner
## Objetivo General

Conectar los plugins nativos instalados (SQLite, Background Runner, Push Notifications) con el sistema de sincronización existente de la PWA, para que la APK funcione de manera más robusta offline y en segundo plano.

## 🎯 Resultado Esperado

La APK tendrá:
1. **Base de datos SQLite nativa** para datos críticos (no depende de IndexedDB del WebView)
2. **Sincronización en segundo plano** cuando la app está cerrada (Background Runner)
3. **Notificaciones Push nativas** via Firebase Cloud Messaging (FCM)

## 🔒 Principio Fundamental

**LA PWA NO SE MODIFICA** - Todo el código actual de la PWA sigue funcionando EXACTAMENTE igual.

Los cambios son:
- Solo archivos de configuración de Capacitor
- Solo código específico para APK (detectar `Capacitor.isNativePlatform()`)
- Solo el `custom-sw.js` tendrá routing condicional APK/PWA

## 📋 Hitos

### Hito 1: Detectar Plataforma en custom-sw.js ✅
- ✅ Variable `isAndroidNative = Capacitor.isNativePlatform()` detectada en custom-sw.js
- ✅ Funciones puente `nativeSyncRequest()` y `nativeMarkProcessed()` creadas en SW
- ✅ `src/lib/native-storage.ts` con message handler para responder al SW

### Hito 2: SQLite Nativo para APK ✅
- ✅ `src/lib/native-storage.ts` creado con funciones de puente SQLite
- `src/lib/storage.ts` ya tiene routing APK/PWA funcionando
- ⚠️ Pendiente: conectar `addToOutbox()` en componentes para usar SQLite nativo
- La PWA seguirá usando IndexedDB (Dexie) como antes

### Hito 3: Background Runner para APK ✅
- ✅ `background-service.ts` configurado con BackgroundRunner
- ✅ Funciones `getNativePendingItems()` y `markNativeItemProcessed()` añadidas a SW
- ✅ `processOutboxItemSync()` implementada para procesar items de SQLite
- ✅ `_internalProcessOutbox()` detecta APK y usa SQLite nativo

### Hito 4: Push Notifications via FCM ✅
- ✅ Schema actualizado con campo `type` ("vapid" | "fcm") y `fcmToken`
- ✅ `firebase-admin.ts` creado para enviar via FCM
- ✅ `push.ts` modificado para routing VAPID/FCM según tipo de suscripción
- ✅ `/api/push/subscribe` actualizado para manejar ambos tipos
- ✅ `StorageInitializer` registra FCM token automáticamente en APK
- ✅ `push-native.ts` listo para uso manual si se necesita

## ⚠️ Puntos Críticos

1. **No modificar lógica PWA** - Solo agregar condiciones `if (Capacitor.isNativePlatform())`
2. **Testear en dispositivo real** - Emulador no es suficiente para background sync
3. **每 cambio sensible será reportado** antes de implementar

## 📁 Archivos a Modificar

| Archivo | Cambio | Risk |
|---------|--------|------|
| `public/custom-sw.js` | Routing APK/PWA para outbox | ⚠️ ALTO |
| `src/lib/storage.ts` | Agregar fallback SQLite para APK | ⚠️ MEDIO |
| `src/lib/sync-processor.ts` | Detectar plataforma para sync | ⚠️ MEDIO |
| `android/app/src/main/AndroidManifest.xml` | Permisos Background Runner | ⚠️ BAJO |
| `capacitor.config.ts` | Configuración plugins | ✅ BAJO |

## ✅ Checklist de Validación

- [ ] PWA sigue funcionando exactamente igual (probar en Chrome)
- [ ] APK guarda datos en SQLite nativo
- [ ] APK sincroniza cuando está en background (app cerrada)
- [ ] Notificaciones Push llegan en APK
- [ ] No hay errores en consola de la PWA

## 📚 Skills a Seguir

- `.skills/pwa-to-apk-phase6.md` - Integración SQLite + Background Runner
- `.skills/pwa-to-apk-phase4.md` - Push FCM (para notificaciones)