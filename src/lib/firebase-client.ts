// src/lib/firebase-client.ts
// Firebase JS SDK para capturar notificaciones foreground en Android APK
// onMessage handler intercepta mensajes FCM mientras la app está abierta

import { Capacitor } from '@capacitor/core';

// Solo importar firebase/messaging en cliente (no server-side)
let messagingInstance: any = null;
let onMessageHandler: ((payload: any) => void) | null = null;

/**
 * Inicializa Firebase Messaging para capturar notifications foreground
 * Debe llamarse SOLO en el cliente (useEffect, event handlers)
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

  try {
    // Importar firebase/app y firebase/messaging dinámicamente (solo cliente)
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');

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

    // Inicializar Firebase (evitar doble inicialización)
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
    
    // Verificar si messaging está soportado
    const supported = await isSupported();
    if (!supported) {
      console.log('[FirebaseClient] Firebase Messaging no soportado en este dispositivo');
      return;
    }

    messagingInstance = getMessaging(app);

    // Configurar onMessage para capturar notificaciones foreground
    // ESTE es el handler que intercepta mensajes mientras la app está abierta
    onMessage(messagingInstance, (payload) => {
      console.log('[FirebaseClient] Notificación foreground recibida:', payload);
      
      const notification = payload.notification;
      const data = payload.data || {};
      
      // Si hay un handler personalizado, invocarlo
      if (onMessageHandler) {
        onMessageHandler({
          title: notification?.title || data.title || 'Notificación',
          body: notification?.body || data.body || '',
          data: data,
        });
      }
      
      // También mostrar notificación del sistema si tenemos permiso
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          // Solo mostrar si no es la notificación de prueba (que ya se muestra desde el server)
          if (data.type !== 'test') {
            try {
              new Notification(notification?.title || 'Aquatech', {
                body: notification?.body || data.body || '',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: data.tag || 'foreground',
                data: data,
              });
            } catch (e) {
              console.warn('[FirebaseClient] Error mostrando Notification:', e);
            }
          }
        }
      }
    });

    console.log('[FirebaseClient] Firebase foreground messaging inicializado correctamente');
  } catch (err) {
    console.error('[FirebaseClient] Error inicializando Firebase foreground messaging:', err);
  }
}

/**
 * Obtiene el token FCM usando el Firebase JS SDK
 * Útil si necesitamos el token para algo específico
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