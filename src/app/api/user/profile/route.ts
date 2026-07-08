import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const supabase = await getSupabaseServer()
  const { data: user, error } = await supabase
    .from('profiles')
    .select('communication_email, status')
    .eq('id', session.user.id)
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ 
    communicationEmail: user?.communication_email,
    status: user?.status 
  })
}

export async function PUT(req: NextRequest) {
  const supabase = await getSupabaseServer()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { communicationEmail } = await req.json()
  
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ communication_email: communicationEmail })
    .eq('id', user.id)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
