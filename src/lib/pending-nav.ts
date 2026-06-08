// src/lib/pending-nav.ts
// Lee pending_url cuando la app se abre desde una notificación push

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const PENDING_NAV_FILE = 'pending_nav.json';

// Usar string directamente para evitar errores de tipo
const FILES_DIR = 'FILES';

export interface PendingNav {
  url: string;
  tag: string;
}

/**
 * Lee y limpia pending navigation desde Android nativo.
 * v419: Lee desde archivo JSON (que MainActivity crea)
 */
export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // Leer el archivo JSON desde el directorio de archivos internos
    const result = await Filesystem.readFile({
      path: PENDING_NAV_FILE,
      directory: FILES_DIR as any,
    });

    console.log('[PendingNav] Archivo leído (base64):', result.data);

    // Capacitor Filesystem devuelve el contenido como base64, necesitamos decodificarlo
    let jsonContent: string;
    if (typeof result.data === 'string') {
      // Si es un string que parece base64 (comienza con ewog), decodificar
      const dataStr = result.data as string;
      if (dataStr.startsWith('ewog') || dataStr.includes('Ilw')) {
        try {
          jsonContent = atob(dataStr);
          console.log('[PendingNav] Contenido decodificado:', jsonContent);
        } catch (decodeError) {
          console.log('[PendingNav] Error decodificando base64, usando string original');
          jsonContent = dataStr;
        }
      } else {
        jsonContent = dataStr;
      }
    } else {
      // Si es Blob u otro tipo, convertir a string
      jsonContent = String(result.data);
    }

    // Parsear el JSON
    const data = JSON.parse(jsonContent);
    
    if (data.has_pending && data.url) {
      console.log('[PendingNav] URL:', data.url);
      console.log('[PendingNav] Tag:', data.tag);

      // Eliminar el archivo después de leer
      try {
        await Filesystem.deleteFile({
          path: PENDING_NAV_FILE,
          directory: FILES_DIR as any,
        });
        console.log('[PendingNav] Archivo eliminado');
      } catch (e) {
        console.log('[PendingNav] Error eliminando archivo (puede no existir):', e);
      }

      console.log('[PendingNav] Navegando a:', data.url);
      return {
        url: data.url,
        tag: data.tag || ''
      };
    }
  } catch (e) {
    console.log('[PendingNav] No hay pending nav o error:', e);
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
