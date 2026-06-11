import { getServerSession } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { HolidaysClient } from './HolidaysClient'

export default async function HolidaysPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
        <p className="text-slate-500 mt-2">Only HR/Admin can manage public holidays.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <HolidaysClient />
    </div>
  )
}
