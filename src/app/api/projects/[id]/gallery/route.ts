import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin, isOperator } from '@/lib/rbac'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const projectId = Number(id)

    const gallery = await prisma.projectGalleryItem.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 150 // v373: Match main API limit for consistency
    })

    return NextResponse.json(gallery)
  } catch (error) {
    console.error('Error fetching gallery:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = Number(id)
    const syncId = request.headers.get('x-sync-id');

    if (syncId) {
      try {
        // v365: Atomic claim — INSERT first. If syncId exists, P2002 fires.
        await prisma.syncLog.create({
          data: { syncId, resultId: '__pending__' }
        });
        // Claim succeeded
      } catch (claimErr: any) {
        if (claimErr.code === 'P2002') {
          const existing = await prisma.syncLog.findUnique({ where: { syncId } });
          if (existing && existing.resultId !== '__pending__') {
            // Duplicate detected, return existing without noise
            const existingItem = await prisma.projectGalleryItem.findUnique({
              where: { id: Number(existing.resultId) }
            });
            return NextResponse.json(existingItem || { success: true, id: Number(existing.resultId), isDuplicate: true });
          }
          // v367: Hijack Stall
          if (existing && existing.createdAt < new Date(Date.now() - 120000)) {
            await prisma.syncLog.update({ where: { syncId }, data: { createdAt: new Date() } }).catch(() => {});
          } else {
            // Still pending from first request
            return NextResponse.json({ success: true, isDuplicate: true, id: 0 });
          }
        } else {
          throw claimErr;
        }
      }
    }
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!isAdmin(userRole) && !isOperator(userRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // v430: Support BOTH JSON and FormData for Turbo Sync (avoiding Base64 crashes)
    let url, filename, mimeType, sizeBytes, category, createdAt;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      category = formData.get('category') as string;
      createdAt = formData.get('createdAt') as string;

      if (!file) {
        return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
      }

      const { uploadToBunny } = await import('@/lib/bunny');
      const buffer = Buffer.from(await file.arrayBuffer());
      filename = file.name || `upload_${Date.now()}`;
      mimeType = file.type;
      sizeBytes = file.size;

      try {
        url = await uploadToBunny(buffer, filename, `projects/${projectId}/gallery`);
      } catch (uploadErr) {
        console.error('Error uploading binary to Bunny:', uploadErr);
        return NextResponse.json({ error: 'Error al subir a BunnyCDN' }, { status: 500 });
      }
    } else {
      // Legacy JSON / Base64 fallback
      const body = await request.json();
      url = body.url;
      filename = body.filename;
      mimeType = body.mimeType;
      sizeBytes = body.sizeBytes;
      category = body.category;
      createdAt = body.createdAt;

      if (url && url.startsWith('data:')) {
        const { uploadToBunny } = await import('@/lib/bunny')
        try {
          const matches = url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64')
            url = await uploadToBunny(buffer, filename || `gallery_${Date.now()}.jpg`, `projects/${projectId}/gallery`)
          }
        } catch (error) {
          console.error('Error uploading Base64 to Bunny:', error)
          return NextResponse.json({ error: 'Error al subir archivo a BunnyCDN' }, { status: 500 })
        }
      }
    }

    if (!url) {
      return NextResponse.json({ error: 'Faltan datos de la imagen o archivo' }, { status: 400 })
    }

    const newItem = await prisma.projectGalleryItem.create({
      data: {
        projectId,
        url,
        filename: filename || 'upload',
        mimeType: mimeType || 'image/jpeg',
        sizeBytes: sizeBytes || null,
        category: category || 'MASTER',
        createdAt: createdAt ? new Date(createdAt) : undefined
      }
    })

    if (syncId) {
      await prisma.syncLog.update({
        where: { syncId },
        data: { resultId: String(newItem.id) }
      }).catch(err => console.error('[Idempotency] Failed to finalize gallery sync log:', err));
    }

    return NextResponse.json(newItem, { status: 201 })
  } catch (error) {
    console.error('Error adding to gallery:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
