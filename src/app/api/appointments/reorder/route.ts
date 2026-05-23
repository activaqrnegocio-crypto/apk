import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin as checkIsAdmin, hasModuleAccess } from '@/lib/rbac'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = checkIsAdmin((session.user as any).role)
    const canManage = isAdmin || hasModuleAccess(session.user as any, 'calendario')
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { orders } = body // orders: Array de { id: number, priority: string }

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: 'Se requiere un array de órdenes' }, { status: 400 })
    }

    // Ejecutar todas las actualizaciones de prioridad de forma atómica
    await prisma.$transaction(
      orders.map(o => 
        prisma.appointment.update({
          where: { id: Number(o.id) },
          data: { title: o.priority.toString() }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering appointments:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
