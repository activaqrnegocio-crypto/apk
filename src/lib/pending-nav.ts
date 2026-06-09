// src/lib/pending-nav.ts
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const PENDING_NAV_FILE = 'pending_nav.json';
const FILES_DIR = 'FILES';

export interface PendingNav {
  url: string;
  tag: string;
}

export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  console.log('[PendingNav] getAndClearPendingNav llamado');
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const result = await Filesystem.readFile({
      path: PENDING_NAV_FILE,
      directory: FILES_DIR as any,
    });

    let jsonContent: string;
    if (typeof result.data === 'string') {
      const dataStr = result.data as string;
      if (dataStr.startsWith('ewog') || dataStr.includes('Ilw')) {
        try {
          jsonContent = atob(dataStr);
        } catch {
          jsonContent = dataStr;
        }
      } else {
        jsonContent = dataStr;
      }
    } else {
      jsonContent = String(result.data);
    }

    const data = JSON.parse(jsonContent);
    
    if (data.has_pending && data.url) {
      try {
        await Filesystem.deleteFile({
          path: PENDING_NAV_FILE,
          directory: FILES_DIR as any,
        });
      } catch {}

      return { url: data.url, tag: data.tag || '' };
    }
  } catch {}

  return null;
}

function isUserAdmin(role?: string): boolean {
  if (!role) return false;
  return ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(role.toUpperCase());
}

export function parseProjectChatUrl(url: string, userRole?: string): string {
  if (url.startsWith('URL_PROJECT_CHAT:')) {
    const projectId = url.replace('URL_PROJECT_CHAT:', '').split(':')[0];
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
    const role = userRole || 'OPERADOR';

    if (isUserAdmin(role)) {
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (role.toUpperCase() === 'SUBCONTRATISTA') {
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
  return url;
}