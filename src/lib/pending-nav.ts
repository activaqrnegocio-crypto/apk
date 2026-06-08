// src/lib/pending-nav.ts
// Lee pending_url cuando la app se abre desde una notificación push

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PREFS_NAME = 'AquatechPush';

export interface PendingNav {
  url: string;
  tag: string;
}

/**
 * Lee y limpia pending navigation desde Android nativo.
 * v418: Usa SharedPreferences (que MainActivity ahora escribe)
 */
export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  // Leer desde Capacitor Preferences (que MainActivity escribe)
  try {
    const hasPending = await Preferences.get({ key: 'has_pending' });
    console.log('[PendingNav] has_pending:', hasPending.value);
    
    if (hasPending.value === 'true') {
      const pendingUrl = await Preferences.get({ key: 'pending_url' });
      const pendingTag = await Preferences.get({ key: 'pending_tag' });

      console.log('[PendingNav] pending_url:', pendingUrl.value);
      console.log('[PendingNav] pending_tag:', pendingTag.value);

      if (pendingUrl.value) {
        // Limpiar después de leer
        await Preferences.remove({ key: 'has_pending' });
        await Preferences.remove({ key: 'pending_url' });
        await Preferences.remove({ key: 'pending_tag' });

        console.log('[PendingNav] Navegando a:', pendingUrl.value);
        return {
          url: pendingUrl.value,
          tag: pendingTag.value || ''
        };
      }
    }
  } catch (e) {
    console.error('[PendingNav] Error:', e);
  }

  return null;
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
