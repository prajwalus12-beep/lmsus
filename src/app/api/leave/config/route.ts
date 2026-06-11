import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getServerSession } from '@/lib/supabaseServer'

// GET /api/leave/config?key=SHOW_CL_BALANCE_TO_EMPLOYEE
export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const supabase = await getSupabaseServer()

  if (key) {
    const { data: config } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return NextResponse.json({ key, value: config?.value ?? null })
  }

  const { data: all } = await supabase
    .from('system_configs')
    .select('*')
    .order('key', { ascending: true })

  return NextResponse.json(all || [])
}

// POST /api/leave/config  body: { key, value, description? }
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  if (sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { key, value, description } = body as { key: string; value: string; description?: string }

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }

  const supabase = await getSupabaseServer()

  // In Supabase, we can upsert by key
  const { data: config, error: upsertError } = await supabase
    .from('system_configs')
    .upsert({
      key,
      value,
      description: description ?? '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
    .select('*')
    .single()

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Audit Log
  const { error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      user_id: sessionUser.id,
      action: 'CONFIG_CHANGED',
      entity: 'SystemConfig',
      entity_id: key,
      new_value: value,
      metadata: JSON.stringify({ description })
    })

  if (auditError) console.error("Error creating config changed audit log:", auditError)

  return NextResponse.json({ success: true, config })
}
