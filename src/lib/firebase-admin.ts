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

export async function sendFCMToToken(token: string, payload: FCMPayload): Promise<boolean | 'INVALID_TOKEN'> {
  const app = getFirebaseAdmin();
  if (!app) {
    console.warn('[FCM] Firebase not initialized, skipping');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'aquatech_notifications',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    };

    const response = await admin.messaging(app).send(message);
    console.log(`[FCM] Message sent successfully: ${response}`);
    return true;
  } catch (err: any) {
    // Handle invalid token errors
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-argument') {
      console.warn('[FCM] Invalid or unregistered token, should be deleted:', token.substring(0, 20) + '...');
      return 'INVALID_TOKEN' as any;
    }
    console.error('[FCM] Error sending message:', err);
    return false;
  }
}