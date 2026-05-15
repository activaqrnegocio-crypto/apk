/**
 * utilidades para el sistema de sincronización offline de Aquatech
 */

// v354: Maximum file size for offline storage (IndexedDB)
// Increased to 600MB per user request to support 500MB videos.
const MAX_OFFLINE_FILE_SIZE = 600 * 1024 * 1024; // 600MB

// v353: Threshold for base64 vs binary storage
// Files under this size use base64 (simple, preview-friendly).
// Files over this size use the raw File object (structured clone in IndexedDB).
const BASE64_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Prepara un archivo para guardarse en IndexedDB de la forma más eficiente.
 * 
 * v353: Rewritten for 600MB+ file support.
 * - Files < 10MB → base64 (simple, works everywhere)
 * - Files 10MB-600MB → Raw File object via structured clone (zero overhead)
 * - Files > 600MB → REJECTED (too large for IndexedDB on mobile)
 */
export async function prepareFileForOutbox(file: File): Promise<{
  data: string | ArrayBuffer | File;
  storageType: 'base64' | 'arraybuffer' | 'file';
  filename: string;
  mimeType: string;
  size: number;
}> {
  // v353: Reject files that are too large for IndexedDB
  if (file.size > MAX_OFFLINE_FILE_SIZE) {
    throw new Error(
      `ARCHIVO_MUY_GRANDE: El archivo "${file.name}" (${formatFileSize(file.size)}) es demasiado grande para guardar offline. ` +
      `El límite es ${formatFileSize(MAX_OFFLINE_FILE_SIZE)}. Conéctese a internet para subir archivos de este tamaño.`
    );
  }

  if (file.size <= BASE64_THRESHOLD) {
    // Small files → base64 (simple, preview-friendly)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { 
      data: base64, 
      storageType: 'base64', 
      filename: file.name, 
      mimeType: file.type, 
      size: file.size 
    };
  } else {
    // v443: Large files → Store as ArrayBuffer.
    // CRITICAL FIX: Raw File objects lose their data after IndexedDB structured clone
    // on many Android browsers (Chrome 90-120+). The metadata (.size, .name) survives
    // but reading the file with .arrayBuffer() or .slice() returns empty/corrupt data.
    // ArrayBuffer is universally reliable in IndexedDB on ALL browsers.
    const buffer = await file.arrayBuffer();
    return { 
      data: buffer, 
      storageType: 'arraybuffer', 
      filename: file.name, 
      mimeType: file.type, 
      size: file.size 
    };
  }
}

/**
 * Genera un SyncId único para asegurar idempotencia en el servidor.
 */
export function generateSyncId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * v353: Format file size for user-friendly display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * v353: Check if a file is too large for offline storage
 */
export function isFileTooLargeForOffline(file: File | Blob): boolean {
  return file.size > MAX_OFFLINE_FILE_SIZE;
}

/**
 * v353: Check if a file should skip base64 conversion (large media files)
 */
export function shouldSkipBase64(file: File | Blob): boolean {
  return file.size > BASE64_THRESHOLD;
}
