// Debug endpoint to check push subscriptions
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = Number(session.user.id)
    
    // Get all subscriptions for current user
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: currentUserId },
      orderBy: { createdAt: 'desc' }
    })

    // Get all FCM subscriptions
    const fcmSubs = await prisma.pushSubscription.findMany({
      where: { type: 'fcm' },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return NextResponse.json({
      currentUserId,
      userSubscriptions: subs,
      recentFCMSubscriptions: fcmSubs,
      totalFCMCount: fcmSubs.length
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}