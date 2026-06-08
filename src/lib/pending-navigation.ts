// src/lib/pending-navigation.ts
// Lee pending_url de SharedPreferences (Android) cuando la app se abre desde una notificación

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PREFS_NAME = 'AquatechPush';

export interface PendingNavigation {
  url: string;
  tag: string;
}

/**
 * Lee pending_url de SharedPreferences y lo limpia
 * Solo funciona en plataforma nativa Android
 */
export async function getAndClearPendingNavigation(): Promise<PendingNavigation | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // El plugin Preferences accede a SharedPreferences de Android
    const hasPending = await Preferences.get({ key: 'has_pending' });
    
    if (hasPending.value !== 'true') {
      return null;
    }

    const pendingUrl = await Preferences.get({ key: 'pending_url' });
    const pendingTag = await Preferences.get({ key: 'pending_tag' });

    if (!pendingUrl.value) {
      return null;
    }

    // Limpiar los valores
    await Preferences.remove({ key: 'has_pending' });
    await Preferences.remove({ key: 'pending_url' });
    await Preferences.remove({ key: 'pending_tag' });

    console.log('[PendingNav] Navegación pendiente encontrada:', pendingUrl.value, 'Tag:', pendingTag.value);

    return {
      url: pendingUrl.value,
      tag: pendingTag.value || ''
    };
  } catch (e) {
    console.error('[PendingNav] Error leyendo pending navigation:', JSON.stringify(e));
    return null;
  }
}

/**
 * Parsea URL_PROJECT_CHAT:projectId:messageId → URL de navegación
 */
export function parseProjectChatUrl(url: string): { projectId: string; messageId?: string } | null {
  if (!url.startsWith('URL_PROJECT_CHAT:')) {
    return null;
  }

  const parts = url.replace('URL_PROJECT_CHAT:', '').split(':');
  const projectId = parts[0];
  const messageId = parts[1];

  return { projectId, messageId };
}

/**
 * Construye la URL completa de navegación al chat
 */
export function buildChatNavigationUrl(projectId: string, messageId?: string): string {
  let url = `/admin/proyectos/${projectId}?view=chat`;
  if (messageId) {
    url += `&message=${messageId}`;
  }
  return url;
}
