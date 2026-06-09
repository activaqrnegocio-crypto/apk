// src/lib/pending-nav.ts
// Lee pending_url cuando la app se abre desde una notificación push
// v434: Revisa localStorage PRIMERO, loop más corto

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface PendingNav {
  url: string;
  tag: string;
}

let pendingRoute: string | null = null;

export function initPushRouteListener(): void {
  if (!Capacitor.isNativePlatform()) {
    console.log('[PendingNav] initPushRouteListener: no es nativo');
    return;
  }
  
  console.log('[PendingNav] initPushRouteListener: configurando listener para pushRoute');
  
  window.addEventListener('pushRoute', ((event: CustomEvent) => {
    console.log('[PendingNav] Evento pushRoute recibido:', event.detail);
    pendingRoute = event.detail;
  }) as EventListener);
  
  try {
    const lsRoute = localStorage.getItem('pending_push_route');
    if (lsRoute) {
      console.log('[PendingNav] Ruta encontrada en localStorage al inicio:', lsRoute);
      pendingRoute = lsRoute;
      localStorage.removeItem('pending_push_route');
    }
  } catch (e) {
    console.log('[PendingNav] Error leyendo localStorage:', e);
  }
}

export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  console.log('[PendingNav] getAndClearPendingNav llamado');

  if (!Capacitor.isNativePlatform()) return null;

  try {
    const lsRoute = localStorage.getItem('pending_push_route');
    if (lsRoute) {
      localStorage.removeItem('pending_push_route');
      pendingRoute = lsRoute;
      console.log('[PendingNav] Ruta encontrada en localStorage:', lsRoute);
    }
  } catch (e) {
    console.log('[PendingNav] Error leyendo localStorage:', e);
  }

  if (pendingRoute) {
    const result = { url: pendingRoute, tag: '' };
    pendingRoute = null;
    console.log('[PendingNav] Ruta obtenida:', result.url);
    return result;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log('[PendingNav] Intento', attempt, '/ 2 - pendingRoute:', pendingRoute);

    await new Promise(r => setTimeout(r, 500));

    try {
      const lsRoute = localStorage.getItem('pending_push_route');
      if (lsRoute) {
        localStorage.removeItem('pending_push_route');
        console.log('[PendingNav] localStorage en intento', attempt, ':', lsRoute);
        return { url: lsRoute, tag: '' };
      }
    } catch (e) { }

    if (pendingRoute) {
      const result = { url: pendingRoute, tag: '' };
      pendingRoute = null;
      console.log('[PendingNav] Evento pushRoute en intento', attempt, ':', result.url);
      return result;
    }
  }

  try {
    const hasPending = await Preferences.get({ key: 'has_pending' });
    const pendingUrl = await Preferences.get({ key: 'pending_url' });
    if (hasPending.value === 'true' && pendingUrl.value) {
      await Preferences.remove({ key: 'has_pending' });
      await Preferences.remove({ key: 'pending_url' });
      console.log('[PendingNav] URL desde SharedPreferences:', pendingUrl.value);
      return { url: pendingUrl.value, tag: '' };
    }
  } catch (e) {
    console.log('[PendingNav] SharedPreferences error:', e);
  }

  console.log('[PendingNav] No hay pending route');
  return null;
}

function isUserAdmin(role?: string): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase();
  return ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(upperRole);
}

export async function clearPendingNavFile(): Promise<void> {
  console.log('[PendingNav] clearPendingNavFile llamado');
  if (!Capacitor.isNativePlatform()) return;

  try {
    try {
      localStorage.removeItem('pending_push_route');
      console.log('[PendingNav] localStorage limpiado');
    } catch (e) {
      console.log('[PendingNav] Error limpiando localStorage:', e);
    }
    
    await Preferences.remove({ key: 'has_pending' });
    await Preferences.remove({ key: 'pending_url' });
    await Preferences.remove({ key: 'pending_tag' });
    console.log('[PendingNav] SharedPreferences limpiadas');
  } catch (e) {
    console.log('[PendingNav] Error limpiando:', e);
  }
}

export function parseProjectChatUrl(url: string, userRole?: string): string {
  if (url.startsWith('URL_PROJECT_CHAT:')) {
    const parts = url.replace('URL_PROJECT_CHAT:', '').split(':');
    const projectId = parts[0];
    const role = userRole || 'OPERADOR';

    if (isUserAdmin(role)) {
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (role.toUpperCase() === 'SUBCONTRATISTA') {
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
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
