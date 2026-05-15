import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { uploadToBunny } from '@/lib/bunny'
import { notifyProjectTeam } from '@/lib/push'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA' && userRole !== 'SUPERADMIN') {
      const isMember = await prisma.projectTeam.findUnique({
        where: { projectId_userId: { projectId: Number(id), userId: Number(session.user.id) } }
      })
      if (!isMember) {
        const isCreator = await prisma.project.findFirst({
          where: { id: Number(id), createdBy: Number(session.user.id) }
        })
        if (!isCreator) {
          return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
        }
      }
    }

    const { searchParams } = new URL(req.url)
    const since = searchParams.get('since')

    const messages = await prisma.chatMessage.findMany({
      where: {
        projectId: Number(id),
        ...(since ? { createdAt: { gt: new Date(since) } } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            branch: true
          }
        },
        media: true
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('[API Messages GET ERROR]:', error)
    return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    const syncId = req.headers.get('x-sync-id');
    if (syncId) {
      try {
        // v365: ATOMIC idempotency — claim syncId BEFORE creating message
        // This prevents the race condition where two parallel requests both pass
        // findUnique and create duplicate messages.
        await prisma.syncLog.create({
          data: { syncId, resultId: '__pending__' }
        });
        // Claim succeeded — this request owns this syncId
      } catch (claimErr: any) {
        if (claimErr.code === 'P2002') {
          // syncId already claimed by another request
          const existing = await prisma.syncLog.findUnique({ where: { syncId } });
          if (existing && existing.resultId !== '__pending__') {
            // Success, just returning existing id without noise
            return NextResponse.json({ 
              success: true, 
              id: Number(existing.resultId), 
              isDuplicate: true 
            });
          }
          
          // v367: HIJACK STALLED CLAIMS
          // If the claim has been pending for more than 2 minutes, assume the process crashed
          // and allow this request to proceed/hijack.
          if (existing && existing.createdAt < new Date(Date.now() - 120000)) {
            console.warn(`[Idempotency] Hijacking stalled syncLog for ${syncId}`);
            await prisma.syncLog.update({
              where: { syncId },
              data: { createdAt: new Date() } // Update timestamp to hold it for another cycle
            }).catch(() => {}); // Ignore if already updated
          } else {
            // Still pending from the first request — tell client to retry
            return NextResponse.json({ success: true, isDuplicate: true, id: 0 });
          }
        } else {
          throw claimErr;
        }
      }
    }

    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      
    // v430: Support BOTH JSON and FormData for Turbo Sync (avoiding Base64 crashes)
    let phaseId, content, type, lat, lng, createdAt, extraData, mediaPayload;
    let mediaUrl = null;
    const projectId = Number(id)
    const userId = Number(session.user.id)

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      phaseId = formData.get('phaseId');
      content = formData.get('content') as string;
      type = formData.get('type') as string;
      lat = formData.get('lat');
      lng = formData.get('lng');
      createdAt = formData.get('createdAt') as string;
      const extraDataRaw = formData.get('extraData') as string;
      extraData = extraDataRaw ? JSON.parse(extraDataRaw) : null;
      
      const file = formData.get('file') as File;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        mediaUrl = await uploadToBunny(buffer, file.name || 'upload.jpg', `projects/${projectId}/chat`);
        mediaPayload = {
          filename: file.name,
          mimeType: file.type,
          url: mediaUrl
        };
      }
    } else {
      const body = await req.json();
      phaseId = body.phaseId;
      content = body.content;
      type = body.type;
      lat = body.lat;
      lng = body.lng;
      createdAt = body.createdAt;
      extraData = body.extraData;
      mediaPayload = body.media;

      if (mediaPayload && mediaPayload.base64) {
        try {
          const parts = mediaPayload.base64.split(',')
          if (parts.length > 1) {
            const buffer = Buffer.from(parts[1], 'base64')
            mediaUrl = await uploadToBunny(buffer, mediaPayload.filename || 'upload.jpg', `projects/${projectId}/chat`)
          }
        } catch (uploadError) {
          console.error('Error uploading to Bunny:', uploadError)
          throw new Error('Failed to upload file to storage')
        }
      }
    }
    
    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'ADMINISTRADORA' && userRole !== 'SUPERADMIN') {
      const isMember = await prisma.projectTeam.findUnique({
        where: { projectId_userId: { projectId, userId } }
      })
      if (!isMember) {
        const isCreator = await prisma.project.findFirst({
          where: { id: projectId, createdBy: userId }
        })
        if (!isCreator) {
          return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
        }
      }
    }

    // Determine type if not provided
    let finalType = type
    if (!finalType && (mediaUrl || mediaPayload?.url)) {
      const mime = mediaPayload?.mimeType || ''
      if (mime.startsWith('image/')) finalType = 'IMAGE'
      else if (mime.startsWith('video/')) finalType = 'VIDEO'
      else if (mime.includes('pdf')) finalType = 'DOCUMENT'
      else finalType = 'IMAGE' // Default fallback
    } else if (!finalType) {
      finalType = 'TEXT'
    }

    const msg = await prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        phaseId: phaseId ? Number(phaseId) : null,
        content: content || (mediaUrl || mediaPayload?.url ? '' : null),
        type: finalType,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        extraData: extraData ? (typeof extraData === 'string' ? extraData : JSON.stringify(extraData)) : undefined,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        media: (mediaUrl || (mediaPayload && mediaPayload.url)) ? {
          create: {
            url: mediaUrl || mediaPayload.url,
            filename: mediaPayload.filename || 'upload.jpg',
            mimeType: mediaPayload.mimeType || 'image/jpeg'
          }
        } : undefined
      },
      include: {
        media: true
      }
    })

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true }
    })

    // v365: Update the sync log with the real message ID (was '__pending__')
    if (syncId) {
      await prisma.syncLog.update({
        where: { syncId },
        data: { resultId: String(msg.id) }
      }).catch(err => {
        console.error('[Idempotency] Failed to update sync log:', err);
      });
    }
    const projectTitle = project?.title || 'Proyecto'

    // If it's an expense, record it in the expenses table too (EXCEPT if it's just a note)
    if (finalType === 'EXPENSE_LOG' && extraData && extraData.amount !== undefined && !extraData.isNote) {
      await prisma.expense.create({
        data: {
          projectId,
          userId,
          amount: Number(extraData.amount),
          description: content || 'Gasto registrado desde chat',
          category: extraData.category || 'OTRO',
          date: extraData.date ? new Date(extraData.date) : new Date(),
          receiptUrl: mediaUrl || (mediaPayload && mediaPayload.url), // Fix: attach the photo to the expense record too
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
        }
      })
    }

    // 🔔 Push Notification to team (fire-and-forget)
    let pushBody = content?.substring(0, 80) || 'Nuevo mensaje'
    
    // Better body based on type
    if (finalType === 'IMAGE') pushBody = `📷 Imagen: ${content || 'Nueva foto'}`
    else if (finalType === 'VIDEO') pushBody = `🎥 Video: ${content || 'Nuevo video'}`
    else if (finalType === 'AUDIO') pushBody = `🎤 Audio: ${content || 'Mensaje de voz'}`
    else if (finalType === 'LOCATION') pushBody = `📍 Ubicación enviada`
    else if (finalType === 'DOCUMENT') pushBody = `📄 Documento: ${content || 'Nuevo archivo'}`
    else if (finalType === 'EXPENSE_LOG') {
      const amount = extraData?.amount ? Number(extraData.amount).toFixed(2) : '?'
      pushBody = `💰 Gasto: $${amount} - ${content || 'Sin descripción'}`
    }

    notifyProjectTeam(
      projectId, userId,
      `💬 ${projectTitle} - ${session.user.name}`,
      pushBody,
      `URL_PROJECT_CHAT:${projectId}`,
      `chat-${projectId}`,
      mediaUrl || (mediaPayload && mediaPayload.url) || undefined
    )

    return NextResponse.json(msg)
  } catch (error) {
    console.error('[API Messages ERROR]:', error)
    return NextResponse.json({ 
      error: 'Error interno al enviar mensaje'
    }, { status: 500 })
  }
}
