const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE!
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY!
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST!
const BUNNY_PULLZONE_URL = process.env.BUNNY_PULLZONE_URL!

export async function uploadToBunny(
  file: Buffer,
  filename: string,
  folder: string = 'aquatech-crm',
  mimeType?: string
): Promise<string> {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const path = `/${BUNNY_STORAGE_ZONE}/${folder}/${timestamp}-${randomSuffix}-${filename}`
  
  // v353fix: Determine the real Content-Type from the filename extension or provided mimeType.
  // Without this, Bunny CDN serves videos as application/octet-stream which prevents
  // browsers from doing Range requests needed for progressive video playback.
  const contentType = mimeType || inferMimeType(filename);
  
  const response = await fetch(`https://${BUNNY_STORAGE_HOST}${path}`, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
      'Content-Type': contentType,
    },
    body: file as any,
  })

  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.statusText}`)
  }

  return `${BUNNY_PULLZONE_URL}/${folder}/${timestamp}-${randomSuffix}-${filename}`
}

/** Infer MIME type from filename extension */
function inferMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp',
    'gif': 'image/gif', 'svg': 'image/svg+xml', 'heic': 'image/heic',
    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm', 
    '3gp': 'video/3gpp', 'm4v': 'video/mp4', 'avi': 'video/x-msvideo',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 
    'm4a': 'audio/mp4', 'aac': 'audio/aac', 'flac': 'audio/flac',
    'pdf': 'application/pdf', 'doc': 'application/msword', 
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function deleteFromBunny(fileUrl: string): Promise<void> {
  const urlPath = fileUrl.replace(BUNNY_PULLZONE_URL!, '')
  const path = `/${BUNNY_STORAGE_ZONE}${urlPath}`
  
  await fetch(`https://${BUNNY_STORAGE_HOST}${path}`, {
    method: 'DELETE',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
    },
  })
}

/** Delete a file from BunnyCDN storage by direct storage path (e.g. "Proyectos/temp/uuid/file.jpg") */
export async function deleteBunnyFileByPath(storagePath: string): Promise<void> {
  const fullPath = `/${BUNNY_STORAGE_ZONE}/${storagePath}`;
  const res = await fetch(`https://${BUNNY_STORAGE_HOST}${fullPath}`, {
    method: 'DELETE',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
    },
  });
  if (!res.ok && res.status !== 404) {
    console.warn(`[Bunny] Delete failed (${res.status}) for: ${storagePath}`);
  }
}

/**
 * List contents of a directory in BunnyCDN storage.
 * Returns array of { ObjectName, IsDirectory, Size, LastChanged }.
 */
export async function listBunnyDirectory(storagePath: string): Promise<{
  ObjectName: string;
  IsDirectory: boolean;
  Size: number;
  LastChanged: string;
}[]> {
  const fullPath = `/${BUNNY_STORAGE_ZONE}/${storagePath}/`;
  const res = await fetch(`https://${BUNNY_STORAGE_HOST}${fullPath}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      AccessKey: BUNNY_STORAGE_API_KEY,
    },
  });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Bunny list failed (${res.status}) for: ${storagePath}`);
  }
  return res.json();
}

/** Delete an entire directory tree from BunnyCDN recursively */
export async function deleteBunnyDirectory(storagePath: string): Promise<{ deleted: number; failed: number }> {
  const items = await listBunnyDirectory(storagePath);
  let deleted = 0;
  let failed = 0;

  for (const item of items) {
    const childPath = `${storagePath}/${item.ObjectName}`;
    if (item.IsDirectory) {
      const sub = await deleteBunnyDirectory(childPath);
      deleted += sub.deleted;
      failed += sub.failed;
    } else {
      try {
        await deleteBunnyFileByPath(childPath);
        deleted++;
      } catch {
        failed++;
      }
    }
  }

  // Try to remove the now-empty directory (Bunny may or may not support this)
  try {
    await deleteBunnyFileByPath(storagePath + '/');
  } catch {
    // ignore — directory delete often no-op
  }

  return { deleted, failed };
}
