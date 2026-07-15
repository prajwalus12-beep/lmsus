import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { TeamDataTable } from './TeamDataTable'
import { columns } from './columns'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  // Restrict Team Directory to ADMIN and MANAGER
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return <div className="p-8 text-center text-red-500">Access Denied: You do not have permission to view the Team Directory.</div>
  }

  // Use supabaseAdmin to ensure full visibility for HR/Managers
  // Fetch users and balances separately and join them to be 100% safe
  const [
    { data: users, error: uError },
    { data: allBalances, error: bError }
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('*, departments(name)')
      .neq('role', 'ADMIN')
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('leave_balances')
      .select('*')
      .order('year', { ascending: false })
  ])

  if (uError) console.error("Error fetching users:", uError)
  if (bError) console.error("Error fetching balances:", bError)

  const balanceMap = new Map()
  if (allBalances) {
    allBalances.forEach(b => {
      if (!balanceMap.has(b.user_id)) {
        balanceMap.set(b.user_id, b)
      }
    })
  }

  const formattedData = (users || []).map((user: any) => {
    const balance = balanceMap.get(user.id) || null
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      department: user.departments?.name || 'N/A',
      departmentId: user.department_id || '',
      plBalance: balance?.pl ?? 0,
      clSlBalance: balance?.cl ?? 0,
      joinDate: user.join_date, 
      lastWorkingDay: user.last_working_day, 
      probationEndDate: user.probation_end_date, 
      displayJoinDate: user.join_date ? new Date(user.join_date).toLocaleDateString() : '—',
      displayLwd: user.last_working_day ? new Date(user.last_working_day).toLocaleDateString() : '—',
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Directory</h1>
        <p className="text-slate-500">Manage employees, view balances, and prorate leaves for new joiners.</p>
      </div>
      
      <div className="bg-white border rounded-xl shadow-sm">
        <TeamDataTable columns={columns} data={formattedData} currentUserRole={session.user.role} />
      </div>
    </div>
  )
}
