# Skill: PWA to APK Phase 4 - Push FCM

## Estado: ⚠️ PLUGINS INSTALADOS - FALTA google-services.json

## Objetivo
Notificaciones push confiables en Android usando Firebase Cloud Messaging (FCM).

## Problema que Resuelve
Notificaciones no llegan cuando la app está cerrada en Android.

## Estrategia Dual
- **Android:** FCM (Firebase Cloud Messaging) - canal oficial Google
- **iOS/PWA:** VAPID (web-push) - mantenido como está

## Requisitos
Variables de entorno necesarias:
```
FIREBASE_PROJECT_ID=aquatech-crm
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@aquatech-crm.iam.gserviceaccount.com
```

## Pasos a Seguir

### 1. Configurar Firebase en Android
- Descargar `google-services.json` de Firebase Console
- Colocar en `android/app/google-services.json`
- Configurar Firebase en el proyecto

### 2. Instalar Plugin FCM
```bash
npm install @capacitor/push-notifications
npx cap sync android
```

### 3. Implementar Suscripción
```typescript
import { PushNotifications } from '@capacitor/push-notifications';

PushNotifications.addListener('registration', (token) => {
  // Enviar token al servidor
});

PushNotifications.addListener('pushNotificationReceived', (notification) => {
  // Mostrar notificación local
});
```

### 4. Backend: Endpoint FCM
Crear endpoint que envía mensajes via Firebase Admin SDK

## Validación Requerida
- [ ] Al abrir app → aparece diálogo de permiso de notificaciones
- [ ] Asignar operador a proyecto → recibe notificación aunque app esté cerrada
- [ ] Mensaje nuevo en chat → llega como push en Android
- [ ] Sin duplicados (no llega por VAPID y FCM a la vez)

## Checklist de Implementación
- [ ] `google-services.json` en `android/app/`
- [ ] Plugin instalado (`@capacitor/push-notifications`)
- [ ] Permisos en AndroidManifest.xml
- [ ] Lógica de suscripción implementada
- [ ] Backend configurado (Firebase Admin SDK)
- [ ] Prueba en dispositivo real

## Siguiente Fase
→ FASE 5: Hardware Nativo + Play Store → `pwa-to-apk-phase5`

## Nota
FCM solo para Android. La PWA y iOS siguen usando VAPID (web-push) como antes.