// src/lib/pending-nav.ts
// Lee pending_url cuando la app se abre desde una notificación push
// v428: Usar SharedPreferences en vez de archivo - compatible con MainActivity

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface PendingNav {
  url: string;
  tag: string;
}

// Almacena la ruta recibida desde el evento pushRoute
let pendingRoute: string | null = null;

/**
 * Inicializa el listener para el evento pushRoute desde Android nativo.
 * v430: Agregar logs para debug
 */
export function initPushRouteListener(): void {
  if (!Capacitor.isNativePlatform()) {
    console.log('[PendingNav] initPushRouteListener: no es nativo');
    return;
  }
  
  console.log('[PendingNav] initPushRouteListener: configurando listener para pushRoute');
  
  window.addEventListener('pushRoute', ((event: CustomEvent) => {
    console.log('[PendingNav] 🔥 Evento pushRoute recibido:', event.detail);
    pendingRoute = event.detail;
  }) as EventListener);
}

/**
 * Lee y limpia pending navigation desde Android nativo.
 * v431: Retry más largo (5 intentos de 1 segundo) paradar tiempo a que el WebView esté listo
 */
export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  console.log('[PendingNav] getAndClearPendingNav llamado');
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[PendingNav] No es plataforma nativa, retornando null');
    return null;
  }
  
  // Intentar 5 veces con intervalo de 1 segundo (para eventos que llegan tarde)
  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log('[PendingNav] Intento', attempt, '/ 5 - pendingRoute:', pendingRoute);
    
    // Si hay ruta del evento pushRoute
    if (pendingRoute) {
      const result = { url: pendingRoute, tag: '' };
      pendingRoute = null;
      console.log('[PendingNav] ✅ Ruta obtenida del evento:', result.url);
      return result;
    }
    
    // Fallback: verificar SharedPreferences
    try {
      const hasPending = await Preferences.get({ key: 'has_pending' });
      const pendingUrl = await Preferences.get({ key: 'pending_url' });
      
      if (hasPending.value === 'true' && pendingUrl.value) {
        console.log('[PendingNav] ✅ Fallback - URL desde SharedPreferences:', pendingUrl.value);
        
        await Preferences.remove({ key: 'has_pending' });
        await Preferences.remove({ key: 'pending_url' });
        
        return { url: pendingUrl.value, tag: '' };
      }
    } catch (e) {
      console.log('[PendingNav] Fallback error:', e);
    }
    
    // Esperar antes del siguiente intento
    if (attempt < 5) {
      console.log('[PendingNav] Esperando 1s...');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log('[PendingNav] �� No hay pending route después de 5 intentos');
  return null;
}

/**
 * Verifica si el usuario es admin basado en su rol
 */
function isUserAdmin(role?: string): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase();
  return ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(upperRole);
}

/**
 * Limpia el pending navigation (sin retornarlo).
 * Útil para cuando ya no necesitamos navegar pero queremos limpiar.
 */
export async function clearPendingNavFile(): Promise<void> {
  console.log('[PendingNav] clearPendingNavFile llamado');
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await Preferences.remove({ key: 'has_pending' });
    await Preferences.remove({ key: 'pending_url' });
    await Preferences.remove({ key: 'pending_tag' });
    console.log('[PendingNav] SharedPreferences limpiadas');
  } catch (e) {
    console.log('[PendingNav] Error limpiando:', e);
  }
}

/**
 * Parsea URL_PROJECT_CHAT:projectId:messageId y retorna la URL de navegación
 * v421: Usa formatos exactos según el rol del usuario
 * - Admin: /admin/proyectos/{id}?view=CHAT
 * - Operator: /admin/operador/proyecto/{id}?view=chat
 */
export function parseProjectChatUrl(url: string, userRole?: string): string {
  // Formato: URL_PROJECT_CHAT:123:456
  if (url.startsWith('URL_PROJECT_CHAT:')) {
    const parts = url.replace('URL_PROJECT_CHAT:', '').split(':');
    const projectId = parts[0];
    
    // FIX v424: Determinar el rol (por defecto OPERADOR si no está definido)
    const role = userRole || 'OPERADOR';

    // Generar URL según el rol del usuario - formatos exactos
    if (isUserAdmin(role)) {
      // Admin: /admin/proyectos/{id}?view=CHAT
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (role.toUpperCase() === 'SUBCONTRATISTA') {
      // Subcontratista: /admin/subcontratista/proyecto/{id}?view=chat
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      // Operador: /admin/operador/proyecto/{id}?view=chat
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
  // Otros formatos: URL_PROJECT:123 → /admin/proyectos/123 (sin /admin)
  if (url.startsWith('URL_PROJECT:')) {
    const projectId = url.replace('URL_PROJECT:', '');
    
    if (isUserAdmin(userRole)) {
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (userRole?.toUpperCase() === 'SUBCONTRATISTA') {
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
  return url;
}