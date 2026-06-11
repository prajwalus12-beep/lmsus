import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * GET /api/leave/my-calendar
 * Returns only the current (session) user's approved leave requests,
 * formatted for the calendar. No client-side user ID matching needed.
 */
export async function GET() {
  const session = await getServerSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const { data: requests, error } = await supabaseAdmin
    .from('leave_requests')
    .select('*, profiles!leave_requests_user_id_fkey(name, email, departments(name))')
    .eq('user_id', userId)
    .in('status', ['HR_APPROVED', 'L1_APPROVED'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const formatted = (requests || []).map((req: any) => {
    const profile = req.profiles
    const dept = Array.isArray(profile?.departments)
      ? profile.departments[0]
      : profile?.departments

    return {
      id: req.id,
      userId: req.user_id,
      title: `${profile?.name || 'Unknown'} - ${req.type}`,
      email: profile?.email || '',
      startDate: req.start_date,
      endDate: req.end_date,
      department: dept?.name || 'N/A',
      type: req.type,
      status: req.status,
    }
  })

  return NextResponse.json({ requests: formatted, userId })
}
