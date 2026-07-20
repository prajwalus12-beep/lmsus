import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { decryptSession } from '@/lib/session'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 })
    }

    // Decrypt token
    const tokenData = decryptSession(token)
    if (!tokenData || !tokenData.email || !tokenData.exp) {
      return NextResponse.json({ error: 'Invalid or expired password reset link. Please request a new one.' }, { status: 400 })
    }

    // Check expiration
    if (Date.now() > tokenData.exp) {
      return NextResponse.json({ error: 'Password reset link has expired. Please request a new one.' }, { status: 400 })
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: tokenData.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 })
    }

    // Hash the password and save to DB
    const hashedPassword = bcrypt.hashSync(password, 12)
    await prisma.user.update({
      where: { email: tokenData.email },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ success: true, message: 'Password has been reset successfully.' })
  } catch (err: any) {
    console.error('Confirm password reset error:', err)
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 })
  }
}
