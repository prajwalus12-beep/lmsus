import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { setSessionCookie } from '@/lib/session'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    // Find the user in the database
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (user.status !== 'ACTIVE' && user.status !== 'NOTICE_PERIOD') {
      return NextResponse.json({ error: 'Your account is inactive. Please contact HR.' }, { status: 403 })
    }

    // Verify password (supporting bcrypt)
    const passwordMatch = bcrypt.compareSync(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    // Set the session cookie
    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    })

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err: any) {
    console.error('Login API error:', err)
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 })
  }
}
