import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, communicationEmail: true, status: true }
  })
  
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const displayEmail = (user.communicationEmail && user.communicationEmail !== 'noreply@yopmail.com')
    ? user.communicationEmail
    : user.email

  return NextResponse.json({ 
    communicationEmail: displayEmail,
    status: user.status 
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { communicationEmail } = await req.json()
  
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { communicationEmail: communicationEmail }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
