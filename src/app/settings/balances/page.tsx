import { getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { redirect } from 'next/navigation'
import { BalancesClient } from './BalancesClient'

export const dynamic = 'force-dynamic'

export default async function OpeningBalancesPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
        <p className="text-slate-500 mt-2">Only HR/Admin can manage opening balances.</p>
      </div>
    )
  }

  // Use supabaseAdmin to bypass RLS
  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('*, departments(name), leave_balances(*)')
    .neq('role', 'ADMIN')
    .in('status', ['ACTIVE', 'NOTICE_PERIOD'])
    .order('name', { ascending: true })

  if (error) {
    console.error("Error fetching users for balances:", error)
  }

  const formattedUsers = (users || []).map((u: any) => {
    let balance = null
    if (Array.isArray(u.leave_balances)) {
      balance = u.leave_balances.find((b: any) => b.year === new Date().getFullYear()) || [...u.leave_balances].sort((a: any, b: any) => b.year - a.year)[0] || null
    } else {
      balance = u.leave_balances || null
    }

    const dept = Array.isArray(u.departments) ? u.departments[0] : u.departments

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      department: dept?.name || 'N/A',
      openingPl: balance?.opening_pl || 0,
      openingCl: balance?.opening_cl || 0,
      openingComp: balance?.opening_comp || 0,
      currentPl: balance?.pl || 0,
      currentCl: balance?.cl || 0
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opening Balance Management</h1>
        <p className="text-slate-500">View and edit employee opening leave balances for the current year.</p>
      </div>
      
      <BalancesClient initialUsers={formattedUsers} />
    </div>
  )
}
