// src/lib/firebase-client.ts
// Firebase Messaging para notificaciones foreground en Android APK
// Usa @capacitor/push-notifications (no @capacitor-firebase/messaging que requiere Firebase JS SDK)

// v412: NO usar FirebaseMessaging.addListener - usa Firebase JS SDK que falla en WebView
// En su lugar, usar PushNotifications que funciona con FCM nativo

import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotification } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

let listenersInitialized = false;
let foregroundHandler: ((notification: { title: string; body: string; data: Record<string, any> }) => void) | null = null;

/**
 * Inicializa el manejo de notificaciones foreground usando PushNotifications
 * (no FirebaseMessaging que usa JS SDK y falla en WebView)
 */
export async function initFirebaseForegroundMessaging(
  handler: (payload: { title: string; body: string; data: Record<string, any> }) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[FirebaseClient] No es APK, omitiendo foreground messaging');
    return;
  }

  foregroundHandler = handler;

  if (listenersInitialized) {
    console.log('[FirebaseClient] Listeners ya inicializados');
    return;
  }

  try {
    // Configurar listener para notificaciones foreground usando PushNotifications
    // ESTE es el fix: usar PushNotifications en lugar de FirebaseMessaging
    // PushNotifications funciona con FCM nativo sin necesitar Firebase JS SDK
    PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotification) => {
      console.log('[FirebaseClient] Notificación foreground recibida (PushNotifications):', notification);
      
      const title = notification.title || 'Aquatech';
      const body = notification.body || '';
      const data = notification.data || {};
      
      if (foregroundHandler) {
        foregroundHandler({ title, body, data });
      }
      
      // Mostrar notificación nativa solo si no es tipo test
      if (data.type !== 'test' && Capacitor.isNativePlatform()) {
        try {
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
              id: Math.floor(Math.random() * 1000000),
              title,
              body,
              channelId: 'foreground',
            }]
          });
        } catch (e) {
          console.warn('[FirebaseClient] Error mostrando notificación native:', e);
        }
      }
    });

    listenersInitialized = true;
    console.log('[FirebaseClient] PushNotifications foreground messaging inicializado correctamente');
  } catch (err) {
    console.error('[FirebaseClient] Error inicializando PushNotifications foreground messaging:', err);
  }
}

/**
 * El token FCM se obtiene del evento 'registration' de PushNotifications
 * No hay método getToken() directo - se captura via listener
 */
export async function getFCMToken(): Promise<string | null> {
  // El token se captura via PushNotifications.addListener('registration', ...)
  // Esta función retorna null ya que el token llega via evento
  console.warn('[FirebaseClient] getFCMToken: usar evento registration para obtener token');
  return null;
}