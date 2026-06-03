// filepath: src/lib/location-bridge.ts
import { Capacitor } from '@capacitor/core'
import { Geolocation, Position } from '@capacitor/geolocation'

export interface GPSCoords {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export async function getCurrentPosition(): Promise<GPSCoords> {
  if (Capacitor.isNativePlatform()) {
    const position: Position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
    })
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    }
  } else {
    // Fallback web
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const status = await Geolocation.checkPermissions()
    return status.location === 'granted'
  }
  return true // Web siempre pregunta
}
