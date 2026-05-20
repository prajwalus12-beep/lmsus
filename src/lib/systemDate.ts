import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Returns the current system date.
 * If Test Mode is enabled and an override date exists, it returns the override date.
 * Otherwise, it returns the current real-world date.
 */
export async function getSystemDate(): Promise<Date> {
  try {
    const override = await prisma.systemDateOverride.findFirst({
      where: { isTestMode: true },
      orderBy: { createdAt: 'desc' }
    })

    if (override && override.overrideDate) {
      return new Date(override.overrideDate)
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
  const oldOverride = await prisma.systemDateOverride.findFirst({
    orderBy: { createdAt: 'desc' }
  })

  return await prisma.systemDateOverride.create({
    data: {
      isTestMode: date !== null,
      overrideDate: date,
      changedBy: userId,
      changedByName: userName,
      oldDate: oldOverride?.overrideDate ?? new Date(),
      newDate: date,
      reason: date === null ? 'Disabled Test Mode' : 'Manual Date Override'
    }
  })
}
