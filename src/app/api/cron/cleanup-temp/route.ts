import { NextResponse } from 'next/server';
import { listBunnyDirectory, deleteBunnyFileByPath } from '@/lib/bunny';

/**
 * CRON: Limpieza de carpetas temporales en BunnyCDN
 * 
 * RUTA: GET /api/cron/cleanup-temp?secret=aquatech_cron_secure_2024
 * 
 * Elimina archivos en Proyectos/temp/ que tengan más de 24 horas.
 * Estos archivos son subidos durante la creación de proyectos y si el
 * proceso se interrumpe, quedan huérfanos ocupando espacio.
 * 
 * ConfiguraciÃ³n sugerida (cron en VPS):
 *   0 3 * * * curl -s https://dominio.com/api/cron/cleanup-temp?secret=...
 * 
 * O desde el host del VPS (fuera de Docker):
 *   0 3 * * * curl -s http://localhost:3000/api/cron/cleanup-temp?secret=...
 */

const TEMP_FOLDER = 'Proyectos/temp';
const MAX_AGE_HOURS = 24;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const dryRun = searchParams.has('dryRun');

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. List all folders inside temp
    const tempDirs = await listBunnyDirectory(TEMP_FOLDER);
    const cutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;
    const results: {
      folder: string;
      action: 'deleted' | 'skipped' | 'error';
      files: number;
      reason?: string;
    }[] = [];

    for (const dir of tempDirs) {
      if (!dir.IsDirectory) continue; // skip stray files

      const dirName = dir.ObjectName.replace(/\/$/, ''); // remove trailing slash
      const dirPath = `${TEMP_FOLDER}/${dirName}`;

      // 2. List files inside this temp folder
      let files: Awaited<ReturnType<typeof listBunnyDirectory>>;
      try {
        files = await listBunnyDirectory(dirPath);
      } catch (err) {
        results.push({ folder: dirPath, action: 'error', files: 0, reason: `Error listing: ${err}` });
        continue;
      }

      if (files.length === 0) {
        // Empty folder — delete the folder marker
        if (!dryRun) {
          await deleteBunnyFileByPath(dirPath + '/').catch(() => {});
        }
        results.push({ folder: dirPath, action: 'deleted', files: 0 });
        continue;
      }

      // 3. Check if ALL files in this folder are older than cutoff
      const allOld = files.every(f => {
        if (f.IsDirectory) return false; // nested dirs — skip for safety
        const lastChanged = new Date(f.LastChanged).getTime();
        return lastChanged < cutoff;
      });

      if (!allOld) {
        results.push({ folder: dirPath, action: 'skipped', files: files.length, reason: 'Has files newer than 24h' });
        continue;
      }

      // 4. Delete all files in this old folder
      if (dryRun) {
        results.push({ folder: dirPath, action: 'skipped', files: files.length, reason: 'dry-run — would delete' });
        continue;
      }

      let deletedCount = 0;
      let errorCount = 0;
      for (const file of files) {
        if (file.IsDirectory) continue;
        try {
          await deleteBunnyFileByPath(`${dirPath}/${file.ObjectName}`);
          deletedCount++;
        } catch {
          errorCount++;
        }
      }

      // Remove the now-empty folder
      await deleteBunnyFileByPath(dirPath + '/').catch(() => {});

      results.push({
        folder: dirPath,
        action: 'deleted',
        files: deletedCount,
        reason: errorCount > 0 ? `${errorCount} errors` : undefined,
      });
    }

    const totalDeleted = results.filter(r => r.action === 'deleted').reduce((s, r) => s + r.files, 0);
    const totalSkipped = results.filter(r => r.action === 'skipped').length;

    console.log(`[Cron Cleanup] Deleted ${totalDeleted} files from ${results.filter(r => r.action === 'deleted').length} folders. ${totalSkipped} folders skipped.`);

    return NextResponse.json({
      ok: true,
      dryRun,
      summary: {
        deletedFiles: totalDeleted,
        deletedFolders: results.filter(r => r.action === 'deleted').length,
        skippedFolders: totalSkipped,
        errors: results.filter(r => r.action === 'error').length,
      },
      details: results,
    });
  } catch (error) {
    console.error('[Cron Cleanup] Error:', error);
    return NextResponse.json({ error: 'Cleanup execution error' }, { status: 500 });
  }
}