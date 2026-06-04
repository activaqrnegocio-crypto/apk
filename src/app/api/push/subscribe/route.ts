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

    // v380: Handle FCM tokens (Android native)
    if (type === 'fcm' && subscription?.token) {
      const pushSub = await prisma.pushSubscription.upsert({
        where: {
          userId_fcmToken: {
            userId,
            fcmToken: subscription.token,
          }
        },
        update: {
          fcmToken: subscription.token,
          deviceName: deviceName || null,
        },
        create: {
          userId,
          type: 'fcm',
          fcmToken: subscription.token,
          deviceName: deviceName || null,
        }
      })
      console.log(`[PUSH] FCM subscription registered for user ${userId}`)
      return NextResponse.json({ success: true, id: pushSub.id })
    }

    // v380: Handle VAPID subscriptions (PWA/iOS)
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
    }

    const pushSub = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint,
        }
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceName: deviceName || null,
      },
      create: {
        userId,
        type: 'vapid',
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceName: deviceName || null,
      }
    })

    console.log(`[PUSH] VAPID subscription registered for user ${userId}`)
    return NextResponse.json({ success: true, id: pushSub.id })
  } catch (error: any) {
    console.error('[PUSH Subscribe ERROR]:', error)
    // Detallar el error para debugging
    const errorMessage = error?.message || 'Unknown error'
    const errorCode = error?.code || 'No code'
    console.error('[PUSH] Error details:', {
      message: errorMessage,
      code: errorCode,
      stack: error?.stack
    })
    return NextResponse.json({ error: 'Error registering subscription', details: errorMessage }, { status: 500 })
  }
}

// DELETE: Remove a push subscription
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)
    const { endpoint, fcmToken } = await req.json()

    // v380: Delete FCM token
    if (fcmToken) {
      await prisma.pushSubscription.deleteMany({
        where: { userId, fcmToken }
      })
      console.log(`[PUSH] FCM subscription removed for user ${userId}`)
      return NextResponse.json({ success: true })
    }

    // v380: Delete VAPID endpoint
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
