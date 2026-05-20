import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { setSystemDateOverride } from '@/lib/systemDate'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { date, enabled } = body // date is string or null, enabled is boolean

  try {
    const overrideDate = enabled && date ? new Date(date) : null
    const result = await setSystemDateOverride(overrideDate, sessionUser.id, sessionUser.name)

    return NextResponse.json({ 
      success: true, 
      isTestMode: result.isTestMode, 
      overrideDate: result.overrideDate 
    })
  } catch (error: any) {
    console.error('Test Mode Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
