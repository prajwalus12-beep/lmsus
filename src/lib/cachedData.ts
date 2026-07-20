import { unstable_cache } from 'next/cache'
import prisma from './prisma'

// 1. Cache Holidays (1 hour)
export const getCachedHolidays = unstable_cache(
  async (year: number) => {
    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      orderBy: { date: 'asc' }
    })
    return holidays
  },
  ['holidays-cache'],
  { revalidate: 3600, tags: ['holidays'] }
)

// 2. Cache System Config (1 hour)
export const getCachedConfig = unstable_cache(
  async (key: string) => {
    const config = await prisma.systemConfig.findUnique({
      where: { key }
    })
    return config
  },
  ['system-config-cache'],
  { revalidate: 3600, tags: ['config'] }
)

// 3. Cache Department List
export const getCachedDepartments = unstable_cache(
  async () => {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    })
    return departments
  },
  ['departments-cache'],
  { revalidate: 3600, tags: ['departments'] }
)
