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
 * v421: Agregar logs de depuración
 */
export async function getAndClearPendingNav(): Promise<PendingNav | null> {
  console.log('[PendingNav] getAndClearPendingNav llamado');
  if (!Capacitor.isNativePlatform()) {
    console.log('[PendingNav] No es plataforma nativa, retornando null');
    return null;
  }

  try {
    console.log('[PendingNav] Intentando leer archivo:', PENDING_NAV_FILE);
    // Leer el archivo JSON desde el directorio de archivos internos
    const result = await Filesystem.readFile({
      path: PENDING_NAV_FILE,
      directory: FILES_DIR as any,
    });

    console.log('[PendingNav] Archivo leído, resultado:', JSON.stringify(result));

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
 * Verifica si el usuario es admin basado en su rol
 */
function isUserAdmin(role?: string): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase();
  return ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(upperRole);
}

/**
 * Parsea URL_PROJECT_CHAT:projectId:messageId y retorna la URL de navegación
 * v421: Usa formatos exactos según el rol del usuario
 * - Admin: /admin/proyectos/{id}?view=CHAT
 * - Operator: /admin/operador/proyecto/{id}?view=chat
 */
export function parseProjectChatUrl(url: string, userRole?: string): string {
  // Formato: URL_PROJECT_CHAT:123:456
  if (url.startsWith('URL_PROJECT_CHAT:')) {
    const parts = url.replace('URL_PROJECT_CHAT:', '').split(':');
    const projectId = parts[0];
    
    // Generar URL según el rol del usuario - formatos exactos
    if (isUserAdmin(userRole)) {
      // Admin: /admin/proyectos/{id}?view=CHAT
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (userRole === 'SUBCONTRATISTA' || userRole?.toUpperCase() === 'SUBCONTRATISTA') {
      // Subcontratista: /admin/subcontratista/proyecto/{id}?view=chat
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      // Operador: /admin/operador/proyecto/{id}?view=chat
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
  // Otros formatos: URL_PROJECT:123 → /admin/proyectos/123 (sin /admin)
  if (url.startsWith('URL_PROJECT:')) {
    const projectId = url.replace('URL_PROJECT:', '');
    
    if (isUserAdmin(userRole)) {
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (userRole === 'SUBCONTRATISTA' || userRole?.toUpperCase() === 'SUBCONTRATISTA') {
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
  return url;
}
