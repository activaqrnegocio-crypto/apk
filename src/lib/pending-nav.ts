// src/lib/pending-nav.ts
// v451: Agregar fallback nativo directo - SharedPreferences

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface PendingNav {
  url: string;
  tag: string;
}

let pendingRoute: string | null = null;

// Referencia al plugin PendingNav
const PendingNavPlugin = (Capacitor as any).Plugins.PendingNavPlugin;

// v451: Plugin nativo para leer SharedPreferences directamente
const NativePreferences = (Capacitor as any).Plugins.NativePreferences;

export function initPushRouteListener(): void {
  if (!Capacitor.isNativePlatform()) return;
  
  console.log('[PendingNav] initPushRouteListener v451');
  
  // Escuchar evento nativo (para app ya abierta)
  window.addEventListener('pushRoute', ((event: CustomEvent) => {
    console.log('[PendingNav] pushRoute evento:', event.detail);
    pendingRoute = event.detail;
  }) as EventListener);
}

// INTENTO 1: Leer de variable global (mas confiable que localStorage)
// v452: window.__pendingPushRoute es seteado por MainActivity
function readFromGlobalVar(): string | null {
  try {
    const route = (window as any).__pendingPushRoute;
    if (route) {
      console.log('[PendingNav] ✓ GlobalVar:', route);
      return route;
    }
  } catch (e) {}
  return null;
}

// INTENTO 2: Leer localStorage
function readFromLocalStorage(): string | null {
  try {
    return localStorage.getItem('pending_push_route');
  } catch (e) {
    return null;
  }
}

// INTENTO 3: Leer de PendingNavPlugin (archivo JSON)
async function readFromPlugin(): Promise<string | null> {
  try {
    if (PendingNavPlugin && PendingNavPlugin.getAndClearPendingNav) {
      const result = await PendingNavPlugin.getAndClearPendingNav();
      if (result && result.url) {
        console.log('[PendingNav] ✓ Plugin:', result.url);
        return result.url;
      }
    }
  } catch (e) {
    console.log('[PendingNav] Plugin error:', e);
  }
  return null;
}

// INTENTO 4: Leer de Capacitor Preferences
async function readFromPreferences(): Promise<string | null> {
  try {
    const result = await Preferences.get({ key: 'pending_push_route' });
    return result.value;
  } catch (e) {
    return null;
  }
}

export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  if (!Capacitor.isNativePlatform()) return null;

  // ORDEN DE PRIORIDADES (cold start debe funcionar):
  
  // 1. Variable global (mas confiable) - PRIORITARIO
  const globalRoute = readFromGlobalVar();
  if (globalRoute) {
    return { url: globalRoute, tag: '' };
  }

  // 2. PendingNavPlugin - archivo JSON escrito por MainActivity
  const pluginRoute = await readFromPlugin();
  if (pluginRoute) {
    return { url: pluginRoute, tag: '' };
  }

  // 3. localStorage - puede fallar en cold start (DOMException)
  let lsRoute = readFromLocalStorage();
  if (lsRoute) {
    console.log('[PendingNav] ✓ localStorage:', lsRoute);
    return { url: lsRoute, tag: '' };
  }

  // 4. Capacitor Preferences
  const prefRoute = await readFromPreferences();
  if (prefRoute) {
    console.log('[PendingNav] ✓ Preferences:', prefRoute);
    return { url: prefRoute, tag: '' };
  }

  // 5. Memoria
  if (pendingRoute) {
    console.log('[PendingNav] ✓ Memoria:', pendingRoute);
    return { url: pendingRoute, tag: '' };
  }

  console.log('[PendingNav] ✗ No hay pending route');
  return null;
}

export async function clearPendingNavAfterUse(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Limpiar variable global
    (window as any).__pendingPushRoute = null;
    // Limpiar localStorage
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
