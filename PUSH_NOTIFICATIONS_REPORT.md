# Push Notifications - Reporte Completo

## 1. src/lib/push-native.ts

```typescript
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
      console.log('[PushNative] Token FCM recibido:', token.value);

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

        if (response.ok) {
          console.log('[PushNative] Token FCM guardado en backend');
        } else {
          console.error('[PushNative] Error guardando token:', response.status);
        }
      } catch (err) {
        console.error('[PushNative] Error enviando token al backend:', err);
      }
    });

    // 5. Manejar notificaciones cuando la app está en primer plano
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNative] Notificación recibida (foreground):', notification);
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
```

---

## 2. src/lib/push.ts

```typescript
import webpush from 'web-push'
import { prisma } from './prisma'
import { sendFCMToToken, type FCMPayload } from './firebase-admin'

// Configure VAPID details only if keys are present
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:aquatech@cesarreyesjaramillo.com',
      VAPID_PUBLIC,
      VAPID_PRIVATE
    )
  } catch (e) {
    console.warn('[PUSH] Failed to set VAPID details:', e)
  }
} else {
  console.warn('[PUSH] VAPID keys missing. Notifications disabled for this session (Build context).')
}

interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
  badge?: string
  image?: string
}

// Send push to all devices of a user (FCM + VAPID)
export async function sendPushToUser(userId: number, payload: PushPayload) {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId }
    })

    if (subs.length === 0) return []

    const fcmSubs = subs.filter(s => s.type === 'fcm' && s.fcmToken)
    const vapidSubs = subs.filter(s => s.type === 'vapid' || (!s.fcmToken && s.endpoint))

    const pushPayloadStr = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      image: payload.image,
      url: payload.url || '/admin/operador',
      tag: payload.tag || 'general',
      vibrate: [300, 100, 300, 100, 400],
      renotify: true
    })

    const results: any[] = []

    // Send to FCM tokens (Android)
    for (const sub of fcmSubs) {
      if (sub.fcmToken) {
        try {
          const fcmPayload: FCMPayload = {
            title: payload.title,
            body: payload.body,
            data: {
              url: payload.url || '/admin/operador',
              tag: payload.tag || 'general',
              icon: payload.icon || '/icon-192.png',
            }
          }
          const result = await sendFCMToToken(sub.fcmToken, fcmPayload)
          if (result === 'INVALID_TOKEN') {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
            console.log(`[PUSH] Removed invalid FCM token for user ${userId}`)
          }
          results.push({ success: true, type: 'fcm' })
        } catch (err: any) {
          console.error('[PUSH] FCM error:', err)
          results.push({ success: false, type: 'fcm', error: err.message })
        }
      }
    }

    // Send to VAPID endpoints (PWA/iOS)
    for (const sub of vapidSubs) {
      if (sub.endpoint && sub.p256dh && sub.auth) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            },
            pushPayloadStr,
            { TTL: 86400, urgency: 'high' }
          )
          results.push({ success: true, type: 'vapid' })
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
            console.log(`[PUSH] Removed expired VAPID subscription for user ${userId}`)
          }
          results.push({ success: false, type: 'vapid', error: err.message })
        }
      }
    }

    return results
  } catch (error) {
    console.error('[PUSH] Error sending to user:', userId, error)
    return []
  }
}

// Send to all team members of a project + admins
export async function sendPushToProjectTeam(projectId: number, excludeUserId: number, payload: PushPayload) {
  try {
    const team = await prisma.projectTeam.findMany({
      where: { projectId },
      select: { userId: true }
    })

    const admins = await prisma.user.findMany({
      where: { 
        role: { in: ['ADMIN', 'ADMINISTRADORA', 'SUPERADMIN'] }, 
        isActive: true 
      },
      select: { id: true }
    })

    const allUserIds = [...new Set([
      ...team.map(t => t.userId),
      ...admins.map(a => a.id)
    ])].filter(id => id !== excludeUserId)

    if (allUserIds.length === 0) return []

    return Promise.allSettled(
      allUserIds.map(uid => sendPushToUser(uid, payload))
    )
  } catch (error) {
    console.error('[PUSH] Error sending to project team:', projectId, error)
    return []
  }
}

// Convenience wrappers
export async function notifyUser(userId: number, title: string, body: string, url?: string, tag?: string, image?: string) {
  return sendPushToUser(userId, { title, body, url, tag, image }).catch(() => {})
}

export async function notifyProjectTeam(projectId: number, excludeUserId: number, title: string, body: string, url?: string, tag?: string, image?: string) {
  return sendPushToProjectTeam(projectId, excludeUserId, { title, body, url, tag, image }).catch(() => {})
}

export async function notifyAdmins(title: string, body: string, url?: string, tag?: string, image?: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { 
        role: { in: ['ADMIN', 'ADMINISTRADORA', 'SUPERADMIN'] }, 
        isActive: true
      },
      select: { id: true }
    })
    return Promise.allSettled(admins.map(a => notifyUser(a.id, title, body, url, tag, image)))
  } catch (error) {
    console.error('[PUSH] Error notifying admins:', error)
    return []
  }
}
```

---

## 3. src/lib/firebase-admin.ts

```typescript
// src/lib/firebase-admin.ts
// Firebase Admin SDK para enviar notificaciones FCM en Android

import * as admin from 'firebase-admin';

function initFirebaseAdmin(): admin.app.App | null {
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
          channelId: 'aquatech_notifications',  // NOTE: 'default' vs 'aquatech_notifications'
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
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-argument') {
      console.warn('[FCM] Invalid or unregistered token, should be deleted:', token.substring(0, 20) + '...');
      return 'INVALID_TOKEN' as any;
    }
    console.error('[FCM] Error sending message:', err);
    return false;
  }
}
```

---

## 4. src/app/api/push/subscribe/route.ts

```typescript
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST: Register a new push subscription (VAPID or FCM)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)
    const body = await req.json()
    const { subscription, deviceName, type } = body

    // Handle FCM tokens (Android native)
    if (type === 'fcm') {
      const fcmToken = subscription?.token || body.token;
      if (!fcmToken) {
        return NextResponse.json({ error: 'Missing FCM token' }, { status: 400 })
      }
      
      const existing = await prisma.pushSubscription.findFirst({
        where: { userId, fcmToken }
      })
      
      if (existing) {
        await prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            fcmToken,
            type: 'fcm',
            deviceName: deviceName || null,
          }
        })
        console.log(`[PUSH] FCM subscription updated for user ${userId}`)
        return NextResponse.json({ success: true, id: existing.id })
      } else {
        try {
          const pushSub = await prisma.pushSubscription.create({
            data: {
              userId,
              fcmToken,
              type: 'fcm',
              deviceName: deviceName || null,
            }
          })
          console.log(`[PUSH] FCM subscription registered for user ${userId}`)
          return NextResponse.json({ success: true, id: pushSub.id })
        } catch (schemaErr: any) {
          if (schemaErr?.code === 'P2029' || schemaErr?.message?.includes('type')) {
            const pushSub = await prisma.pushSubscription.create({
              data: {
                userId,
                fcmToken,
                deviceName: deviceName || null,
              }
            })
            console.log(`[PUSH] FCM subscription registered (legacy, no type column)`)
            return NextResponse.json({ success: true, id: pushSub.id })
          }
          throw schemaErr;
        }
      }
    }

    // Handle VAPID subscriptions (PWA/iOS)
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
    }

    let existing;
    try {
      existing = await prisma.pushSubscription.findFirst({
        where: { userId, endpoint: subscription.endpoint }
      })
    } catch (schemaErr: any) {
      if (schemaErr?.message?.includes('type') || schemaErr?.code === 'P2029') {
        console.warn('[PUSH] Database schema outdated (missing type column), using legacy insert');
        try {
          const pushSub = await prisma.pushSubscription.create({
            data: {
              userId,
              endpoint: subscription.endpoint,
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
              deviceName: deviceName || null,
            }
          })
          console.log(`[PUSH] VAPID subscription registered (legacy, no type column)`);
          return NextResponse.json({ success: true, id: pushSub.id })
        } catch (legacyErr) {
          console.error('[PUSH] Legacy insert also failed:', legacyErr);
          return NextResponse.json({ error: 'Error registering subscription (legacy)' }, { status: 500 })
        }
      }
      throw schemaErr;
    }
    
    if (existing) {
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          deviceName: deviceName || null,
        }
      })
      console.log(`[PUSH] VAPID subscription updated for user ${userId}`)
      return NextResponse.json({ success: true, id: existing.id })
    } else {
      const pushSub = await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          deviceName: deviceName || null,
        }
      })
      console.log(`[PUSH] VAPID subscription registered for user ${userId}`)
      return NextResponse.json({ success: true, id: pushSub.id })
    }
  } catch (error: any) {
    console.error('[PUSH Subscribe ERROR]:', error)
    return NextResponse.json({ error: 'Error registering subscription', details: error.message }, { status: 500 })
  }
}

// DELETE: Remove a push subscription
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)
    const { endpoint, fcmToken } = await req.json()

    if (fcmToken) {
      await prisma.pushSubscription.deleteMany({
        where: { userId, fcmToken }
      })
      console.log(`[PUSH] FCM subscription removed for user ${userId}`)
      return NextResponse.json({ success: true })
    }

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint or fcmToken' }, { status: 400 })
    }

    await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint }
    })

    console.log(`[PUSH] VAPID subscription removed for user ${userId}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PUSH Unsubscribe ERROR]:', error)
    return NextResponse.json({ error: 'Error removing subscription' }, { status: 500 })
  }
}
```

---

## 5. src/app/api/push/send/route.ts

**NO EXISTE** - No hay un archivo `/api/push/send/route.ts` separado.

Las notificaciones se envían a través de `sendPushToUser()` en `src/lib/push.ts`, que es llamado desde varios lugares:
- `notifyUser()` 
- `notifyProjectTeam()`
- `notifyAdmins()`

El test endpoint está en `/api/push/test/route.ts`:

```typescript
// src/app/api/push/test/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)

    await sendPushToUser(userId, {
      title: '🔔 ¡Notificaciones Activadas!',
      body: `Hola ${session.user.name}, recibirás alertas de proyectos, mensajes y más.`,
      url: '/admin/operador',
      tag: 'test'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PUSH Test ERROR]:', error)
    return NextResponse.json({ error: 'Error sending test notification' }, { status: 500 })
  }
}
```

---

## 6. prisma/schema.prisma - PushSubscription

```prisma
model PushSubscription {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  type       String   @default("vapid") // "vapid" or "fcm"
  endpoint   String?  @db.VarChar(500)  // Only for VAPID
  p256dh     String?  @db.VarChar(200)  // Only for VAPID
  auth       String?  @db.VarChar(100)  // Only for VAPID
  fcmToken   String?  @map("fcm_token") @db.VarChar(500) // Only for FCM
  deviceName String?  @map("device_name") @db.VarChar(100)
  createdAt  DateTime @default(now()) @map("created_at")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, endpoint])
  @@unique([userId, fcmToken])
  @@index([userId])
  @@index([type])
  @@map("push_subscriptions")
}
```

---

## 7. android/app/build.gradle (primeras 20 líneas)

```gradle
apply plugin: 'com.android.application'

android {
    namespace = "com.aquatech.crm"
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.aquatech.crm"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions {
            ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~"
        }
    }
```

**applicationId = "com.aquatech.crm"**

---

## 8. capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'Aquatech CRM',
  webDir: '.next',
  
  // PRODUCTION - apuntando a Vercel
  server: {
    url: 'https://apk-ten-pi.vercel.app/',
    cleartext: false,
    appStartPath: '/admin',
  },
  
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#036BB2',
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#036BB2',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
```

---

## 9. src/components/NotificationPrompt.tsx

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

interface NotificationPromptProps {
  onDismiss?: () => void
}

export default function NotificationPrompt({ onDismiss }: NotificationPromptProps) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Solo mostrar en APK (no en PWA)
    const isNative = Capacitor.isNativePlatform();
    console.log('[NotificationPrompt] isNativePlatform:', isNative);
    
    if (!isNative) {
      console.log('[NotificationPrompt] No es APK, omitiendo prompt');
      return;
    }

    const alreadyAccepted = localStorage.getItem('push_accepted') === 'true'
    if (alreadyAccepted) {
      console.log('[NotificationPrompt] Ya aceptado antes, omitiendo');
      return
    }

    // En APK siempre mostrar el prompt después de 3 segundos
    const timer = setTimeout(() => {
      console.log('[NotificationPrompt] Mostrando prompt de notificaciones');
      setVisible(true);
    }, 3000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [])

  const handleAccept = async () => {
    setLoading(true)
    try {
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()
      if (!session?.user?.id) {
        console.error('[NotificationPrompt] No user session found');
        setLoading(false)
        return
      }

      await import('@/lib/push-native').then(({ registerFCMToken }) => 
        registerFCMToken(Number(session.user.id))
      )
      
      console.log('[NotificationPrompt] FCM registration complete')
      setVisible(false)
      localStorage.setItem('push_accepted', 'true')

      // Mostrar notificación local de confirmación
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('✅ Notificaciones activadas', {
              body: '¡Perfecto! A partir de ahora recibirás alertas de Aquatech.',
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'confirmacion'
            });
          } catch (e) {
            console.warn('[NotificationPrompt] No se pudo mostrar Notification:', e);
            alert('¡Notificaciones activadas! Recibirás alertas de proyectos y mensajes.');
          }
        } else {
          alert('¡Notificaciones activadas! Recibirás alertas de proyectos y mensajes.');
        }
      }, 500)
    } catch (err) {
      console.error('[NotificationPrompt] Error:', err)
      alert('Error al activar notificaciones. Verifica tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setVisible(false)
    onDismiss?.()
  }

  if (!Capacitor.isNativePlatform() || dismissed || !visible) {
    return null
  }

  // ... rest of component (render the prompt UI)
}
```

---

## 10. package.json (dependencias relevantes)

```json
{
  "dependencies": {
    "@capacitor-community/sqlite": "^8.1.0",
    "@capacitor-firebase/messaging": "^8.2.0",
    "@capacitor/android": "^8.4.0",
    "@capacitor/background-runner": "^3.0.0",
    "@capacitor/camera": "^8.2.0",
    "@capacitor/cli": "^8.4.0",
    "@capacitor/core": "^8.4.0",
    "@capacitor/filesystem": "^8.1.2",
    "@capacitor/geolocation": "^8.2.0",
    "@capacitor/push-notifications": "^8.1.1",
    "@capgo/capacitor-audio-recorder": "^8.2.1",
    "firebase": "^12.14.0",
    "firebase-admin": "^13.10.0",
    "web-push": "^3.6.7"
  }
}
```

---

## RESPUESTAS A PREGUNTAS

### ¿Existe el archivo android/app/google-services.json?
**SÍ** - El archivo existe en `android/app/google-services.json`

### ¿Cuál es el applicationId exacto de la APK?
**`com.aquatech.crm`**

### ¿Desde dónde se llama registerFCMToken?

`registerFCMToken` se llama desde **2 lugares**:

1. **StorageInitializer.tsx** (línea 20-25):
```typescript
// En useEffect de StorageInitializer
if (Capacitor.isNativePlatform()) {
  const { registerFCMToken } = await import('@/lib/push-native')
  const sessionRes = await fetch('/api/auth/session')
  const session = await sessionRes.json()
  if (session?.user?.id) {
    await registerFCMToken(Number(session.user.id))
  }
}
```

2. **NotificationPrompt.tsx** (línea 56-57):
```typescript
await import('@/lib/push-native').then(({ registerFCMToken }) => 
  registerFCMToken(Number(session.user.id))
)
```

---

## INCONISTENCIA DETECTADA ⚠️

Hay una diferencia crítica entre el canal creado y el canal referenciado en firebase-admin.ts:

| Archivo | Channel ID |
|---------|------------|
| `push-native.ts` (createChannel) | `'default'` |
| `firebase-admin.ts` (android.notification) | `'aquatech_notifications'` |

**Esto puede causar que las notificaciones no se muestren correctamente en Android 8+.**

El canal debe ser el mismo en ambos lugares.