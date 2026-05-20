import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as any
  if (sessionUser?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role, departmentId, joinDate, openingPl, openingCl } = await req.json()

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'User already exists' }, { status: 400 })

  const hashedPassword = await bcrypt.hash(password || 'Unique@123', 10)

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role || 'EMPLOYEE',
      departmentId,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      balances: {
        create: {
          year: new Date().getFullYear(),
          openingPl: parseFloat(openingPl) || 0,
          openingCl: parseFloat(openingCl) || 0,
          pl: parseFloat(openingPl) || 0,
          cl: parseFloat(openingCl) || 0,
          sl: 7,
          comp: 0,
          lop: 0,
          plAccrued: 0,
          plUsed: 0,
          clUsed: 0,
          slUsed: 0,
          plCarryForward: 0,
        }
      }
    }
  })

  return NextResponse.json(newUser)
}
