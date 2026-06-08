// src/lib/pending-nav.ts
// Lee pending_url de SharedPreferences (Android) cuando la app se abre desde una notificación

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PREFS_NAME = 'AquatechPush';

export interface PendingNav {
  url: string;
  tag: string;
}

/**
 * Lee y limpia pending_url de SharedPreferences
 * Retorna null si no hay navegación pendiente
 */
export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // Verificar si hay navegación pendiente
    const hasPending = await Preferences.get({ key: 'has_pending' });
    
    if (hasPending.value !== 'true') {
      return null;
    }

    // Leer la URL y tag
    const pendingUrl = await Preferences.get({ key: 'pending_url' });
    const pendingTag = await Preferences.get({ key: 'pending_tag' });

    // Limpiar inmediatamente
    await Preferences.remove({ key: 'has_pending' });
    await Preferences.remove({ key: 'pending_url' });
    await Preferences.remove({ key: 'pending_tag' });

    if (pendingUrl.value) {
      return {
        url: pendingUrl.value,
        tag: pendingTag.value || ''
      };
    }

    return null;
  } catch (e) {
    console.error('[PendingNav] Error leyendo SharedPreferences:', e);
    return null;
  }
}

/**
 * Parsea URL_PROJECT_CHAT:projectId:messageId y retorna la URL de navegación
 */
export function parseProjectChatUrl(url: string): string {
  // Formato: URL_PROJECT_CHAT:123:456
  if (url.startsWith('URL_PROJECT_CHAT:')) {
    const parts = url.replace('URL_PROJECT_CHAT:', '').split(':');
    const projectId = parts[0];
    const messageId = parts[1] || '';
    
    if (messageId) {
      return `/admin/proyectos/${projectId}?view=chat&message=${messageId}`;
    }
    return `/admin/proyectos/${projectId}?view=chat`;
  }
  
  // Otros formatos: URL_PROJECT:123 → /admin/proyectos/123
  if (url.startsWith('URL_PROJECT:')) {
    const projectId = url.replace('URL_PROJECT:', '');
    return `/admin/proyectos/${projectId}`;
  }
  
  return url;
}
