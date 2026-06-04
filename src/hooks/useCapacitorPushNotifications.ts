// src/hooks/useCapacitorPushNotifications.ts
// Hook para notificaciones push en APK (Firebase FCM)
'use client'

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

type CapacitorPushStatus = 'loading' | 'unavailable' | 'prompt' | 'granted' | 'denied' | 'subscribed'

export function useCapacitorPushNotifications() {
  const [status, setStatus] = useState<CapacitorPushStatus>('loading')
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Solo ejecutar en APK
    if (!Capacitor.isNativePlatform()) {
      console.log('[CapacitorPush] No es APK, usando hook de PWA')
      setStatus('unavailable')
      return
    }

    const checkPermissions = async () => {
      try {
        console.log('[CapacitorPush] Verificando permisos en APK...')
        
        // Verificar si el plugin está disponible
        const result = await PushNotifications.checkPermissions()
        console.log('[CapacitorPush] Permisos actuales:', JSON.stringify(result))
        
        if (result.receive === 'granted') {
          console.log('[CapacitorPush] Ya tiene permiso de notificaciones')
          setStatus('granted')
          
          // Verificar si ya está registrado
          try {
            await PushNotifications.register()
            console.log('[CapacitorPush] Dispositivo registrado con FCM')
            setStatus('subscribed')
          } catch (regErr) {
            console.warn('[CapacitorPush] Error registrando:', regErr)
          }
        } else if (result.receive === 'denied') {
          console.log('[CapacitorPush] Permiso denegado')
          setStatus('denied')
        } else {
          // Default o prompt - mostrar onboarding
          console.log('[CapacitorPush] Permiso pendiente, mostrando prompt')
          setStatus('prompt')
        }
      } catch (err) {
        console.error('[CapacitorPush] Error verificando permisos:', err)
        setStatus('unavailable')
      }
    }

    // Delay para asegurar que la app está lista
    const timer = setTimeout(checkPermissions, 2000)
    return () => clearTimeout(timer)
  }, [])

  const requestPermission = async () => {
    if (!Capacitor.isNativePlatform()) return false
    
    setIsSubscribing(true)
    try {
      console.log('[CapacitorPush] Solicitando permiso...')
      const result = await PushNotifications.requestPermissions()
      console.log('[CapacitorPush] Resultado:', JSON.stringify(result))
      
      if (result.receive === 'granted') {
        console.log('[CapacitorPush] Permiso concedido')
        await PushNotifications.register()
        console.log('[CapacitorPush] Registrado exitosamente')
        setStatus('subscribed')
        return true
      } else {
        console.log('[CapacitorPush] Permiso denegado')
        setStatus('denied')
        return false
      }
    } catch (err) {
      console.error('[CapacitorPush] Error solicitando permiso:', err)
      setStatus('denied')
      return false
    } finally {
      setIsSubscribing(false)
    }
  }

  return {
    status,
    isSubscribing,
    showOnboarding,
    setShowOnboarding,
    requestPermission,
  }
}