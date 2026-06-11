'use client'

import { signOut } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ForceLogoutPage() {
  const router = useRouter()
  
  useEffect(() => {
    async function doLogout() {
      console.log('[ForceLogout] Ejecutando logout forzado...')
      
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
  }, [router])
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Cerrando sesión...</p>
    </div>
  )
}