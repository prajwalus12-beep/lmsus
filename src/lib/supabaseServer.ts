import { cookies } from 'next/headers'
import prisma from './prisma'
import { getSessionFromCookie } from './session'

// Kept for backward compatibility during refactoring
export async function getSupabaseServer() {
  return null as any
}

export async function getServerSession(options?: any) {
  try {
    const sessionData = await getSessionFromCookie()
    if (!sessionData || !sessionData.id) {
      return null
    }

    // Query user and department name from the database using Prisma
    const user = await prisma.user.findUnique({
      where: { id: sessionData.id },
      include: { department: true }
    })

    if (!user || user.status !== 'ACTIVE' && user.status !== 'NOTICE_PERIOD') {
      return null
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department?.name || 'N/A'
      }
    }
  } catch (err) {
    console.error('Error getting server session:', err)
    return null
  }
}

