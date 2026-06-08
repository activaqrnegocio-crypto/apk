import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendFCMDataOnly, type FCMPayload } from '@/lib/firebase-admin'

// POST: Send a test notification to the current user
// v412: Si hay suscripcion FCM, solo usa FCM (para APK)
// Si no hay FCM, usa sendPushToUser normal (para PWA)
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = Number(session.user.id)

    // Buscar suscripcion FCM activa
    const fcmSub = await prisma.pushSubscription.findFirst({
      where: { userId, type: 'fcm', fcmToken: { not: null } },
      orderBy: { createdAt: 'desc' }
    })

    if (fcmSub && fcmSub.fcmToken) {
      // Hay FCM - enviar solo por FCM (APK)
      console.log('[PUSH Test] Enviando solo por FCM, token:', fcmSub.id);
      
      const payload: FCMPayload = {
        title: '🔔 ¡Notificaciones Activadas!',
        body: `Hola ${session.user.name}, recibirás alertas de proyectos, mensajes y más.`,
        data: { url: '/admin/operador', tag: 'test' }
      }
      
      const result = await sendFCMDataOnly(fcmSub.fcmToken, payload);
      
      if (result === 'INVALID_TOKEN') {
        await prisma.pushSubscription.delete({ where: { id: fcmSub.id } }).catch(() => {})
        return NextResponse.json({ error: 'Token FCM inválido' }, { status: 400 })
      }
      
      return NextResponse.json({ success: true, channel: 'fcm' })
    }

    // No hay FCM - usar sendPushToUser normal (PWA)
    const { sendPushToUser } = await import('@/lib/push')
    await sendPushToUser(userId, {
      title: '🔔 ¡Notificaciones Activadas!',
      body: `Hola ${session.user.name}, recibirás alertas de proyectos, mensajes y más.`,
      url: '/admin/operador',
      tag: 'test'
    })

    return NextResponse.json({ success: true, channel: 'vapid' })
  } catch (error) {
    console.error('[PUSH Test ERROR]:', error)
    return NextResponse.json({ error: 'Error sending test notification' }, { status: 500 })
  }
}
