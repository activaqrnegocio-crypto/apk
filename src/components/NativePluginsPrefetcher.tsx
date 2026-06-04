// src/components/NativePluginsPrefetcher.tsx
// Pre-carga plugins de Capacitor para evitar CHUNKLOADERROR offline en APK
'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

export default function NativePluginsPrefetcher() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[NativePluginsPrefetcher] No es APK, omitiendo')
      return
    }

    const cacheNativePlugins = async () => {
      console.log('[NativePluginsPrefetcher] Iniciando cache de plugins nativos...')
      
      try {
        const pluginModules = [
          '@capgo/capacitor-audio-recorder',
          '@capacitor/camera',
          '@capacitor/filesystem',
          '@capacitor/geolocation',
          '@capacitor/push-notifications',
          '@capacitor-firebase/messaging',
        ]

        console.log('[NativePluginsPrefetcher] Pre-cargando plugins JavaScript...')
        
        await Promise.allSettled(
          pluginModules.map(async (moduleName) => {
            try {
              await import(/* webpackIgnore: true */ moduleName)
              console.log('[NativePluginsPrefetcher] Pre-cargado: ' + moduleName)
            } catch (err) {
              console.warn('[NativePluginsPrefetcher] Error pre-cargando ' + moduleName + ':', err)
            }
          })
        )

        console.log('[NativePluginsPrefetcher] Pre-carga de plugins completada')
        
        const apiEndpoints = [
          '/api/auth/session',
          '/api/projects',
          '/api/operator/projects',
          '/api/materials',
          '/api/clients',
          '/api/appointments',
          '/api/admin/calendar/query',
          '/api/quotes',
          '/api/users',
          '/api/admin/calendar/projects-by-operators',
        ]

        for (const endpoint of apiEndpoints) {
          try {
            const response = await fetch(endpoint)
            if (response.ok) {
              console.log('[NativePluginsPrefetcher] Cacheado: ' + endpoint)
            }
          } catch (err) {
            console.warn('[NativePluginsPrefetcher] No cacheado (offline): ' + endpoint)
          }
        }

        const offlineShells = [
          '/admin/proyectos/offline-shell',
          '/admin/operador/proyecto/offline-shell',
        ]

        for (const shell of offlineShells) {
          try {
            const response = await fetch(shell)
            if (response.ok) {
              console.log('[NativePluginsPrefetcher] Shell cacheado: ' + shell)
            }
          } catch (err) {
            console.warn('[NativePluginsPrefetcher] Shell no cacheado: ' + shell)
          }
        }

        console.log('[NativePluginsPrefetcher] Cacheo completado')
      } catch (err) {
        console.error('[NativePluginsPrefetcher] Error en cacheo:', err)
      }
    }

    const timer = setTimeout(cacheNativePlugins, 5000)

    return () => clearTimeout(timer)
  }, [])

  return null
}