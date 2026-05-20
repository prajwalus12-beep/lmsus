import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const prisma = new PrismaClient()

// GET /api/leave/config?key=SHOW_CL_BALANCE_TO_EMPLOYEE
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')

  if (key) {
    const config = await prisma.systemConfig.findUnique({ where: { key } })
    return NextResponse.json({ key, value: config?.value ?? null })
  }

  const all = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json(all)
}

// POST /api/leave/config  body: { key, value, description? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
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

  const config = await prisma.systemConfig.upsert({
    where: { key },
    update: { value, ...(description ? { description } : {}) },
    create: { key, value, description: description ?? '' },
  })

  // Audit Log
  await prisma.auditLog.create({
    data: {
      userId: sessionUser.id,
      action: 'CONFIG_CHANGED',
      entity: 'SystemConfig',
      entityId: key,
      newValue: value,
      metadata: JSON.stringify({ description })
    }
  })

  return NextResponse.json({ success: true, config })
}
