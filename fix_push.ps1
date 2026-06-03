$content = @'
import webpush from 'web-push'
import { prisma } from './prisma'
import admin from 'firebase-admin'

// ============================================
// VAPID Configuration (PWA/iOS)
// ============================================
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
  console.warn('[PUSH] VAPID keys missing.')
}

// ============================================
// Firebase Admin Configuration (Android FCM)
// ============================================
let fcmInitialized = false
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        })
      })
      fcmInitialized = true
      console.log('[PUSH] Firebase Admin initialized')
    }
  } catch (e) {
    console.warn('[PUSH] Failed to initialize Firebase Admin:', e)
  }
} else {
  console.warn('[PUSH] Firebase credentials missing. FCM disabled.')
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

export async function sendPushToUser(userId: number, payload: PushPayload) {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId }
    })

    if (subs.length === 0) return []

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        if (sub.type === 'fcm' && sub.fcmToken && fcmInitialized) {
          return admin.messaging().send({
            token: sub.fcmToken,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: {
              url: payload.url || '/admin/operador',
              tag: payload.tag || 'general',
              ...(payload.image ? { image: payload.image } : {}),
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'default',
                icon: payload.icon || '/icon-192.png',
              }
            }
          })
        } else if (sub.type === 'vapid' && sub.endpoint && sub.p256dh && sub.auth) {
          const pushPayload = JSON.stringify({
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

          return webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            },
            pushPayload,
            { TTL: 86400, urgency: 'high' }
          )
        }
      })
    )

    for (const sub of subs) {
      if (sub.type === 'vapid') {
        const result = results.find(r => r.status === 'rejected')
        if (result?.reason?.statusCode === 410 || result?.reason?.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          console.log(`[PUSH] Removed expired VAPID subscription for user ${userId}`)
        }
      }
    }

    return results
  } catch (error) {
    console.error('[PUSH] Error sending to user:', userId, error)
    return []
  }
}

export async function sendPushToProjectTeam(
  projectId: number,
  excludeUserId: number,
  payload: PushPayload
) {
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

export async function notifyUser(userId: number, title: string, body: string, url?: string, tag?: string, image?: string) {
  return sendPushToUser(userId, { title, body, url, tag, image }).catch(() => {})
}

export async function notifyProjectTeam(
  projectId: number,
  excludeUserId: number,
  title: string,
  body: string,
  url?: string,
  tag?: string,
  image?: string
) {
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

    if (admins.length === 0) return []

    return Promise.allSettled(
      admins.map(a => notifyUser(a.id, title, body, url, tag, image))
    )
  } catch (error) {
    console.error('[PUSH] Error notifying admins:', error)
    return []
  }
}

export async function sendSilentPush(userId: number) {
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId }
    })

    if (subs.length === 0) {
      console.log(`[SilentPush] No subscriptions for user ${userId}`)
      return []
    }

    const silentPayload = JSON.stringify({
      silent: true,
      action: 'wake-up-sync'
    })

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        if (sub.type === 'fcm' && sub.fcmToken && fcmInitialized) {
          return admin.messaging().send({
            token: sub.fcmToken,
            data: {
              silent: 'true',
              action: 'wake-up-sync'
            },
            android: {
              priority: 'high'
            }
          })
        } else if (sub.type === 'vapid' && sub.endpoint && sub.p256dh && sub.auth) {
          return webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            silentPayload,
            { TTL: 300, urgency: 'low' }
          )
        }
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    console.log(`[SilentPush] Sent to ${succeeded}/${subs.length} devices for user ${userId}`)
    return results
  } catch (error) {
    console.error('[SilentPush] Error:', error)
    return []
  }
}
'@

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\src\lib\push.ts", $content, $utf8)
Write-Host "push.ts written successfully"