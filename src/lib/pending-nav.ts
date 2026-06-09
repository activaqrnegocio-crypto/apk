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
  
  // Leer localStorage solo una vez al inicio
  try {
    const lsRoute = localStorage.getItem('pending_push_route');
    if (lsRoute) {
      pendingRoute = lsRoute;
      localStorage.removeItem('pending_push_route');
      console.log('[PendingNav] localStorage:', lsRoute);
    }
  } catch (e) {}
}

export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  if (!Capacitor.isNativePlatform()) return null;

  // SIEMPRE leer de localStorage - la app puede estar minimizada
  // y la variable en memoria ya fue procesada antes
  try {
    const lsRoute = localStorage.getItem('pending_push_route');
    if (lsRoute) {
      localStorage.removeItem('pending_push_route');
      console.log('[PendingNav] localStorage:', lsRoute);
      return { url: lsRoute, tag: '' };
    }
  } catch (e) {}

  // También verificar memoria por si es cold start
  if (pendingRoute) {
    const result = { url: pendingRoute, tag: '' };
    pendingRoute = null;
    console.log('[PendingNav] Ruta obtenida (memoria):', result.url);
    return result;
  }

  console.log('[PendingNav] No hay pending route');
  return null;
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
