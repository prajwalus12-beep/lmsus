import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const supabase = await getSupabaseServer()
  const { data: user, error } = await supabase
    .from('profiles')
    .select('communication_email')
    .eq('id', session.user.id)
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ communicationEmail: user?.communication_email })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { communicationEmail } = await req.json()
  const supabase = await getSupabaseServer()
  
  const { error } = await supabase
    .from('profiles')
    .update({ communication_email: communicationEmail })
    .eq('id', session.user.id)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
