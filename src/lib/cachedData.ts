import { unstable_cache } from 'next/cache'
import prisma from './prisma'

// 1. Cache Holidays (1 hour)
export const getCachedHolidays = unstable_cache(
  async (year: number) => {
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31)
    return prisma.holiday.findMany({
      where: { date: { gte: startOfYear, lte: endOfYear } },
      orderBy: { date: 'asc' }
    })
  },
  ['holidays-cache'],
  { revalidate: 3600, tags: ['holidays'] }
)

// 2. Cache System Config (1 hour)
export const getCachedConfig = unstable_cache(
  async (key: string) => {
    return prisma.systemConfig.findUnique({ where: { key } })
  },
  ['system-config-cache'],
  { revalidate: 3600, tags: ['config'] }
)

// 3. Cache Department List
export const getCachedDepartments = unstable_cache(
  async () => {
    return prisma.department.findMany({ orderBy: { name: 'asc' } })
  },
  ['departments-cache'],
  { revalidate: 3600, tags: ['departments'] }
)
