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
    if (type === 'fcm') {
      // APK sends token directly, not wrapped in subscription object
      const fcmToken = subscription?.token || body.token;
      if (!fcmToken) {
        return NextResponse.json({ error: 'Missing FCM token' }, { status: 400 })
      }
      
      // Check if record exists first to handle case where type column doesn't exist
      const existing = await prisma.pushSubscription.findFirst({
        where: { userId, fcmToken }
      })
      
      if (existing) {
        await prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            fcmToken,
            type: 'fcm',  // Ensure type is set
            deviceName: deviceName || null,
          }
        })
        console.log(`[PUSH] FCM subscription updated for user ${userId}`)
        return NextResponse.json({ success: true, id: existing.id })
      } else {
        // Check if type column exists first
        try {
          const pushSub = await prisma.pushSubscription.create({
            data: {
              userId,
              fcmToken,
              type: 'fcm',  // Explicitly set type for FCM
              deviceName: deviceName || null,
            }
          })
          console.log(`[PUSH] FCM subscription registered for user ${userId}`)
          return NextResponse.json({ success: true, id: pushSub.id })
        } catch (schemaErr: any) {
          // If type column doesn't exist, create without it
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

    // v380: Handle VAPID subscriptions (PWA/iOS)
    // v445: Check for required fields BEFORE database query to avoid 500 errors
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
    }

    // v445: Check if type column exists by catching schema errors
    // If the database doesn't have 'type' column yet, fall back to old behavior
    let existing;
    try {
      existing = await prisma.pushSubscription.findFirst({
        where: { userId, endpoint: subscription.endpoint }
      })
    } catch (schemaErr: any) {
      // Column 'type' doesn't exist in database yet - use legacy insert without type
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
      // Other schema error - rethrow
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
