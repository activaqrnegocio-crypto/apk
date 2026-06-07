// filepath: src/app/api/push/test-send/route.ts
// Test endpoint to send a push notification to a specific user
// Usage: GET /api/push/test-send?userId=61
// NOTE: This endpoint is PUBLIC (no auth) for testing purposes

import { prisma } from '@/lib/prisma';
import { sendFCMToToken, type FCMPayload } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    console.log('[TestSend] Request received from:', request.headers.get('origin') || 'unknown');
    console.log('[TestSend] URL:', request.url);

    // Check if Firebase Admin is initialized
    const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
    const app = getFirebaseAdmin();
    if (!app) {
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        cause: 'Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in environment variables'
      }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '0', 10);
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    // Get the latest FCM subscription for this user
    const subscription = await prisma.pushSubscription.findFirst({
      where: { 
        userId,
        type: 'fcm',
        fcmToken: { not: null }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription || !subscription.fcmToken) {
      return NextResponse.json({ 
        error: 'No FCM subscription found for this user',
        userId
      }, { status: 404 });
    }

    console.log('[TestSend] Attempting to send notification to:', subscription.fcmToken.substring(0, 20) + '...');

    // Try to send the notification
    const fcmPayload: FCMPayload = {
      title: 'Test Notification',
      body: 'This is a test push notification from Firebase Admin!',
      data: {
        url: '/admin/operador',
        tag: 'test',
        icon: '/icon-192.png',
      }
    };

    // Send notification with notification object so Android shows it automatically
    const result = await sendFCMToToken(subscription.fcmToken, fcmPayload);

    if (result === true) {
      console.log('[TestSend] Notification sent successfully!');
      return NextResponse.json({ 
        success: true, 
        message: 'Notification sent successfully!',
        userId,
        token: subscription.fcmToken.substring(0, 30) + '...'
      });
    } else if (result === 'INVALID_TOKEN') {
      return NextResponse.json({ 
        error: 'Token is invalid or unregistered'
      }, { status: 400 });
    } else {
      return NextResponse.json({ 
        error: 'Firebase Admin failed to send notification',
        result
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[TestSend] Error:', error);
    return NextResponse.json({ 
      error: error.message
    }, { status: 500 });
  }
}
