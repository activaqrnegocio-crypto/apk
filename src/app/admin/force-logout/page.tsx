'use client'

import { signOut, useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ForceLogoutPage() {
  const router = useRouter()
  const { data: session } = useSession()
  
  useEffect(() => {
    async function doLogout() {
      console.log('[ForceLogout] Ejecutando logout forzado...')
      
      // v605: Establecer flag ANTES de limpiar para que persista
      localStorage.setItem('force_logout_pending', '1')
      
      // v607: Obtener userId de localStorage (guardado por Sidebar)
      let userId: string | undefined = session?.user?.id as string | undefined
      if (!userId) {
        userId = localStorage.getItem('logout_user_id') || undefined
      }
      console.log('[ForceLogout] UserID:', userId)
      
      // Llamar API para invalidar sesión en servidor
      if (userId) {
        try {
          await fetch('/api/auth/force-logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          })
          console.log('[ForceLogout] Sesión invalidada en servidor')
        } catch (e) {
          console.log('[ForceLogout] API error:', e)
        }
      }
      
      // Limpiar todo
      localStorage.clear()
      sessionStorage.clear()
      document.cookie.split(';').forEach(function(c) { 
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); 
      })
      
      // Limpiar Capacitor Preferences
      try {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.clear()
      } catch (e) {}
      
      // Llamar signOut
      await signOut({ redirect: false })
      
      console.log('[ForceLogout] Redirigiendo a login...')
      router.replace('/admin/login')
    }
    
    doLogout()
  }, [router, session])
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Cerrando sesión...</p>
    </div>
  )
}