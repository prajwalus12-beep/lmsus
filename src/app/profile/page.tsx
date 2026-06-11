import { getServerSession } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  return <ProfileClient />
}
