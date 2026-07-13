import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { getSystemDate } from '@/lib/systemDate'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const { scenario } = await req.json()
  const systemDate = await getSystemDate()

  try {
    if (scenario === 'Probation Completion') {
      const { data: users, error } = await supabaseAdmin
        .from('profiles')
        .select('name, join_date, probation_end_date, status')
        .eq('status', 'ACTIVE')

      if (error) throw new Error(error.message)

      const completedUsers = []

      const { data: config } = await supabaseAdmin
        .from('system_configs')
        .select('value')
        .eq('key', 'PROBATION_PERIOD_MONTHS')
        .maybeSingle()
      const probationMonths = parseInt(config?.value || '6')

      for (const u of (users || [])) {
        let probEnd = u.probation_end_date ? new Date(u.probation_end_date) : null
        if (!probEnd && u.join_date) {
          probEnd = new Date(u.join_date)
          probEnd.setMonth(probEnd.getMonth() + probationMonths)
        }

        if (probEnd && probEnd <= systemDate) {
          completedUsers.push(u.name)
        }
      }

      return NextResponse.json({
        success: true,
        message: completedUsers.length > 0 
          ? `Verified probation completion: ${completedUsers.join(', ')} successfully completed probation by simulated date.`
          : 'No active employees have completed probation as of this simulated date.'
      })
    }

    return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 })
  } catch (error: any) {
    console.error('Simulation Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
