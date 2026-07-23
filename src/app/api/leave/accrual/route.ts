import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { calculateMonthlyPLAccrual, calculateMonthlyCLAccrual } from '@/lib/accrualEngine'
import { syncUserLedger } from '@/lib/ledgerSync'
import { getSystemDate } from '@/lib/systemDate'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`

  let sessionUser: any = null
  if (!isCronAuthorized) {
    const session = await getServerSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    sessionUser = session.user as any
    if (sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })
    }
  }

  let month: number | undefined
  let year: number | undefined
  try {
    const body = await req.json()
    month = body.month
    year = body.year
  } catch (e) {
    // No body or invalid JSON
  }

  const systemDate = await getSystemDate()
  if (month === undefined || year === undefined) {
    const prevDate = new Date(systemDate)
    prevDate.setMonth(prevDate.getMonth() - 1)
    month = prevDate.getMonth()
    year = prevDate.getFullYear()
  }

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' }
  })

  const results: { user: string; monthsAccrued: string[]; totalAccrued: number }[] = []

  for (const user of users) {
    // Determine the starting point for this user's accruals based on joining date
    let startYear: number
    let startMonth: number

    if (user.joinDate) {
      const joinDate = new Date(user.joinDate)
      const joinYear = joinDate.getFullYear()
      const joinMonth = joinDate.getMonth()

      if (joinYear < year) {
        startYear = year
        startMonth = 0 // January of target year
      } else if (joinYear === year) {
        startYear = year
        startMonth = joinMonth // Joining month
      } else {
        // Joined after target year
        continue
      }
    } else {
      startYear = year
      startMonth = 0
    }

    const targetTimeVal = year * 12 + month
    let loopYear = startYear
    let loopMonth = startMonth
    let loopTimeVal = loopYear * 12 + loopMonth

    const monthsAccrued: string[] = []
    let totalAccrued = 0
    const changedYears = new Set<number>()

    while (loopTimeVal <= targetTimeVal) {
      let isChanged = false
      const monthLabel = new Date(loopYear, loopMonth).toLocaleString('default', { month: 'short', year: 'numeric' })
      const accrualDate = new Date(Date.UTC(loopYear, loopMonth + 1, 1))

      // Check and calculate PL
      const existingPl = await prisma.leaveBalanceAdjustment.findFirst({
        where: {
          userId: user.id,
          leaveType: 'PL',
          adjustmentType: 'MONTHLY_ACCRUAL',
          effectiveYear: loopYear,
          createdAt: {
            gte: new Date(Date.UTC(loopYear, loopMonth + 1, 1)),
            lte: new Date(Date.UTC(loopYear, loopMonth + 1, 2))
          }
        }
      })

      if (!existingPl) {
        const calcPl = await calculateMonthlyPLAccrual(user.id, loopYear, loopMonth)
        if (calcPl.accrued > 0) {
          await prisma.leaveBalanceAdjustment.create({
            data: {
              userId: user.id,
              leaveType: 'PL',
              amount: calcPl.accrued,
              adjustmentType: 'MONTHLY_ACCRUAL',
              reason: `Monthly PL Accrual (${calcPl.workingDays} working days: ${calcPl.totalDays}d - ${calcPl.weekendsCount}w - ${calcPl.holidaysCount}h - ${calcPl.leaveDaysCount}l)`,
              effectiveYear: loopYear,
              enteredBy: sessionUser?.id || 'SYSTEM_CRON',
              enteredByName: 'System (Auto)',
              createdAt: accrualDate
            }
          })

          let balance = await prisma.leaveBalance.findUnique({
            where: { userId_year: { userId: user.id, year: loopYear } }
          })

          if (!balance) {
            balance = await prisma.leaveBalance.create({
              data: {
                userId: user.id,
                year: loopYear,
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
          totalAccrued += calcPl.accrued
        }
      }

      // Check and calculate CL
      const existingCl = await prisma.leaveBalanceAdjustment.findFirst({
        where: {
          userId: user.id,
          leaveType: 'CL',
          adjustmentType: 'MONTHLY_ACCRUAL',
          effectiveYear: loopYear,
          createdAt: {
            gte: new Date(Date.UTC(loopYear, loopMonth + 1, 1)),
            lte: new Date(Date.UTC(loopYear, loopMonth + 1, 2))
          }
        }
      })

      if (!existingCl) {
        const calcCl = await calculateMonthlyCLAccrual(user.id, loopYear, loopMonth)
        if (calcCl.accrued > 0) {
          await prisma.leaveBalanceAdjustment.create({
            data: {
              userId: user.id,
              leaveType: 'CL',
              amount: calcCl.accrued,
              adjustmentType: 'MONTHLY_ACCRUAL',
              reason: `Monthly CL Accrual (Annual Entitlement: ${calcCl.annualEntitlement}d, Prorated: ${calcCl.isProrated ? 'Yes' : 'No'})`,
              effectiveYear: loopYear,
              enteredBy: sessionUser?.id || 'SYSTEM_CRON',
              enteredByName: 'System (Auto)',
              createdAt: accrualDate
            }
          })

          let balance = await prisma.leaveBalance.findUnique({
            where: { userId_year: { userId: user.id, year: loopYear } }
          })

          if (!balance) {
            balance = await prisma.leaveBalance.create({
              data: {
                userId: user.id,
                year: loopYear,
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
          totalAccrued += calcCl.accrued
        }
      }

      if (isChanged) {
        changedYears.add(loopYear)
        monthsAccrued.push(monthLabel)
      }

      // Advance one month
      loopMonth++
      if (loopMonth > 11) {
        loopMonth = 0
        loopYear++
      }
      loopTimeVal = loopYear * 12 + loopMonth
    }

    // Sync user ledger only once per modified year after the whole loop has processed
    for (const y of changedYears) {
      await syncUserLedger(user.id, y)
    }

    if (totalAccrued > 0) {
      results.push({
        user: user.name,
        monthsAccrued,
        totalAccrued: parseFloat(totalAccrued.toFixed(2))
      })
    }
  }

  return NextResponse.json({ success: true, results })
}
