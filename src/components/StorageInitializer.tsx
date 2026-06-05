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
        
        // NOTA: El registro FCM ahora solo se hace en NotificationPrompt.tsx
        // para evitar registros duplicados que causaban conflictos
        
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