// src/lib/push-native.ts
// Registro de token FCM para Android nativo
// NO reemplaza push.ts — es complementario

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function registerFCMToken(userId: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNative] No es plataforma nativa, omitiendo registro FCM');
    return;
  }

  try {
    // 1. Solicitar permiso al usuario
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('[PushNative] Permiso de notificaciones denegado');
      return;
    }

    // 2. Crear canal para Android 8+ (OBLIGATORIO)
    await PushNotifications.createChannel({
      id: 'default',
      name: 'Notificaciones Aquatech',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    console.log('[PushNative] Canal de notificaciones creado');

    // 3. LISTENERS PRIMERO - antes de register()
    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNative] Token FCM recibido:', token.value, 'userId:', userId);

      // 4. Enviar token al backend
      try {
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'fcm',           // Distinguir de VAPID
            token: token.value,
            userId,
          }),
        });
        console.log('[PushNative] Request body:', JSON.stringify({ type: 'fcm', token: token.value, userId }));

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          console.log('[PushNative] Token FCM guardado en backend:', JSON.stringify(data));
        } else {
          const text = await response.text().catch(() => 'unknown error');
          console.error('[PushNative] Error guardando token:', response.status, text);
        }
      } catch (err) {
        console.error('[PushNative] Error enviando token al backend:', err);
      }
    });

    // 5. Manejar notificaciones cuando la app está en primer plano
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNative] Notificación recibida (foreground):', notification);
      // Aquí puedes mostrar un toast/in-app notification si lo deseas
    });

    // 6. Manejar tap en notificación (app en background o cerrada)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PushNative] Tap en notificación:', action);
      const data = action.notification.data;

      // Navegar según el tipo de notificación
      if (data?.projectId) {
        window.location.href = `/admin/proyectos/${data.projectId}`;
      } else if (data?.type === 'appointment') {
        window.location.href = '/admin/calendario';
      } else if (data?.type === 'chat') {
        window.location.href = '/admin/proyectos';
      }
    });

    // 7. Manejar errores de registro
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNative] Error de registro FCM:', error);
    });

    // 8. REGISTER AL FINAL - después de tener los listeners
    await PushNotifications.register();
    console.log('[PushNative] Dispositivo registrado para notificaciones');

  } catch (err) {
    console.error('[PushNative] Error inicializando FCM:', err);
  }
}

// ============================================
// DESREGISTRAR (logout)
// ============================================
export async function unregisterFCMToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.unregister();
    console.log('[PushNative] Token FCM desregistrado');
  } catch (err) {
    console.error('[PushNative] Error desregistrando:', err);
  }
}
