import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from './supabaseAdmin'

// 1. Cache Holidays (1 hour)
// NOTE: unstable_cache cannot use cookies() / getSupabaseServer() — use supabaseAdmin instead.
export const getCachedHolidays = unstable_cache(
  async (year: number) => {
    const startOfYear = `${year}-01-01T00:00:00.000Z`
    const endOfYear = `${year}-12-31T23:59:59.999Z`
    const { data } = await supabaseAdmin
      .from('holidays')
      .select('*')
      .gte('date', startOfYear)
      .lte('date', endOfYear)
      .order('date', { ascending: true })
    return data || []
  },
  ['holidays-cache'],
  { revalidate: 3600, tags: ['holidays'] }
)

// 2. Cache System Config (1 hour)
export const getCachedConfig = unstable_cache(
  async (key: string) => {
    const { data } = await supabaseAdmin
      .from('system_configs')
      .select('*')
      .eq('key', key)
      .maybeSingle()
    return data || null
  },
  ['system-config-cache'],
  { revalidate: 3600, tags: ['config'] }
)

// 3. Cache Department List
export const getCachedDepartments = unstable_cache(
  async () => {
    const { data } = await supabaseAdmin
      .from('departments')
      .select('*')
      .order('name', { ascending: true })
    return data || []
  },
  ['departments-cache'],
  { revalidate: 3600, tags: ['departments'] }
)
