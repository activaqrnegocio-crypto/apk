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
    const isNative = Capacitor.isNativePlatform();
    console.log('[NotificationPrompt] isNativePlatform:', isNative);
    
    if (!isNative) {
      console.log('[NotificationPrompt] No es APK, omitiendo prompt');
      return;
    }

    // Verificar si ya aceptó notificaciones antes
    const alreadyAccepted = localStorage.getItem('push_accepted') === 'true'
    if (alreadyAccepted) {
      console.log('[NotificationPrompt] Ya aceptado antes, omitiendo');
      return
    }

    // En APK siempre mostrar el prompt después de 3 segundos
    const timer = setTimeout(() => {
      console.log('[NotificationPrompt] Mostrando prompt de notificaciones');
      setVisible(true);
    }, 3000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [])

  const handleAccept = async () => {
    setLoading(true)
    try {
      // Verificar estado actual del permiso
      const checkResult = await PushNotifications.checkPermissions()
      console.log('[NotificationPrompt] Estado actual del permiso:', checkResult)
      
      // Solicitar permiso
      const permission = await PushNotifications.requestPermissions()
      console.log('[NotificationPrompt] Resultado de requestPermissions:', permission)
      
      if (permission.receive === 'granted') {
        // Registrar
        await PushNotifications.register()
        console.log('[NotificationPrompt] Permiso concedido y registrado')
        
        // Mostrar éxito y cerrar
        setVisible(false)
        
        // Guardar que el usuario aceptó para no mostrar de nuevo
        localStorage.setItem('push_accepted', 'true')
        
        // Alertar al usuario que las notificaciones están activas
        setTimeout(() => {
          alert('¡Notificaciones activadas! Recibirás alertas de proyectos y mensajes.')
        }, 500)
      } else if (permission.receive === 'denied') {
        console.log('[NotificationPrompt] Permiso denegado')
        alert('Para recibir notificaciones, activa el permiso en Configuración > Aplicaciones > Aquatech > Notificaciones')
      } else {
        console.log('[NotificationPrompt] Permiso en estado:', permission.receive)
        // El permiso puede estar en "default" o "prompt" - intentar registrar de todas formas
        try {
          await PushNotifications.register()
          localStorage.setItem('push_accepted', 'true')
          setVisible(false)
          setTimeout(() => {
            alert('¡Notificaciones activadas!')
          }, 500)
        } catch (regErr) {
          console.error('[NotificationPrompt] Error en registro:', regErr)
        }
      }
    } catch (err) {
      console.error('[NotificationPrompt] Error:', err)
      alert('Error al activar notificaciones. Verifica tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    // No guardar en localStorage - siempre mostrar al entrar a la APK
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