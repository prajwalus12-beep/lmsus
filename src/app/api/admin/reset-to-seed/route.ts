import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import fs from 'fs'
import path from 'path'
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    console.log('--- SYSTEM RESET INITIATED BY ADMIN ---')

    // 1. Load seed data from JSON
    const dataPath = path.join(process.cwd(), 'data_backup.json')
    const fileContent = fs.readFileSync(dataPath, 'utf8')
    const seedData = JSON.parse(fileContent)

    if (!seedData.users || seedData.users.length === 0) {
      return NextResponse.json({ error: 'No seed data found in data_backup.json' }, { status: 400 })
    }

    // 2. Clear all live data via Supabase Admin
    const tables = [
      'audit_logs', 'leave_balance_adjustments', 'leave_ledger_entries', 
      'leave_requests', 'comp_off_work_entries', 'negative_leave_trackings', 
      'carry_forward_histories', 'leave_year_closures', 'leave_balances', 
      'system_configs', 'holidays', 'profiles', 'departments', 
      'weekend_configs', 'system_date_overrides'
    ]

    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().neq('id', 'placeholder-non-existent-id')
      if (error) console.warn(`Warning clearing ${table}:`, error.message)
    }

    // Clear auth.users
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers()
    for (const au of authUsers) {
      if (au.id !== session.user.id) { 
         await supabaseAdmin.auth.admin.deleteUser(au.id)
      }
    }

    // 3. Restore departments
    await supabaseAdmin.from('departments').insert(seedData.departments.map((d: any) => ({
      id: d.id,
      name: d.name,
      created_at: d.createdAt
    })))

    const user_id_map: Record<string, string> = {}

    // 4. Restore users to auth.users and profiles
    for (const u of seedData.users) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: "Unique@123", // Set a standard password for all seeded users
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role }
      })

      if (authError) {
        console.error(`Error restoring user ${u.email}:`, authError.message)
        continue
      }

      const newUid = authData.user.id
      user_id_map[u.id] = newUid

      // Update profiles with metadata
      await supabaseAdmin
        .from('profiles')
        .update({
          department_id: u.departmentId || null,
          join_date: u.joinDate,
          status: u.status,
          communication_email: u.communicationEmail,
          created_at: u.createdAt
        })
        .eq('id', newUid)
    }

    // 5. Restore leave balances
    const balancesToInsert = seedData.leaveBalances.map((b: any) => {
      const mappedUserId = user_id_map[b.userId]
      if (!mappedUserId) return null
      return {
        id: b.id,
        user_id: mappedUserId,
        year: b.year,
        opening_pl: b.openingPl,
        opening_cl: b.openingCl,
        opening_comp: b.openingComp,
        pl: b.pl,
        cl: b.cl,
        sl: b.sl,
        comp: b.comp,
        pl_accrued: b.plAccrued,
        pl_used: b.plUsed,
        cl_used: b.clUsed,
        sl_used: b.slUsed,
        created_at: b.createdAt
      }
    }).filter(Boolean) as any[]

    if (balancesToInsert.length > 0) {
      await supabaseAdmin.from('leave_balances').insert(balancesToInsert)
    }

    // 6. Restore holidays
    await supabaseAdmin.from('holidays').insert(seedData.holidays.map((h: any) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      type: h.type,
      created_at: h.createdAt
    })))

    // 7. Restore configs
    await supabaseAdmin.from('system_configs').insert(seedData.systemConfigs.map((c: any) => ({
      id: c.id,
      key: c.key,
      value: c.value,
      created_at: c.createdAt
    })))

    // Log reset
    await supabaseAdmin.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'SYSTEM_RESET',
      entity: 'System',
      metadata: JSON.stringify({ message: 'System restored to seed state via JSON backup' })
    })

    return NextResponse.json({ 
      success: true, 
      message: 'System reset to seed state successfully.' 
    })

  } catch (error: any) {
    console.error('Reset Error:', error)
    return NextResponse.json({ error: 'Reset failed: ' + error.message }, { status: 500 })
  }
}
