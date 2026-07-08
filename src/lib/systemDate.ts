import { getSupabaseServer } from './supabaseServer'

/**
 * Returns the current system date.
 * If Test Mode is enabled and an override date exists, it returns the override date.
 * Otherwise, it returns the current real-world date.
 */
export async function getSystemDate(): Promise<Date> {
  try {
    const supabase = await getSupabaseServer()
    const { data: override } = await supabase
      .from('system_date_overrides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (override && override.is_test_mode && override.override_date) {
      return new Date(override.override_date)
    }
  } catch (error) {
    console.error('Error fetching system date override:', error)
  }

  return new Date()
}

/**
 * Sets the system date override.
 */
export async function setSystemDateOverride(date: Date | null, userId: string, userName: string) {
  const supabase = await getSupabaseServer()

  const { data: oldOverride } = await supabase
    .from('system_date_overrides')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('system_date_overrides')
    .insert({
      is_test_mode: date !== null,
      override_date: date ? date.toISOString() : null,
      changed_by: userId,
      changed_by_name: userName,
      old_date: oldOverride?.override_date || new Date().toISOString(),
      new_date: date ? date.toISOString() : null,
      reason: date === null ? 'Disabled Test Mode' : 'Manual Date Override'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}
