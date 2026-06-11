import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { oldPassword, newPassword } = await req.json()

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = await getSupabaseServer()

  // Verify old password by signing in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password: oldPassword
  })

  if (signInError) {
    return NextResponse.json({ error: 'Incorrect old password' }, { status: 400 })
  }

  // Update password in Supabase Auth
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Password updated successfully' })
}
