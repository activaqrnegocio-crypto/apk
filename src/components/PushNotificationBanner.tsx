// src/components/PushNotificationBanner.tsx
// Banner para notificaciones en APK (Firebase FCM)
'use client'

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export default function PushNotificationBanner() {
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!Capacitor.isNativePlatform()) return

    const checkPermissions = async () => {
      try {
        const result = await PushNotifications.checkPermissions()
        console.log('[PushBanner] APK permissions:', JSON.stringify(result))
        
        if (result.receive === 'granted') {
          setStatus('granted')
          return
        }
        if (result.receive === 'denied') {
          setStatus('denied')
          return
        }
        
        setStatus('prompt')
        setTimeout(() => setVisible(true), 2000)
      } catch (err) {
        console.error('[PushBanner] Error:', err)
        setStatus('unsupported')
      }
    }

    checkPermissions()
  }, [])

  const handleAccept = async () => {
    if (!Capacitor.isNativePlatform()) return

    try {
      const result = await PushNotifications.requestPermissions()
      if (result.receive === 'granted') {
        await PushNotifications.register()
        console.log('[PushBanner] Registered')
        setStatus('subscribed')
        setVisible(false)
      }
    } catch (err) {
      console.error('[PushBanner] Error:', err)
    }
  }

  if (!Capacitor.isNativePlatform() || status !== 'prompt' || !visible) {
    return null
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(135deg, #036BB2 0%, #025A9A 100%)',
      color: 'white', padding: '20px', borderRadius: '20px 20px 0 0',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)', zIndex: 9999,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ fontSize: '24px' }}>🔔</div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: '600' }}>
            ¡Activa las notificaciones!
          </h4>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
            Recibe alertas de proyectos y mensajes.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <button onClick={() => setVisible(false)} style={{
          flex: 1, padding: '12px', background: 'rgba(255,255,255,0.2)',
          border: 'none', borderRadius: '10px', color: 'white',
          fontSize: '14px', cursor: 'pointer',
        }}>Ahora no</button>
        <button onClick={handleAccept} style={{
          flex: 1, padding: '12px', background: 'white',
          border: 'none', borderRadius: '10px', color: '#036BB2',
          fontSize: '14px', fontWeight: '600', cursor: 'pointer',
        }}>Activar</button>
      </div>
    </div>
  )
}