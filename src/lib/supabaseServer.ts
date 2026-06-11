import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ulwoyxlnmtfnbfpfujtq.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export async function getServerSession(options?: any) {
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('getServerSession: Auth getUser failed or no user', error?.message);
      return null;
    }

    // Query profile and department name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, departments(name)')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.log('getServerSession: Profile fetch failed or no profile', profileError?.message);
      return null
    }

    return {
      user: {
        id: user.id,
        name: profile.name || user.user_metadata?.name || 'Employee',
        email: user.email,
        role: profile.role || user.user_metadata?.role || 'EMPLOYEE',
        department: profile.departments?.name || 'N/A'
      }
    }
  } catch (err) {
    console.error('Error getting server session:', err)
    return null
  }
}
