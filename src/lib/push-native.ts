// src/lib/push-native.ts
// Registro de token FCM para Android nativo
// NO reemplaza push.ts — es complementario

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// v412: Handler para notificaciones foreground
// Este handler se invoca desde pushNotificationReceived cuando llega una notificación
let foregroundMessageHandler: ((notification: any) => void) | null = null;

export function setForegroundMessageHandler(handler: (notification: any) => void) {
  foregroundMessageHandler = handler;
}

// v412: Mostrar notificación nativa del sistema
async function showNativeNotification(title: string, body: string, data?: Record<string, string>) {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    // Crear canal si no existe
    await LocalNotifications.createChannel({
      id: 'foreground',
      name: 'Notificaciones Aquatech',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now() % 100000,
        title,
        body,
        channelId: 'foreground',
      }]
    });
    console.log('[PushNative] Notificación native mostrada:', title);
  } catch (e) {
    console.warn('[PushNative] Error mostrando notificación native:', e);
  }
}

export async function registerFCMToken(userId: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNative] No es plataforma nativa, omitiendo registro FCM');
    return;
  }

  try {
    // v412: Añadir listeners PRIMERO, antes de cualquier operación
    // 1. Manejar notificaciones cuando la app está en primer plano
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNative] Notificación recibida (foreground):', notification);
      
      // v412: Mostrar notificación nativa del sistema (funciona en foreground)
      showNativeNotification(
        notification.title || 'Aquatech',
        notification.body || '',
        notification.data
      );
      
      // También invocar el handler de foreground si está configurado
      if (foregroundMessageHandler) {
        foregroundMessageHandler(notification);
      }
    });

    // 2. Manejar tap en notificación (app en background o cerrada)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PushNative] Tap en notificación:', action);
      const data = action.notification.data || {};
      const url = data.url || '';
      
      // v413: Parsear URLs especiales de la PWA para navegación correcta
      if (url.startsWith('URL_PROJECT_CHAT:')) {
        // Chat de proyecto: URL_PROJECT_CHAT:123 → /admin/proyectos/123
        const projectId = url.replace('URL_PROJECT_CHAT:', '');
        window.location.href = `/admin/proyectos/${projectId}`;
      } else if (url.startsWith('URL_TASK:')) {
        // Tarea: URL_TASK:projectId:appointmentId → /admin/calendario?task=X&project=Y
        const parts = url.replace('URL_TASK:', '').split(':');
        const projectId = parts[0];
        const appointmentId = parts[1];
        window.location.href = `/admin/calendario?task=${appointmentId}&project=${projectId}`;
      } else if (data.projectId) {
        window.location.href = `/admin/proyectos/${data.projectId}`;
      } else if (data.type === 'appointment') {
        window.location.href = '/admin/calendario';
      } else if (data.type === 'chat') {
        window.location.href = '/admin/proyectos';
      } else if (data.type === 'new-project') {
        window.location.href = '/admin/proyectos';
      } else {
        // Default: ir a dashboard
        window.location.href = '/admin';
      }
    });

    // 3. Manejar errores de registro
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNative] Error de registro FCM:', error);
    });

    // 4. Solicitar permiso al usuario
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('[PushNative] Permiso de notificaciones denegado');
      return;
    }

    // 5. Crear canal para Android 8+ (OBLIGATORIO)
    await PushNotifications.createChannel({
      id: 'default',
      name: 'Notificaciones Aquatech',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    console.log('[PushNative] Canal de notificaciones creado');

    // 6. LISTENER DE REGISTRATION - después de los otros listeners
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
          
          // v412: Mostrar notificación local usando LocalNotifications (funciona en foreground)
          try {
            // Primero crear el canal si no existe
            await LocalNotifications.createChannel({
              id: 'confirmacion',
              name: 'Confirmación Aquatech',
              importance: 4,
              visibility: 1,
              sound: 'default',
              vibration: true,
            });
            
            // Mostrar notificación local
            await LocalNotifications.schedule({
              notifications: [{
                id: Date.now() % 100000,
                title: '✅ Notificaciones activadas',
                body: '¡Perfecto! A partir de ahora recibirás alertas de Aquatech.',
                channelId: 'confirmacion',
              }]
            });
            console.log('[PushNative] Notificación local mostrada');
          } catch (e) {
            console.warn('[PushNative] Error mostrando notificación local:', e);
            alert('¡Notificaciones activadas! Recibirás alertas de proyectos y mensajes.');
          }
          
          // v410: Enviar notificación de prueba desde el servidor para confirmar
          try {
            await fetch('/api/push/test', { 
              method: 'POST',
              credentials: 'include'  // Incluir cookies de sesión
            });
            console.log('[PushNative] Notificación de prueba enviada');
          } catch (e) {
            console.warn('[PushNative] Error enviando notificación de prueba:', e);
          }
        } else {
          const text = await response.text().catch(() => 'unknown error');
          console.error('[PushNative] Error guardando token:', response.status, text);
        }
      } catch (err) {
        console.error('[PushNative] Error enviando token al backend:', err);
      }
    });

    // 7. REGISTER AL FINAL - después de tener los listeners
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
