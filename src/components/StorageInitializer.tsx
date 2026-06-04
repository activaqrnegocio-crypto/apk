'use client'

import { useEffect, useState } from 'react'
import { initStorage } from '@/lib/storage'
import { Capacitor } from '@capacitor/core'

export default function StorageInitializer({ children }: { children?: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize storage (SQLite for APK, Dexie for PWA)
        await initStorage()
        console.log('[StorageInitializer] Storage initialized')
        
        // v380: Register FCM token for Android native (APK)
        if (Capacitor.isNativePlatform()) {
          try {
            const { registerFCMToken } = await import('@/lib/push-native')
            // Try to get userId from session, but don't block if not logged in
            try {
              const sessionRes = await fetch('/api/auth/session')
              const session = await sessionRes.json()
              if (session?.user?.id) {
                await registerFCMToken(Number(session.user.id))
              } else {
                // Not logged in, just register without userId
                console.log('[StorageInitializer] User not logged in, registering FCM anyway')
                await registerFCMToken(0) // 0 = anonymous
              }
            } catch (e) {
              // Session fetch failed, try anyway
              console.warn('[StorageInitializer] Session fetch failed:', e)
              await registerFCMToken(0)
            }
          } catch (e) {
            console.warn('[StorageInitializer] FCM registration skipped:', e)
          }
        }
        
        setInitialized(true)
      } catch (err) {
        console.warn('[StorageInitializer] Storage init failed:', err, 'Continue anyway with Dexie fallback')
        setInitialized(true)
      }
    }
    
    init()
  }, [])

  return <>{children}</>
}