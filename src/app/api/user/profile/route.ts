import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { communicationEmail: true }
  })
  
  return NextResponse.json(user)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { communicationEmail } = await req.json()
  
  await prisma.user.update({
    where: { email: session.user.email },
    data: { communicationEmail }
  })
  
  return NextResponse.json({ success: true })
}
