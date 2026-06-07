// src/lib/firebase-client.ts
// Firebase Messaging para notificaciones foreground en Android APK
// Usa @capacitor-firebase/messaging directamente (no firebase/messaging web SDK)

import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

// Solo importar firebase/messaging en cliente para getToken (no para onMessage)
let messagingInstance: any = null;
let onMessageHandler: ((payload: any) => void) | null = null;
let listenersInitialized = false;

/**
 * Inicializa Firebase Messaging para capturar notifications foreground
 * Usa FirebaseMessaging.addListener en lugar de firebase/messaging.onMessage
 * para evitar el problema de isSupported() retornando false
 */
export async function initFirebaseForegroundMessaging(
  handler: (payload: any) => void
): Promise<void> {
  // Solo en plataforma nativa (APK)
  if (!Capacitor.isNativePlatform()) {
    console.log('[FirebaseClient] No es APK, omitiendo Firebase foreground messaging');
    return;
  }

  onMessageHandler = handler;

  // Si ya inicializamos los listeners, no repetir
  if (listenersInitialized) {
    console.log('[FirebaseClient] Listeners ya inicializados, omitiendo');
    return;
  }

  try {
    // Importar firebase/messaging solo para getToken (necesitamos vapidKey)
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Verificar que tenemos config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId) {
      console.warn('[FirebaseClient] Firebase config incompleta, omitiendo foreground messaging');
      return;
    }

    // Inicializar Firebase (evitar doble inicializacion)
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
    messagingInstance = getMessaging(app);

    // Configurar listener para notificaciones foreground usando Capacitor plugin
    // ESTE es el fix: usar FirebaseMessaging.addListener en lugar de onMessage
    // que evita el problema de isSupported() retornando false
    FirebaseMessaging.addListener('notificationReceived', async (notification: any) => {
      console.log('[FirebaseClient] Notificacion foreground recibida (native):', notification);
      
      const notif = notification.notification;
      const title = notif?.title || 'Aquatech';
      const body = notif?.body || '';
      const data = notification.data || {};
      
      // Si hay un handler personalizado, invocarlo
      if (onMessageHandler) {
        onMessageHandler({
          title,
          body,
          data,
        });
      }
      
      // v412: Mostrar notificacion nativa del sistema (funciona en foreground)
      // Solo mostrar si no es la notificacion de prueba (que ya se muestra desde el server)
      if (data.type !== 'test' && Capacitor.isNativePlatform()) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
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
          console.warn('[FirebaseClient] Error mostrando notificacion native:', e);
        }
      }
    });

    listenersInitialized = true;
    console.log('[FirebaseClient] Firebase foreground messaging inicializado correctamente');
  } catch (err) {
    console.error('[FirebaseClient] Error inicializando Firebase foreground messaging:', err);
  }
}

/**
 * Obtiene el token FCM usando el Firebase JS SDK
 * Util si necesitamos el token para algo especifico
 */
export async function getFCMToken(): Promise<string | null> {
  if (!messagingInstance) {
    console.warn('[FirebaseClient] Firebase messaging no inicializado');
    return null;
  }

  try {
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messagingInstance, {
      vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    return token;
  } catch (err) {
    console.error('[FirebaseClient] Error obteniendo FCM token:', err);
    return null;
  }
}