import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession()
    return NextResponse.json(session)
  } catch (err: any) {
    console.error('Session API error:', err)
    return NextResponse.json(null)
  }
}
