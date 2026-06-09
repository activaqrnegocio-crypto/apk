// src/lib/pending-nav.ts
// v435: Simplificado - solo localStorage instantáneo

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface PendingNav {
  url: string;
  tag: string;
}

let pendingRoute: string | null = null;

export function initPushRouteListener(): void {
  if (!Capacitor.isNativePlatform()) return;
  
  console.log('[PendingNav] initPushRouteListener');
  
  window.addEventListener('pushRoute', ((event: CustomEvent) => {
    console.log('[PendingNav] pushRoute evento:', event.detail);
    pendingRoute = event.detail;
  }) as EventListener);
  
  // NO BORRAR de localStorage aquí - esperar a que getAndClearPendingNav lo use
  // El valor puede existir desde que Android abrió la app hace segundos
  try {
    const lsRoute = localStorage.getItem('pending_push_route');
    if (lsRoute) {
      // NO borrar aquí - solo guardar en memoria para cold start
      pendingRoute = lsRoute;
      console.log('[PendingNav] Leído de localStorage (sin borrar):', lsRoute);
    }
  } catch (e) {}
}

export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  if (!Capacitor.isNativePlatform()) return null;

  // INTENTO 1: Leer de localStorage (sin borrar inmediatamente)
  try {
    const lsRoute = localStorage.getItem('pending_push_route');
    if (lsRoute) {
      // Solo borrar después de retornar exitosamente
      console.log('[PendingNav] localStorage leido:', lsRoute);
      return { url: lsRoute, tag: '' };
    }
  } catch (e) {}

  // INTENTO 2: Verificar memoria
  if (pendingRoute) {
    console.log('[PendingNav] Ruta de memoria:', pendingRoute);
    return { url: pendingRoute, tag: '' };
  }

  console.log('[PendingNav] No hay pending route');
  return null;
}

export async function clearPendingNavAfterUse(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    localStorage.removeItem('pending_push_route');
    console.log('[PendingNav] Borrado despues de usar');
  } catch (e) {}
}

export async function clearPendingNavFile(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    localStorage.removeItem('pending_push_route');
  } catch (e) {}
  try {
    await Preferences.remove({ key: 'has_pending' });
    await Preferences.remove({ key: 'pending_url' });
  } catch (e) {}
}

// Guardar el rol del usuario para cuando llegue la notificación
export function saveUserRoleForPush(role: string): void {
  try {
    localStorage.setItem('last_user_role', role);
    console.log('[PendingNav] Rol guardado:', role);
  } catch (e) {}
}

export function parseProjectChatUrl(url: string, userRole?: string): string {
  if (url.startsWith('URL_PROJECT_CHAT:')) {
    const projectId = url.replace('URL_PROJECT_CHAT:', '').split(':')[0];
    return `/admin/proyectos/${projectId}?view=CHAT`;
  }
  if (url.startsWith('URL_PROJECT:')) {
    const projectId = url.replace('URL_PROJECT:', '');
    return `/admin/proyectos/${projectId}?view=CHAT`;
  }
  return url;
}
