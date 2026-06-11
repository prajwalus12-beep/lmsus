import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const sessionUser = session?.user as any
  if (sessionUser?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role, departmentId, joinDate, openingPl, openingCl } = await req.json()

  // 1. Create User in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: password || 'Unique@123',
    email_confirm: true,
    user_metadata: { name, role: role || "EMPLOYEE" }
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const userId = authData.user.id

  // 2. Update the profile record (created by trigger) with department and joinDate
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      department_id: departmentId || null,
      join_date: joinDate ? new Date(joinDate).toISOString() : new Date().toISOString(),
      status: 'ACTIVE'
    })
    .eq('id', userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // 3. Create default leave_balances
  const parsedPl = parseFloat(openingPl) || 0
  const parsedCl = parseFloat(openingCl) || 0

  const { error: balanceError } = await supabaseAdmin
    .from('leave_balances')
    .insert({
      user_id: userId,
      year: new Date().getFullYear(),
      opening_pl: parsedPl,
      opening_cl: parsedCl,
      pl: parsedPl,
      cl: parsedCl,
      sl: 7,
      comp: 0,
      pl_accrued: 0,
      pl_used: 0,
      cl_used: 0,
      sl_used: 0,
      pl_carry_forward: 0
    })

  if (balanceError) {
    return NextResponse.json({ error: balanceError.message }, { status: 500 })
  }

  return NextResponse.json({ id: userId, name, email, role })
}
