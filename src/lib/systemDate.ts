process.env.TZ = 'Asia/Kolkata'

import prisma from './prisma'

/**
 * Returns the current system date.
 * If Test Mode is enabled and an override date exists, it returns the override date.
 * Otherwise, it returns the current real-world date.
 */
export async function getSystemDate(): Promise<Date> {
  try {
    const override = await prisma.systemDateOverride.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    if (override && override.isTestMode && override.overrideDate) {
      return new Date(override.overrideDate)
    }
  } catch (error) {
    console.error('Error fetching system date override:', error)
  }

  return new Date()
}

/**
 * Returns the current system date and time.
 * In normal mode, returns the current real-world date and time.
 * In test mode, returns the simulated date combined with the current real-world time.
 */
export async function getSystemDateTime(): Promise<Date> {
  try {
    const override = await prisma.systemDateOverride.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    if (override && override.isTestMode && override.overrideDate) {
      const simDate = new Date(override.overrideDate)
      const realNow = new Date()
      return new Date(
        simDate.getFullYear(),
        simDate.getMonth(),
        simDate.getDate(),
        realNow.getHours(),
        realNow.getMinutes(),
        realNow.getSeconds(),
        realNow.getMilliseconds()
      )
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

  const newOverride = await prisma.systemDateOverride.create({
    data: {
      isTestMode: date !== null,
      overrideDate: date,
      changedBy: userId,
      changedByName: userName,
      oldDate: oldOverride?.overrideDate || new Date(),
      newDate: date,
      reason: date === null ? 'Disabled Test Mode' : 'Manual Date Override'
    }
  })

  return newOverride
}
