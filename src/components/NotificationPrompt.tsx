'use client'

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

interface NotificationPromptProps {
  onDismiss?: () => void
}

export default function NotificationPrompt({ onDismiss }: NotificationPromptProps) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Solo mostrar en APK (no en PWA)
    if (!Capacitor.isNativePlatform()) {
      console.log('[NotificationPrompt] No es APK, omitiendo prompt')
      return
    }

    // Verificar si ya se rechazó previamente
    const dismissedKey = 'notifications_prompt_dismissed'
    if (localStorage.getItem(dismissedKey)) {
      console.log('[NotificationPrompt] Ya fue descartado antes')
      return
    }

    // Verificar si ya tiene permiso
    PushNotifications.checkPermissions().then(result => {
      if (result.receive === 'granted') {
        console.log('[NotificationPrompt] Ya tiene permiso')
        return
      }
      // Mostrar prompt después de 2 segundos
      setTimeout(() => setVisible(true), 2000)
    }).catch(() => {
      setTimeout(() => setVisible(true), 2000)
    })

    return () => {
      // Cleanup
    }
  }, [])

  const handleAccept = async () => {
    setLoading(true)
    try {
      // Solicitar permiso
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive === 'granted') {
        // Registrar
        await PushNotifications.register()
        console.log('[NotificationPrompt] Permiso concedido y registrado')
        setVisible(false)
      } else {
        console.log('[NotificationPrompt] Permiso denegado')
        alert('Para recibir notificaciones, activa el permiso en Configuración')
      }
    } catch (err) {
      console.error('[NotificationPrompt] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('notifications_prompt_dismissed', 'true')
    setDismissed(true)
    setVisible(false)
    onDismiss?.()
  }

  // No renderizar si no es APK, ya fue descartado, o no debe ser visible
  if (!Capacitor.isNativePlatform() || dismissed || !visible) {
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(135deg, #036BB2 0%, #025A9A 100%)',
      color: 'white',
      padding: '20px',
      borderRadius: '20px 20px 0 0',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      zIndex: 9999,
      animation: 'slideUp 0.3s ease-out',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
        }}>
          🔔
        </div>
        
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: '600' }}>
            ¡Activa las notificaciones!
          </h4>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
            Recibe alertas de nuevos proyectos, mensajes y más.
          </p>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <button
          onClick={handleDismiss}
          style={{
            flex: 1,
            padding: '12px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Ahora no
        </button>
        <button
          onClick={handleAccept}
          disabled={loading}
          style={{
            flex: 1,
            padding: '12px',
            background: 'white',
            border: 'none',
            borderRadius: '10px',
            color: '#036BB2',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Activando...' : 'Activar'}
        </button>
      </div>
    </div>
  )
}