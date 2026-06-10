// src/lib/pending-nav.ts
// v451: Agregar fallback nativo directo - SharedPreferences

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface PendingNav {
  url: string;
  tag: string;
}

let pendingRoute: string | null = null;

// Referencia al plugin PendingNav
const PendingNavPlugin = (Capacitor as any).Plugins.PendingNavPlugin;

// v452: Plugin nativo para leer SharedPreferences directamente (el mismo storage que MainActivity)
const NativePreferences = (Capacitor as any).Plugins.NativePreferences;
// v453: Filesystem para leer archivo JSON (para cold start - app minimizada/cerrada)
async function readFromJsonFile(): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({
      path: 'pending_nav.json',
      directory: Directory.Data
    });
    if (result && result.data) {
      let dataStr = typeof result.data === 'string' ? result.data : '';
      if (dataStr && dataStr.length > 0) {
        let url: string | null = null;
        
        // INTENTO 1: Si es base64, decodificar
        try {
          // Verificar si parece ser base64 (contiene caracteres válidos de base64)
          if (dataStr.includes('eyJ') || (dataStr.match(/^[A-Za-z0-9+/=]+$/) && dataStr.length > 10)) {
            const decoded = atob(dataStr);
            const parsed = JSON.parse(decoded);
            url = parsed.url || parsed.data || null;
            console.log('[PendingNav] ✓ JSON file (base64 decodificado):', url);
          }
        } catch (e) {
          // Fallback: intentar parsear directamente
        }
        
        // INTENTO 2: Si no funcionó, parsear como JSON normal
        if (!url) {
          try {
            const parsed = JSON.parse(dataStr);
            url = parsed.url || parsed.data || null;
            console.log('[PendingNav] ✓ JSON file (directo):', url);
          } catch (e2) {
            // No es JSON válido
          }
        }
        
        // INTENTO 3: Si parece tener "url" o "data" como substring, extraer
        if (!url && dataStr.includes('url')) {
          try {
            const match = dataStr.match(/"(url|data)":"([^"]+)"/);
            if (match) {
              url = match[2];
              console.log('[PendingNav] ✓ JSON file (regex):', url);
            }
          } catch (e) {}
        }
        
        // Limpiar archivo después de leer (si encontramos algo)
        if (url) {
          try { await (Filesystem as any).removeFile({ path: 'pending_nav.json', directory: Directory.Data }); } catch {}
          return url;
        }
      }
    }
  } catch (e) {
    console.log('[PendingNav] JSON file error:', (e as Error).message || e);
  }
  return null;
}
// INTENTO 5: Leer de NativePreferences (SharedPreferences nativas - el mismo storage que MainActivity)
async function readFromNativePreferences(): Promise<string | null> {
  try {
    if (NativePreferences && NativePreferences.get) {
      const result = await NativePreferences.get({ key: 'pending_push_route' });
      if (result && result.value) {
        console.log('[PendingNav] ✓ NativePreferences:', result.value);
        return result.value;
      }
    }
  } catch (e) {
    console.log('[PendingNav] NativePreferences error:', e);
  }
  return null;
}

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

  console.log('[PendingNav] getAndClearPendingNav v458 - iniziando...');

  // ORDEN DE PRIORIDADES (cold start - mismo orden que MainActivity guarda):
  // 1. JSON file (Filesystem) - MainActivity guarda aquí PRIMERO
  // 2. SharedPreferences nativas
  // 3. Capacitor Preferences
  // 4. localStorage
  // 5. Variable global
  // 6. Plugin
  // 7. Memoria
  
  // 1. JSON file (Filesystem) - PRIMERO porque MainActivity guarda aquí primero
  const jsonRoute = await readFromJsonFile();
  if (jsonRoute) {
    console.log('[PendingNav] ✓ JSON file:', jsonRoute);
    return { url: jsonRoute, tag: '' };
  }

  // 2. SharedPreferences nativas
  const nativePrefRoute = await readFromNativePreferences();
  if (nativePrefRoute) {
    console.log('[PendingNav] ✓ NativePreferences:', nativePrefRoute);
    return { url: nativePrefRoute, tag: '' };
  }

  // 3. Capacitor Preferences
  const prefRoute = await readFromPreferences();
  if (prefRoute) {
    console.log('[PendingNav] ✓ Preferences:', prefRoute);
    return { url: prefRoute, tag: '' };
  }

  // 4. localStorage
  let lsRoute = readFromLocalStorage();
  if (lsRoute) {
    console.log('[PendingNav] ✓ localStorage:', lsRoute);
    return { url: lsRoute, tag: '' };
  }

  // 5. Variable global
  const globalRoute = readFromGlobalVar();
  if (globalRoute) {
    console.log('[PendingNav] ✓ GlobalVar:', globalRoute);
    return { url: globalRoute, tag: '' };
  }

  // 6. PendingNavPlugin
  const pluginRoute = await readFromPlugin();
  if (pluginRoute) {
    console.log('[PendingNav] ✓ Plugin (JSON):', pluginRoute);
    return { url: pluginRoute, tag: '' };
  }

  // 7. Memoria en memoria
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
