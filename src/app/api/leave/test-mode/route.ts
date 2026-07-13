import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, getSupabaseServer } from '@/lib/supabaseServer'
import { setSystemDateOverride } from '@/lib/systemDate'

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    const { data: override } = await supabase
      .from('system_date_overrides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (override && override.is_test_mode) {
      return NextResponse.json({
        isTestMode: true,
        overrideDate: override.override_date
      })
    }
  } catch (error) {
    console.error('Error fetching test mode status:', error)
  }

  return NextResponse.json({
    isTestMode: false,
    overrideDate: null
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession()
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
      isTestMode: result.is_test_mode, 
      overrideDate: result.override_date 
    })
  } catch (error: any) {
    console.error('Test Mode Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
