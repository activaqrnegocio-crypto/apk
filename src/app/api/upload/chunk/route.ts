import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// Temporary directory for chunks
const CHUNKS_DIR = path.join(process.cwd(), 'temp_chunks')

if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const chunk = formData.get('chunk') as Blob
    const uploadId = formData.get('uploadId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)
    const filename = formData.get('filename') as string || 'upload'

    if (!chunk || !uploadId) {
      return NextResponse.json({ error: 'Missing chunk or uploadId' }, { status: 400 })
    }

    const chunkPath = path.join(CHUNKS_DIR, `${uploadId}_${chunkIndex}`)
    const buffer = Buffer.from(await chunk.arrayBuffer())
    fs.writeFileSync(chunkPath, buffer)

    // Check if all chunks have arrived
    const chunks = fs.readdirSync(CHUNKS_DIR).filter(f => f.startsWith(uploadId + '_'))
    
    if (chunks.length === totalChunks) {
      console.log(`[ChunkUpload] All ${totalChunks} chunks received for ${uploadId}. Assembling...`)
      
      const finalPath = path.join(CHUNKS_DIR, `${uploadId}_final`)
      const writeStream = fs.createWriteStream(finalPath)

      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(CHUNKS_DIR, `${uploadId}_${i}`)
        const data = fs.readFileSync(partPath)
        writeStream.write(data)
        fs.unlinkSync(partPath) // Delete chunk after writing
      }
      writeStream.end()

      // Wait for stream to finish
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve())
        writeStream.on('error', reject)
      })

      try {
        const fileBuffer = fs.readFileSync(finalPath)
        
        const storageZone = process.env.BUNNY_STORAGE_ZONE
        const accessKey = process.env.BUNNY_STORAGE_API_KEY
        const storageHost = process.env.BUNNY_STORAGE_HOST
        const pullZoneUrl = process.env.BUNNY_PULLZONE_URL

        const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
        const bunnyPath = `crm/uploads/${Date.now()}-${cleanName}`

        const bunnyResp = await fetch(`https://${storageHost}/${storageZone}/${bunnyPath}`, {
          method: 'PUT',
          headers: {
            'AccessKey': accessKey!,
            'Content-Type': 'application/octet-stream',
          },
          body: fileBuffer
        })

        fs.unlinkSync(finalPath) // Delete final temp file

        if (!bunnyResp.ok) {
          return NextResponse.json({ error: 'Failed to upload to CDN' }, { status: 502 })
        } else {
          return NextResponse.json({ url: `${pullZoneUrl}/${bunnyPath}`, status: 'completed' })
        }
      } catch (err) {
        console.error('[ChunkUpload] Error in final assembly/upload:', err)
        return NextResponse.json({ error: 'Internal Server Error during assembly' }, { status: 500 })
      }
    }

    return NextResponse.json({ status: 'chunk_received', index: chunkIndex })

  } catch (error) {
    console.error('[ChunkUpload] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
