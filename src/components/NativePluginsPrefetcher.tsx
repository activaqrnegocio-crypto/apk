'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * APK Native Plugins Prefetcher
 * 
 * Descarga y cachea los recursos necesarios para que los plugins nativos
 * de Capacitor funcionen offline en la APK:
 * - Camera
 * - Audio Recorder  
 * - Geolocation
 * - Filesystem
 * 
 * Solo se ejecuta en APK (Capacitor.isNativePlatform())
 */
export default function NativePluginsPrefetcher() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[NativePluginsPrefetcher] No es APK, omitiendo')
      return
    }

    const cacheNativePlugins = async () => {
      console.log('[NativePluginsPrefetcher] Iniciando cache de plugins nativos...')
      
      try {
        // APIs que necesitan estar cacheadas para funcionar offline
        const apiEndpoints = [
          // Auth y session
          '/api/auth/session',
          
          // Projects - críticos para operación offline
          '/api/projects',
          '/api/operator/projects',
          
          // Materials/Inventory
          '/api/materials',
          
          // Clients
          '/api/clients',
          
          // Appointments/Calendar
          '/api/appointments',
          '/api/admin/calendar/query',
          
          // Quotes
          '/api/quotes',
          
          // Users/Team
          '/api/users',
          '/api/admin/calendar/projects-by-operators',
        ]

        // Cache each endpoint
        for (const endpoint of apiEndpoints) {
          try {
            const response = await fetch(endpoint)
            if (response.ok) {
              console.log(`[NativePluginsPrefetcher] Cacheado: ${endpoint}`)
            }
          } catch (err) {
            // Silently fail - endpoint might not be available offline
            console.warn(`[NativePluginsPrefetcher] No cacheado (offline): ${endpoint}`)
          }
        }

        // Cache las páginas de offline shells específicas
        const offlineShells = [
          '/admin/proyectos/offline-shell',
          '/admin/operador/proyecto/offline-shell',
        ]

        for (const shell of offlineShells) {
          try {
            const response = await fetch(shell)
            if (response.ok) {
              console.log(`[NativePluginsPrefetcher] Shell cacheado: ${shell}`)
            }
          } catch (err) {
            console.warn(`[NativePluginsPrefetcher] Shell no cacheado: ${shell}`)
          }
        }

        console.log('[NativePluginsPrefetcher] Cacheo completado')
      } catch (err) {
        console.error('[NativePluginsPrefetcher] Error en cacheo:', err)
      }
    }

    // Ejecutar después de que la app cargue (5s de delay como GlobalSyncWorker)
    const timer = setTimeout(cacheNativePlugins, 5000)

    return () => clearTimeout(timer)
  }, [])

  return null
}