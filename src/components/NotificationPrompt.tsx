"use client"

import { useState, useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"

interface NotificationPromptProps {
  onDismiss?: () => void
}

export default function NotificationPrompt({ onDismiss }: NotificationPromptProps) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Solo mostrar en APK (no en PWA)
    const isNative = Capacitor.isNativePlatform()
    console.log("[NotificationPrompt] isNativePlatform:", isNative)
    
    if (!isNative) {
      console.log("[NotificationPrompt] No es APK, omitiendo prompt")
      return
    }

    // v412: SIEMPRE inicializar Firebase foreground messaging al arrancar la APK
    // Esto es necesario para capturar notificaciones cuando la app está ABIERTA
    // No depende de si el usuario ya aceptó o no - necesita ejecutarse siempre
    const initializeForegroundMessaging = async () => {
      try {
        const { initFirebaseForegroundMessaging } = await import("@/lib/firebase-client")
        await initFirebaseForegroundMessaging((notification) => {
          console.log('[NotificationPrompt] Notificación foreground recibida:', notification)
          // Aquí puedes mostrar un toast, actualizar estado, etc.
        })
        console.log('[NotificationPrompt] Firebase foreground messaging inicializado')
      } catch (e) {
        console.warn('[NotificationPrompt] Error inicializando Firebase foreground:', e)
      }
    }
    
    initializeForegroundMessaging()

    // Verificar si ya acepto notificaciones antes para mostrar/ocultar prompt
    const alreadyAccepted = localStorage.getItem("push_accepted") === "true"
    if (alreadyAccepted) {
      console.log("[NotificationPrompt] Ya aceptado antes, omitiendo prompt")
      return
    }

    // En APK siempre mostrar el prompt despues de 3 segundos
    const timer = setTimeout(() => {
      console.log("[NotificationPrompt] Mostrando prompt de notificaciones")
      setVisible(true)
    }, 3000)
    
    return () => {
      clearTimeout(timer)
    }
  }, [])

  const handleAccept = async () => {
    setLoading(true)
    try {
      // v408: Usar registerFCMToken que ya tiene toda la logica de permisos + registro + listeners
      const sessionRes = await fetch("/api/auth/session")
      const session = await sessionRes.json()
      if (!session?.user?.id) {
        console.error("[NotificationPrompt] No user session found")
        setLoading(false)
        return
      }

      // v416: Importar y llamar registerFCMToken
      // Si el permiso es denegado, registerFCMToken muestra alert y retorna false
      const { registerFCMToken } = await import("@/lib/push-native")
      const result = await registerFCMToken(Number(session.user.id))
      
      console.log("[NotificationPrompt] FCM registration complete, result:", result)
      
      // v416: Solo marcar como aceptado si el registro fue exitoso
      // registerFCMToken retorna false si el permiso fue denegado
      if (result === false) {
        console.log("[NotificationPrompt] Registro cancelado por permiso denegado")
        setLoading(false)
        return
      }
      
      setVisible(false)
      localStorage.setItem("push_accepted", "true")
      
    } catch (err) {
      console.error("[NotificationPrompt] Error:", err)
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

  // No renderizar si no es APK o ya fue descartado
  if (!Capacitor.isNativePlatform() || dismissed) {
    return null
  }

  // No mostrar si no debe ser visible
  if (!visible) {
    return null
  }

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "linear-gradient(135deg, #036BB2 0%, #025A9A 100%)",
      color: "white",
      padding: "20px",
      borderRadius: "20px 20px 0 0",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
      zIndex: 9999,
      animation: "slideUp 0.3s ease-out",
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      
      <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        <div style={{
          background: "rgba(255,255,255,0.2)",
          borderRadius: "50%",
          width: "50px",
          height: "50px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
        }}>
          🔔
        </div>
        
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: "0 0 5px 0", fontSize: "16px", fontWeight: "600" }}>
            Activa las notificaciones!
          </h4>
          <p style={{ margin: 0, fontSize: "13px", opacity: 0.9 }}>
            Recibe alertas de nuevos proyectos, mensajes y mas.
          </p>
        </div>
      </div>
      
      <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
        <button
          onClick={handleDismiss}
          style={{
            flex: 1,
            padding: "12px",
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "10px",
            color: "white",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          Ahora no
        </button>
        <button
          onClick={handleAccept}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px",
            background: "white",
            border: "none",
            borderRadius: "10px",
            color: "#036BB2",
            fontSize: "14px",
            fontWeight: "600",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Activando..." : "Activar"}
        </button>
      </div>
    </div>
  )
}