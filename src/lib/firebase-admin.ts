// src/lib/firebase-admin.ts
// Firebase Admin SDK para enviar notificaciones FCM en Android

import * as admin from 'firebase-admin';

function initFirebaseAdmin(): admin.app.App | null {
  // Check if already initialized
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[FirebaseAdmin] Missing Firebase credentials. FCM disabled.');
    return null;
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('[FirebaseAdmin] Initialized successfully');
    return app;
  } catch (err) {
    console.error('[FirebaseAdmin] Failed to initialize:', err);
    return null;
  }
}

let firebaseApp: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App | null {
  if (!firebaseApp) {
    firebaseApp = initFirebaseAdmin();
  }
  return firebaseApp;
}

export interface FCMPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Envía una notificación FCM con mensaje de solo DATOS (sin notification object)
 * Esto hace que Android NO muestre automáticamente la notificación cuando la app está abierta
 * En su lugar, el plugin @capacitor-firebase/messaging entrega el mensaje al handler JavaScript
 * que luego muestra la notificación usando LocalNotifications.schedule()
 */
export async function sendFCMDataToToken(token: string, payload: FCMPayload): Promise<boolean | 'INVALID_TOKEN'> {
  const app = getFirebaseAdmin();
  if (!app) {
    console.warn('[FCM] Firebase not initialized, skipping');
    return false;
  }

  try {
    // Mensaje de SOLO DATOS - Android no lo muestra automáticamente en foreground
    // El plugin @capacitor-firebase/messaging lo entrega a notificationReceived handler
    const message: admin.messaging.Message = {
      token,
      // NO hay notification object - esto es clave para que funcione en foreground
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.data?.url || '/admin/operador',
        tag: payload.data?.tag || 'default',
        icon: payload.data?.icon || '/icon-192.png',
        ...payload.data,
      },
      android: {
        priority: 'high',
        // Enable data-only messages to be received by the app
        directBootOk: true,
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1, // This tells iOS to deliver to the app directly
          },
        },
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
        },
      },
    };

    const response = await admin.messaging(app).send(message);
    console.log(`[FCM] Data message sent successfully: ${response}`);
    return true;
  } catch (err: any) {
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-argument') {
      console.warn('[FCM] Invalid or unregistered token:', token.substring(0, 20) + '...');
      return 'INVALID_TOKEN' as any;
    }
    console.error('[FCM] Error sending data message:', err);
    return false;
  }
}

export async function sendFCMToToken(token: string, payload: FCMPayload): Promise<boolean | 'INVALID_TOKEN'> {
  const app = getFirebaseAdmin();
  if (!app) {
    console.warn('[FCM] Firebase not initialized, skipping');
    return false;
  }

  try {
    // Mensaje de SOLO DATA - El plugin pushNotificationReceived lo recibe en todos los estados
    // Y la app muestra la notificación usando LocalNotifications
    const message: admin.messaging.Message = {
      token,
      data: {
        title: payload.title,
        body: payload.body,
        ...(payload.data || {}),
      },
      android: {
        priority: 'high',
      },
    };

    console.log('[FCM] Sending message. Token:', token.substring(0, 20) + '...', 'Message:', JSON.stringify(message));
    const response = await admin.messaging(app).send(message);
    console.log('[FCM] Message sent successfully. Response:', response);
    return true;
  } catch (err: any) {
    console.error('[FCM] Error sending message. code:', err.code, 'message:', err.message, 'full:', JSON.stringify(err));
    // Handle invalid token errors
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-argument') {
      console.warn('[FCM] Invalid or unregistered token, should be deleted:', token.substring(0, 20) + '...');
      return 'INVALID_TOKEN' as any;
    }
    return false;
  }
}