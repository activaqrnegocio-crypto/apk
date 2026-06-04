// src/components/CapacitorPlugins.tsx
// Pre-carga plugins de Capacitor para evitar CHUNKLOADERROR offline en APK
'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export default function CapacitorPlugins({ children }: { children?: React.ReactNode }) {
  const [pluginsReady, setPluginsReady] = useState(false)

  useEffect(() => {
    // Solo pre-cargar en APK, no en PWA
    if (!Capacitor.isNativePlatform()) {
      setPluginsReady(true)
      return
    }

    const preloadPlugins = async () => {
      try {
        console.log('[CapacitorPlugins] Pre-loading native plugins...')
        
        // Pre-load all plugins that will be used dynamically
        await Promise.allSettled([
          // Audio recorder - commonly used
          import('@capgo/capacitor-audio-recorder').then(m => console.log('[CapacitorPlugins] AudioRecorder loaded')),
          
          // Camera - commonly used
          import('@capacitor/camera').then(m => console.log('[CapacitorPlugins] Camera loaded')),
          
          // Filesystem - commonly used
          import('@capacitor/filesystem').then(m => console.log('[CapacitorPlugins] Filesystem loaded')),
          
          // Geolocation - commonly used
          import('@capacitor/geolocation').then(m => console.log('[CapacitorPlugins] Geolocation loaded')),
          
          // Push notifications
          import('@capacitor/push-notifications').then(m => console.log('[CapacitorPlugins] PushNotifications loaded')),
          
          // Firebase Messaging (FCM)
          import('@capacitor-firebase/messaging').then(m => console.log('[CapacitorPlugins] FCM loaded')),
        ])
        
        console.log('[CapacitorPlugins] All plugins pre-loaded successfully')
        setPluginsReady(true)
      } catch (err) {
        console.warn('[CapacitorPlugins] Some plugins failed to pre-load, will try on-demand:', err)
        // Still allow app to work, plugins will load on-demand
        setPluginsReady(true)
      }
    }

    preloadPlugins()
  }, [])

  // Always render children - plugins just need to be loaded, not blocking
  return <>{children}</>
}