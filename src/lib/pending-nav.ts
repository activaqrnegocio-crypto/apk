// src/lib/pending-nav.ts
// Lee pending_url cuando la app se abre desde una notificación push
// v428: Usar SharedPreferences en vez de archivo - compatible con MainActivity

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface PendingNav {
  url: string;
  tag: string;
}

/**
 * Lee y limpia pending navigation desde Android nativo.
 * v428: Usa SharedPreferences (compatible con MainActivity)
 */
export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  console.log('[PendingNav] getAndClearPendingNav llamado');
  if (!Capacitor.isNativePlatform()) {
    console.log('[PendingNav] No es plataforma nativa, retornando null');
    return null;
  }

  try {
    console.log('[PendingNav] Leyendo de SharedPreferences...');
    
    const hasPending = await Preferences.get({ key: 'has_pending' });
    const pendingUrl = await Preferences.get({ key: 'pending_url' });
    const pendingTag = await Preferences.get({ key: 'pending_tag' });
    
    console.log('[PendingNav] has_pending:', hasPending.value);
    console.log('[PendingNav] pending_url:', pendingUrl.value);
    
    if (hasPending.value === 'true' && pendingUrl.value) {
      console.log('[PendingNav] URL:', pendingUrl.value);
      console.log('[PendingNav] Tag:', pendingTag.value);
      
      // Limpiar después de leer
      await Preferences.remove({ key: 'has_pending' });
      await Preferences.remove({ key: 'pending_url' });
      await Preferences.remove({ key: 'pending_tag' });
      console.log('[PendingNav] SharedPreferences limpiadas');
      
      return {
        url: pendingUrl.value,
        tag: pendingTag.value || ''
      };
    }
  } catch (e) {
    console.log('[PendingNav] Error:', e);
  }

  console.log('[PendingNav] No hay pending navigation');
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