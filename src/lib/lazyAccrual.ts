import { calculateMonthlyPLAccrual, calculateMonthlyCLAccrual } from './accrualEngine'
import { syncUserLedger } from './ledgerSync'
import { getSystemDate } from './systemDate'
import prisma from './prisma'

let isRunning = false // In-memory lock to prevent concurrent executions

export async function checkAndRunLazyAccrual() {
  if (isRunning) return
  isRunning = true

  try {
    const systemDate = await getSystemDate()
    
    // Calculate the target year and month (previous month)
    const prevDate = new Date(systemDate)
    prevDate.setMonth(prevDate.getMonth() - 1)
    const targetMonth = prevDate.getMonth() // 0-11
    const targetYear = prevDate.getFullYear()

    // 1. Check if ANY user has already received ANY monthly accrual for targetMonth/targetYear
    const existing = await prisma.leaveBalanceAdjustment.findFirst({
      where: {
        adjustmentType: 'MONTHLY_ACCRUAL',
        effectiveYear: targetYear,
        createdAt: {
          gte: new Date(Date.UTC(targetYear, targetMonth + 1, 1)),
          lte: new Date(Date.UTC(targetYear, targetMonth + 1, 2))
        }
      }
    })

    if (existing) {
      // Already run for this month!
      return
    }

    console.log(`[LazyAccrual] Triggering automatic PL/CL accrual for month: ${targetMonth}, year: ${targetYear}`)

    // 2. Run accrual for all active users
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' }
    })

    for (const user of users) {
      let isChanged = false

      // Check PL accrual for this user
      const userPlAccrual = await prisma.leaveBalanceAdjustment.findFirst({
        where: {
          userId: user.id,
          leaveType: 'PL',
          adjustmentType: 'MONTHLY_ACCRUAL',
          effectiveYear: targetYear,
          createdAt: {
            gte: new Date(Date.UTC(targetYear, targetMonth + 1, 1)),
            lte: new Date(Date.UTC(targetYear, targetMonth + 1, 2))
          }
        }
      })

      if (!userPlAccrual) {
        const calcPl = await calculateMonthlyPLAccrual(user.id, targetYear, targetMonth)

        if (calcPl.accrued > 0) {
          const accrualDate = new Date(Date.UTC(targetYear, targetMonth + 1, 1))

          await prisma.leaveBalanceAdjustment.create({
            data: {
              userId: user.id,
              leaveType: 'PL',
              amount: calcPl.accrued,
              adjustmentType: 'MONTHLY_ACCRUAL',
              reason: `Monthly PL Accrual (${calcPl.workingDays} working days: ${calcPl.totalDays}d - ${calcPl.weekendsCount}w - ${calcPl.holidaysCount}h - ${calcPl.leaveDaysCount}l)`,
              effectiveYear: targetYear,
              enteredBy: 'SYSTEM_LAZY_CRON',
              enteredByName: 'System (Lazy Trigger)',
              createdAt: accrualDate
            }
          })

          let balance = await prisma.leaveBalance.findUnique({
            where: {
              userId_year: {
                userId: user.id,
                year: targetYear
              }
            }
          })

          if (!balance) {
            balance = await prisma.leaveBalance.create({
              data: {
                userId: user.id,
                year: targetYear,
                openingPl: 0,
                openingCl: 0,
                openingComp: 0,
                pl: 0,
                cl: 0,
                sl: 0,
                comp: 0,
                plAccrued: 0,
                plUsed: 0,
                clUsed: 0,
                slUsed: 0,
                plCarryForward: 0,
                updatedAt: systemDate
              }
            })
          }

          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pl: (balance.pl || 0) + calcPl.accrued,
              plAccrued: (balance.plAccrued || 0) + calcPl.accrued,
              updatedAt: systemDate
            }
          })

          isChanged = true
        }
      }

      // Check CL accrual for this user
      const userClAccrual = await prisma.leaveBalanceAdjustment.findFirst({
        where: {
          userId: user.id,
          leaveType: 'CL',
          adjustmentType: 'MONTHLY_ACCRUAL',
          effectiveYear: targetYear,
          createdAt: {
            gte: new Date(Date.UTC(targetYear, targetMonth + 1, 1)),
            lte: new Date(Date.UTC(targetYear, targetMonth + 1, 2))
          }
        }
      })

      if (!userClAccrual) {
        const calcCl = await calculateMonthlyCLAccrual(user.id, targetYear, targetMonth)

        if (calcCl.accrued > 0) {
          const accrualDate = new Date(Date.UTC(targetYear, targetMonth + 1, 1))

          await prisma.leaveBalanceAdjustment.create({
            data: {
              userId: user.id,
              leaveType: 'CL',
              amount: calcCl.accrued,
              adjustmentType: 'MONTHLY_ACCRUAL',
              reason: `Monthly CL Accrual (Annual Entitlement: ${calcCl.annualEntitlement}d, Prorated: ${calcCl.isProrated ? 'Yes' : 'No'})`,
              effectiveYear: targetYear,
              enteredBy: 'SYSTEM_LAZY_CRON',
              enteredByName: 'System (Lazy Trigger)',
              createdAt: accrualDate
            }
          })

          let balance = await prisma.leaveBalance.findUnique({
            where: {
              userId_year: {
                userId: user.id,
                year: targetYear
              }
            }
          })

          if (!balance) {
            balance = await prisma.leaveBalance.create({
              data: {
                userId: user.id,
                year: targetYear,
                openingPl: 0,
                openingCl: 0,
                openingComp: 0,
                pl: 0,
                cl: 0,
                sl: 0,
                comp: 0,
                plAccrued: 0,
                plUsed: 0,
                clUsed: 0,
                slUsed: 0,
                plCarryForward: 0,
                updatedAt: systemDate
              }
            })
          }

          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              cl: (balance.cl || 0) + calcCl.accrued,
              updatedAt: systemDate
            }
          })

          isChanged = true
        }
      }

      if (isChanged) {
        await syncUserLedger(user.id, targetYear)
      }
    }
  } catch (error) {
    console.error('[LazyAccrual] Error running automatic accrual:', error)
  } finally {
    isRunning = false
  }
}
