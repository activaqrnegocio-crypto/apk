// src/lib/capacitor-offline.ts
// Wrapper para evitar CHUNKLOADERROR cuando offline en APK

import { Capacitor } from '@capacitor/core'

interface OfflineResult<T> {
  success: boolean
  data?: T
  error?: string
  offline?: boolean
}

export async function importPlugin<T>(importer: () => Promise<T>, fallback: T): Promise<OfflineResult<T>> {
  if (!Capacitor.isNativePlatform()) {
    return { success: true, data: fallback, offline: false }
  }
  
  try {
    // Verificar si hay conexión
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, error: 'Offline', offline: true }
    }
    
    const module = await importer()
    return { success: true, data: module }
  } catch (err: any) {
    console.warn('[CapacitorOffline] Chunk load error, assuming offline:', err.message)
    return { success: false, error: err.message, offline: true }
  }
}