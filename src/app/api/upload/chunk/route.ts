import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { Readable } from 'stream';
import path from 'path';

// CRÍTICO: Desactivar el body parser de Next.js para permitir archivos grandes
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos máximo por request en VPS

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'chunks');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const filename = formData.get('filename') as string;

    if (!chunk || !uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Guardar chunk en disco temporal
    const uploadDir = path.join(TEMP_DIR, uploadId);
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    
    // v352fix: Write each chunk to its own file (writeFile overwrites on retry — no duplicates).
    // Previous appendFile approach duplicated chunks on SW retries, corrupting the file.
    const chunkPath = path.join(uploadDir, `chunk_${chunkIndex}`);
    await writeFile(chunkPath, chunkBuffer);

    // Si no es el último chunk, confirmar recepción
    if (chunkIndex < totalChunks - 1) {
      return NextResponse.json({ received: true, chunk: chunkIndex });
    }

    // Último chunk — subir el archivo ensamblado a BunnyNet via STREAMING secuencial
    const storageZone = process.env.BUNNY_STORAGE_ZONE!;
    const accessKey = process.env.BUNNY_STORAGE_API_KEY!;
    const storageHost = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
    const pullZoneUrl = process.env.BUNNY_PULLZONE_URL || process.env.BUNNY_PULL_ZONE_URL;

    const subfolder = formData.get('subfolder') as string || 'uploads';
    const mimeType = formData.get('mimeType') as string || 'application/octet-stream';
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const remotePath = `${subfolder}/${timestamp}-${safeName}`;

    // v352fix: Stream chunks sequentially from disk to Bunny CDN.
    // Each chunk file is read in order (0, 1, 2, ...) and streamed directly.
    // No Buffer.concat, no memory spikes, handles retries correctly.
    async function* combineChunks(dir: string, total: number) {
      for (let i = 0; i < total; i++) {
        const fp = path.join(dir, `chunk_${i}`);
        const stream = createReadStream(fp);
        for await (const chunk of stream) {
          yield chunk;
        }
      }
    }

    const combinedStream = Readable.from(combineChunks(uploadDir, totalChunks));
    const webStream = Readable.toWeb(combinedStream) as ReadableStream;

    const bunnyRes = await fetch(
      `https://${storageHost}/${storageZone}/${remotePath}`,
      {
        method: 'PUT',
        headers: {
          'AccessKey': accessKey,
          'Content-Type': mimeType,
        },
        body: webStream,
        // @ts-ignore — Node 18+ requires duplex: 'half' for streaming request bodies
        duplex: 'half',
      }
    );

    // Limpiar directorio temporal
    await rm(uploadDir, { recursive: true, force: true }).catch(() => {});

    if (!bunnyRes.ok) {
      throw new Error(`BunnyNet upload failed: ${bunnyRes.status}`);
    }

    const publicUrl = `${pullZoneUrl}/${remotePath}`;
    return NextResponse.json({ url: publicUrl, success: true });

  } catch (error: any) {
    console.error('[API/upload/chunk] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
