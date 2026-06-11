'use client'

import './admin.css'

import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import StorageInitializer from '@/components/StorageInitializer'
import NotificationPrompt from '@/components/NotificationPrompt'
import NativePluginsPrefetcher from '@/components/NativePluginsPrefetcher'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

import { useSession } from 'next-auth/react'
import OfflineErrorBoundary from '@/components/OfflineErrorBoundary'

// Fase 2: Dynamic import — these are invisible background workers (51KB + 1KB)
// They don't affect visual render, so they load AFTER the UI paints
const GlobalSyncWorker = dynamic(() => import('@/components/GlobalSyncWorker'), { ssr: false })
const OfflinePrefetcher = dynamic(() => import('@/components/OfflinePrefetcher'), { ssr: false })
const SyncToast = dynamic(() => import('@/components/SyncToast'), { ssr: false })
import { useState, useEffect, useRef } from 'react'
import { getAndClearPendingNav, checkPendingNav, parseProjectChatUrl, initPushRouteListener, clearPendingNavFile, clearPendingNavAfterUse } from '@/lib/pending-nav'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  // v423: USAR REF para evitar race conditions
  const pendingNavRef = useRef(false);
  
  // Función para procesar navegación pendiente

// v455: Delay inicial MAYOR para cold start (8 segundos para esperar cold start completo)
  // Función para procesar navegación con reintentos
  // Espera hasta que la sesión esté lista (para cold start)
  async function processPendingNav(retries = 12, delayMs = 1000) {
    // v600: VERIFICAR SI HAY DATOS PENDIENTES antes de procesar
    // Esto evita ejecuciones innecesarias cuando no hay nada que procesar
    const hasPending = await checkPendingNav();
    if (!hasPending) {
      console.log('[PendingNav] No hay datos pendientes, salir');
      return;
    }
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      // v456: Si ya procesamos, salir del bucle
      if (pendingNavRef.current) {
        console.log('[PendingNav] Ya procesado, saliendo del bucle');
        return;
      }
      
      // v500: Tambien verificar flag global
      if ((window as any).__pendingNavDone) {
        console.log('[PendingNav] __pendingNavDone=true, salir');
        return;
      }
      
      console.log('[PendingNav] Intento', attempt, 'de', retries);
      
      // v455: Delay inicial mayor para cold start (8 segundos para esperar cold start completo)
      if (attempt === 1) {
console.log('[PendingNav] Esperando inicialización cold start (8s)...');
        await new Promise(r => setTimeout(r, 8000));
        
        // También esperar sesión si no está lista
        if (!session) {
          console.log('[PendingNav] Esperando sesión...');
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      const pending = await getAndClearPendingNav();
      if (!pending?.url) {
        // Reintentar con delay (no en primer intento ya tuvo delay)
        if (attempt < retries) {
          console.log('[PendingNav] Reintentando en', delayMs, 'ms...');
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        console.log('[PendingNav] No hay pending navigation despues de', retries, 'intentos');
        return;
      }

      // MARCAR INMEDIATAMENTE (v456 - evitar reintentos que sobrescriben)
      (window as any).__pendingNavDone = true;
      pendingNavRef.current = true; // v456: Marcar ref también
      console.log('[PendingNav] URL recibida:', pending.url);

      // Extraer projectId
      let projectId = '';
      if (pending.url.includes('URL_PROJECT_CHAT:')) {
        projectId = pending.url.replace('URL_PROJECT_CHAT:', '').split(':')[0];
      } else if (pending.url.includes('URL_PROJECT:')) {
        projectId = pending.url.replace('URL_PROJECT:', '');
      }
      
      // OBTENER ROL DEL USUARIO para navegar correctamente
      // Primero intentar de session, luego de localStorage
      let userRole = 'ADMIN';
      try {
        if (session?.user?.role) {
          userRole = session.user.role as string;
          // También guardar en localStorage para frío start
          localStorage.setItem('last_user_role', userRole);
        } else {
          userRole = localStorage.getItem('last_user_role') || 'ADMIN';
        }
      } catch (e) {}
      console.log('[PendingNav] User role:', userRole);
      
      // v457: Detectar si es cold start (app iniciada desde cero vs minimizada)
      // En cold start, router.replace() puede no funcionar correctamente
      const isColdStart = !pathname || pathname === '/' || pathname === '';
      
      // Navegar según el rol del usuario
      // v457: Usar window.location.href en cold start, router.replace() en app ya abierta
      if (projectId) {
        const targetPath = userRole === 'OPERATOR' || userRole === 'SUBCONTRATISTA'
          ? `/admin/operador/proyecto/${projectId}?view=CHAT`
          : `/admin/proyectos/${projectId}?view=CHAT`;
        
        console.log('[PendingNav] Navegando a:', targetPath, '(coldStart:', isColdStart, ')');
        
        // v456: MARCAR como hecho ANTES de navegar (evita reintentos que sobrescriben)
        pendingNavRef.current = true;
        
        // v457: Navigation diferente según tipo de inicio
        if (isColdStart) {
          // Cold start: usar window.location.href para garantizar navegación
          window.location.href = targetPath;
        } else {
          // App ya abierta: usar router.replace() (más suave)
          router.replace(targetPath);
        }
        
        // v456: Limpiar después de navegación
        setTimeout(() => {
          clearPendingNavAfterUse();
          console.log('[PendingNav] Limpieza post-navegación');
        }, 500);
      } else {
        // Sin projectId - ir a dashboard
        pendingNavRef.current = true;
        if (isColdStart) {
          window.location.href = '/admin';
        } else {
          router.push('/admin');
        }
        setTimeout(() => {
          clearPendingNavAfterUse();
        }, 500);
      }
      
      return;
    }
  }
  
  useEffect(() => {
    // v436: Guardar el rol del usuario cuando la sesión está disponible
    if (session?.user?.role) {
      const userRole = session.user.role as string;
      localStorage.setItem('last_user_role', userRole);
      console.log('[AdminLayout] Rol guardado desde sesión:', userRole);
    }
    
    // v429: Inicializar listener para pushRoute desde Android nativo
    initPushRouteListener();
    
    console.log('[AdminLayout] Ejecutando handlePendingNav');
    processPendingNav();
    
    // APP ABIERTA EN FOREGROUND: escuchar eventos pushRoute directamente
    const handlePushRoute = (event: Event) => {
      console.log('[PendingNav] pushRoute evento recibido (app abierta):', (event as CustomEvent).detail);
      // v600: Ya no reseteamos flag - checkPendingNav verificará si hay datos
      // (window as any).__pendingNavDone = false;
      // Procesar la nueva ruta
      processPendingNav();
    };
    
    window.addEventListener('pushRoute', handlePushRoute as EventListener);
    
    return () => {
      window.removeEventListener('pushRoute', handlePushRoute as EventListener);
    };
  }, [session]); // Incluir session para guardar el rol
  
  // useEffect PARA APP MINIMIZADA - detectar cuando vuelve del background
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[PendingNav] App visible (volviendo de minimize)');
        // v600: Ya no reseteamos flag - checkPendingNav verificará si hay datos
        // (window as any).__pendingNavDone = false;
        // Delay para dar tiempo al nativo de escribir pending route
        await new Promise(r => setTimeout(r, 1500));
        // Procesar cualquier ruta pendiente
        await processPendingNav();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // Show progress bar on path change
    setIsNavigating(true)
    const timer = setTimeout(() => setIsNavigating(false), 1000)
    return () => clearTimeout(timer)
  }, [pathname])

  const isLoginPage = pathname === '/admin/login'
  const isDashboard = 
    pathname === '/admin' || pathname === '/admin/' || 
    pathname === '/admin/operador' || pathname === '/admin/operador/' ||
    pathname === '/admin/subcontratista' || pathname === '/admin/subcontratista/' ||
    pathname === '/admin/proyectos' || pathname === '/admin/proyectos/'

  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Determine pages to pre-cache for offline availability
  const getPagesToPrefetch = () => {
    if (!session?.user) return []
    const role = (session.user as any).role
    const isOp = role === 'OPERATOR' || role === 'OPERADOR' || role === 'SUBCONTRATISTA'
    
    if (isOp) {
      const base = role === 'SUBCONTRATISTA' ? '/admin/subcontratista' : '/admin/operador'
      return [base, `${base}/nuevo`, `${base}/proyecto/offline-shell`, '/admin/inventario', '/admin/cotizaciones', '/admin/cotizaciones/nuevo', '/admin/calendario']
    }
    return ['/admin', '/admin/proyectos', '/admin/proyectos/offline-shell', '/admin/proyectos/nuevo', '/admin/inventario', '/admin/cotizaciones', '/admin/cotizaciones/nuevo', '/admin/calendario']
  }

  const pagesToPrefetch = getPagesToPrefetch()

  const [showSync, setShowSync] = useState(false)
  
  useEffect(() => {
    // v273: Delay heavy background workers to let the main page load first
    const timer = setTimeout(() => setShowSync(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoginPage) {
    return <main>{children}</main>
  }

  return (
    <div className="admin-layout">
      <ServiceWorkerRegistration />
      <StorageInitializer />
      <NotificationPrompt />
      {showSync && (
        <>
          <GlobalSyncWorker />
          <NativePluginsPrefetcher />
          <OfflinePrefetcher urls={pagesToPrefetch} />
          <SyncToast />
        </>
      )}
      <Sidebar />
      {isNavigating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '3px',
          background: 'linear-gradient(90deg, var(--primary) 0%, #38bdf8 50%, var(--primary) 100%)',
          zIndex: 9999,
          width: '100%',
          animation: 'shimmer 2s infinite linear'
        }}>
          <style jsx>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      )}
      <main className="admin-content">
        {!isOnline && (
          <div style={{
            background: '#f59e0b', color: 'white', padding: '10px 20px', 
            textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem',
            position: 'sticky', top: 0, zIndex: 50,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            📡 Modo Offline — Los cambios se guardarán y sincronizarán automáticamente
          </div>
        )}
        <OfflineErrorBoundary>
          {!isDashboard && (
            <div style={{ padding: '10px 20px 0 20px', marginBottom: '-10px' }}>
              <button 
                onClick={() => {
                  // v400: Use hard navigation (window.location.href) to prevent
                  // soft-navigation freeze caused by Service Worker shell + Dexie listeners
                  // staying active and blocking Next.js router transitions.
                  if (pathname.includes('/operador/proyecto')) {
                    window.location.href = '/admin/operador';
                  } else if (pathname.includes('/subcontratista/proyecto')) {
                    window.location.href = '/admin/subcontratista';
                  } else if (pathname.includes('/admin/proyectos/')) {
                    window.location.href = '/admin/proyectos';
                  } else if (pathname.includes('/admin/cotizaciones/')) {
                    window.location.href = '/admin/cotizaciones';
                  } else if (pathname.includes('/offline-shell')) {
                    const isOp = pathname.includes('/operador') || pathname.includes('/subcontratista');
                    window.location.href = isOp 
                      ? (pathname.includes('/subcontratista') ? '/admin/subcontratista' : '/admin/operador') 
                      : '/admin/proyectos';
                  } else {
                    // Fallback: explicit hard navigation based on current path
                    if (pathname.startsWith('/admin/operador')) window.location.href = '/admin/operador';
                    else if (pathname.startsWith('/admin/subcontratista')) window.location.href = '/admin/subcontratista';
                    else if (pathname.startsWith('/admin/proyectos')) window.location.href = '/admin/proyectos';
                    else if (pathname.startsWith('/admin/cotizaciones')) window.location.href = '/admin/cotizaciones';
                    else if (pathname.startsWith('/admin/calendario')) window.location.href = '/admin/calendario';
                    else if (pathname.startsWith('/admin/inventario')) window.location.href = '/admin/inventario';
                    else window.location.href = '/admin';
                  }
                }}
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                <span>Volver</span>
              </button>
            </div>
          )}
          {/* Fase 1: Suspense boundary — Sidebar/Header/Footer render INSTANTLY,
              page content shows skeleton while loading */}
          <Suspense fallback={
            <div style={{ padding: '24px' }}>
              <div style={{ height: '28px', width: '220px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: '180px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
            </div>
          }>
            {children}
          </Suspense>
        </OfflineErrorBoundary>
      </main>
    </div>
  )
}
