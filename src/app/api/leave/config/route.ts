import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'

// GET /api/leave/config?key=SHOW_CL_BALANCE_TO_EMPLOYEE
export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')

  if (key) {
    const config = await prisma.systemConfig.findUnique({
      where: { key }
    })
    return NextResponse.json({ key, value: config?.value ?? null })
  }

  const all = await prisma.systemConfig.findMany({
    orderBy: { key: 'asc' }
  })

  return NextResponse.json(all || [])
}

// POST /api/leave/config  body: { key, value, description? }
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { key, value, description } = body as { key: string; value: string; description?: string }

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }

  try {
    // Upsert using Prisma
    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value,
        description: description ?? '',
        updatedAt: new Date()
      },
      create: {
        key,
        value,
        description: description ?? '',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'CONFIG_CHANGED',
          entity: 'SystemConfig',
          entityId: key,
          newValue: value,
          metadata: JSON.stringify({ description }),
          createdAt: new Date()
        }
      })
    } catch (auditError) {
      console.error("Error creating config changed audit log:", auditError)
    }

    return NextResponse.json({ success: true, config })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
