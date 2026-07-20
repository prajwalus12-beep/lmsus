import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { oldPassword, newPassword } = await req.json()

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Fetch user from Prisma database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify old password (supporting bcrypt comparison)
    const passwordMatch = bcrypt.compareSync(oldPassword, user.password)
    
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Incorrect old password' }, { status: 400 })
    }

    // Hash the new password using bcrypt
    const hashedPassword = bcrypt.hashSync(newPassword, 10)

    // Update password in Prisma database
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (err: any) {
    console.error('Password API error:', err)
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 })
  }
}
