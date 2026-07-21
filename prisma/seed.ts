import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { calculateMonthlyPLAccrual, calculateMonthlyCLAccrual } from '../src/lib/accrualEngine'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('Unique@123', 12)
  await prisma.leaveRequest.deleteMany()
  await prisma.leaveBalanceAdjustment.deleteMany()
  await prisma.negativeLeaveTracking.deleteMany()
  await prisma.leaveBalance.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()
  await prisma.holiday.deleteMany()
  await prisma.leaveYearClosure.deleteMany()
  await prisma.systemDateOverride.deleteMany()
  await prisma.systemConfig.deleteMany()

  const eng = await prisma.department.create({ data: { name: 'Engineering' } })
  const hr = await prisma.department.create({ data: { name: 'HR' } })
  const sales = await prisma.department.create({ data: { name: 'Sales' } })
  const finance = await prisma.department.create({ data: { name: 'Finance' } })
  const puneIt = await prisma.department.create({ data: { name: 'Pune-IT' } })
  const mumbai = await prisma.department.create({ data: { name: 'Mumbai' } })
  const demo = await prisma.department.create({ data: { name: 'Demo' } })

  await prisma.holiday.createMany({
    data: [
      { name: 'New Year', date: new Date('2026-01-01T00:00:00.000Z') },
      { name: 'Republic Day', date: new Date('2026-01-26T00:00:00.000Z') },
      { name: 'Holi', date: new Date('2026-03-14T00:00:00.000Z') },
      { name: 'Good Friday', date: new Date('2026-04-03T00:00:00.000Z') },
      { name: 'Eid al-Fitr', date: new Date('2026-03-31T00:00:00.000Z') },
      { name: 'Labor Day', date: new Date('2026-05-01T00:00:00.000Z') },
      { name: 'Independence Day', date: new Date('2026-08-15T00:00:00.000Z') },
      { name: 'Gandhi Jayanti', date: new Date('2026-10-02T00:00:00.000Z') },
      { name: 'Dussehra', date: new Date('2026-10-21T00:00:00.000Z') },
      { name: 'Diwali', date: new Date('2026-11-08T00:00:00.000Z') },
      { name: 'Christmas', date: new Date('2026-12-25T00:00:00.000Z') },
    ]
  })

  // Default system config
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'SHOW_CL_BALANCE_TO_EMPLOYEE',
        value: 'false',
        description: 'Whether employees can see their CL running balance in the Leave Ledger',
      },
      /*
      {
        key: 'CL_ENTITLEMENT_PER_YEAR',
        value: '7',
        description: 'Casual Leave entitlement per calendar year',
      },
      */
      {
        key: 'CL_ANNUAL_ENTITLEMENT',
        value: '12',
        description: 'Annual Casual/Sick Leave entitlement (minimum: 8)',
      },
      {
        key: 'PL_ACCRUAL_PER_MONTH',
        value: '1.5',
        description: 'Privilege Leave days accrued per completed month of service',
      },
      {
        key: 'MIN_WORKED_DAYS_FOR_PL',
        value: '15',
        description: 'Minimum eligible days worked in a month to earn PL accrual',
      },
      {
        key: 'INCLUDE_PAID_LEAVE_IN_ACCRUAL',
        value: 'false',
        description: 'Whether approved paid leaves (CL/PL/SL) count as worked days for PL accrual',
      },
      {
        key: 'weekend_sandwich_rule',
        value: 'true',
        description: 'Rule 29: If holidays/weekends fall between leave days, they are counted as leave (for CL)',
      },
      {
        key: 'auto_cl_pl_conversion',
        value: 'true',
        description: 'Rule 37: CL requests longer than 4 days (including weekends) are automatically converted to PL',
      }
    ]
  })

  const admin = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      email: 'adminus@yopmail.com',
      role: 'ADMIN',
      password: hashedPassword,
      departmentId: hr.id,
      joinDate: new Date('2023-01-01T00:00:00.000Z'),
      daysWorked: 800,
      communicationEmail: 'adminus@yopmail.com',
      balances: {
        create: {
          year: 2026,
          openingPl: 10, openingCl: 0, openingComp: 0,
          pl: 10, cl: 0, sl: 0, comp: 2, lop: 0,
          plAccrued: 0, plUsed: 0, clUsed: 0, slUsed: 0,
          plCarryForward: 10,
        }
      }
    }
  })

  const manager = await prisma.user.create({
    data: {
      name: 'Rahul Verma',
      email: 'manager@yopmail.com',
      role: 'MANAGER',
      password: hashedPassword,
      departmentId: eng.id,
      joinDate: new Date('2024-03-15T00:00:00.000Z'),
      daysWorked: 500,
      communicationEmail: 'manager@yopmail.com',
      balances: {
        create: {
          year: 2026,
          openingPl: 5, openingCl: 0, openingComp: 0,
          pl: 5, cl: 0, sl: 0, comp: 0, lop: 0,
          plAccrued: 0, plUsed: 0, clUsed: 0, slUsed: 0,
          plCarryForward: 5,
        }
      }
    }
  })

  const emp1 = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john@yopmail.com',
      role: 'EMPLOYEE',
      password: hashedPassword,
      departmentId: eng.id,
      joinDate: new Date('2025-06-01T00:00:00.000Z'),
      daysWorked: 250,
      communicationEmail: 'john@yopmail.com',
      balances: {
        create: {
          year: 2026,
          openingPl: 0, openingCl: 0, openingComp: 0,
          pl: 0, cl: 0, sl: 0, comp: 1, lop: 0,
          plAccrued: 0, plUsed: 0, clUsed: 0, slUsed: 0,
          plCarryForward: 0,
        }
      }
    }
  })

  const emp2 = await prisma.user.create({
    data: {
      name: 'Jane Smith',
      email: 'jane@yopmail.com',
      role: 'EMPLOYEE',
      password: hashedPassword,
      departmentId: sales.id,
      joinDate: new Date('2026-01-10T00:00:00.000Z'),
      daysWorked: 100,
      communicationEmail: 'jane@yopmail.com',
      balances: {
        create: {
          year: 2026,
          openingPl: 0, openingCl: 0, openingComp: 0,
          pl: 0, cl: 0, sl: 0, comp: 0, lop: 0,
          plAccrued: 0, plUsed: 0, clUsed: 0, slUsed: 0,
          plCarryForward: 0,
        }
      }
    }
  })

  const emp3 = await prisma.user.create({
    data: {
      name: 'Amit Kumar',
      email: 'amit@yopmail.com',
      role: 'EMPLOYEE',
      password: hashedPassword,
      departmentId: finance.id,
      joinDate: new Date('2024-09-01T00:00:00.000Z'),
      daysWorked: 400,
      status: 'NOTICE_PERIOD',
      communicationEmail: 'amit@yopmail.com',
      balances: {
        create: {
          year: 2026,
          openingPl: 8, openingCl: 0, openingComp: 0,
          pl: 8, cl: 0, sl: 0, comp: 0, lop: 2,
          plAccrued: 0, plUsed: 0, clUsed: 0, slUsed: 0,
          plCarryForward: 8,
        }
      }
    }
  })

  const emp4 = await prisma.user.create({
    data: {
      name: 'Alice Wong',
      email: 'alice.wong@yopmail.com',
      role: 'EMPLOYEE',
      password: hashedPassword,
      departmentId: sales.id,
      joinDate: new Date('2026-02-01T00:00:00.000Z'),
      daysWorked: 120,
      communicationEmail: 'alice.wong@yopmail.com',
      balances: {
        create: {
          year: 2026,
          openingPl: 0, openingCl: 0, openingComp: 0,
          pl: 0, cl: 0, sl: 0, comp: 0, lop: 0,
          plAccrued: 0, plUsed: 0, clUsed: 0, slUsed: 0,
          plCarryForward: 0,
        }
      }
    }
  })

  const emp5 = await prisma.user.create({
    data: {
      name: 'Diana Prince',
      email: 'diana.prince@yopmail.com',
      role: 'EMPLOYEE',
      password: hashedPassword,
      departmentId: eng.id,
      joinDate: new Date('2025-11-15T00:00:00.000Z'),
      daysWorked: 180,
      communicationEmail: 'diana.prince@yopmail.com',
      balances: {
        create: {
          year: 2026,
          openingPl: 0, openingCl: 0, openingComp: 0,
          pl: 0, cl: 0, sl: 0, comp: 0, lop: 0,
          plAccrued: 0, plUsed: 0, clUsed: 0, slUsed: 0,
          plCarryForward: 0,
        }
      }
    }
  })

  // Add 10-day PL leave for EVERYONE in April to verify pro-rata logic
  const allUsers = [admin, manager, emp1, emp2, emp3, emp4, emp5]
  for (const u of allUsers) {
    await prisma.leaveRequest.create({
      data: {
        userId: u.id,
        type: 'PL',
        startDate: new Date('2026-04-10T00:00:00.000Z'),
        endDate: new Date('2026-04-19T00:00:00.000Z'),
        reason: 'Verification Leave (Rule 51 Testing)',
        status: 'HR_APPROVED',
        year: 2026
      }
    })

    // Add Monthly PL & CL Accruals for ACTIVE employees only (Jan through June)
    if (u.status === 'ACTIVE' || !u.status) {
      for (let m = 0; m <= 5; m++) {
        const joinDate = new Date(u.joinDate)
        const joinYear = joinDate.getUTCFullYear()
        const joinMonth = joinDate.getUTCMonth()
        const currentYear = 2026

        const joinTimeVal = joinYear * 12 + joinMonth
        const loopTimeVal = currentYear * 12 + m

        if (loopTimeVal >= joinTimeVal) {
          // --- 1. Seed PL Accrual ---
          const calcPl = await calculateMonthlyPLAccrual(u.id, currentYear, m, prisma)
          const existingPlAccrual = await prisma.leaveBalanceAdjustment.findFirst({
            where: {
              userId: u.id,
              leaveType: 'PL',
              adjustmentType: 'MONTHLY_ACCRUAL',
              effectiveYear: currentYear,
              createdAt: new Date(Date.UTC(currentYear, m + 1, 1, 0, 0, 1))
            }
          })

          if (!existingPlAccrual && calcPl.accrued > 0) {
            await prisma.leaveBalanceAdjustment.create({
              data: {
                userId: u.id,
                leaveType: 'PL',
                amount: calcPl.accrued,
                adjustmentType: 'MONTHLY_ACCRUAL',
                reason: `Monthly PL Accrual (${calcPl.workingDays} working days: ${calcPl.totalDays}d - ${calcPl.weekendsCount}w - ${calcPl.holidaysCount}h - ${calcPl.leaveDaysCount}l)`,
                effectiveYear: currentYear,
                enteredBy: admin.id,
                enteredByName: 'System (Auto)',
                createdAt: new Date(Date.UTC(currentYear, m + 1, 1, 0, 0, 1))
              }
            })

            const bal = await prisma.leaveBalance.findUnique({
              where: { userId_year: { userId: u.id, year: currentYear } }
            })
            if (bal) {
              await prisma.leaveBalance.update({
                where: { id: bal.id },
                data: {
                  pl: (bal.pl || 0) + calcPl.accrued,
                  plAccrued: (bal.plAccrued || 0) + calcPl.accrued
                }
              })
            }
          }

          // --- 2. Seed CL Accrual ---
          const calcCl = await calculateMonthlyCLAccrual(u.id, currentYear, m, prisma)
          const existingClAccrual = await prisma.leaveBalanceAdjustment.findFirst({
            where: {
              userId: u.id,
              leaveType: 'CL',
              adjustmentType: 'MONTHLY_ACCRUAL',
              effectiveYear: currentYear,
              createdAt: new Date(Date.UTC(currentYear, m + 1, 1, 0, 0, 1))
            }
          })

          if (!existingClAccrual && calcCl.accrued > 0) {
            await prisma.leaveBalanceAdjustment.create({
              data: {
                userId: u.id,
                leaveType: 'CL',
                amount: calcCl.accrued,
                adjustmentType: 'MONTHLY_ACCRUAL',
                reason: `Monthly CL Accrual (Annual Entitlement: ${calcCl.annualEntitlement}d, Prorated: ${calcCl.isProrated ? 'Yes' : 'No'})`,
                effectiveYear: currentYear,
                enteredBy: admin.id,
                enteredByName: 'System (Auto)',
                createdAt: new Date(Date.UTC(currentYear, m + 1, 1, 0, 0, 1))
              }
            })

            const bal = await prisma.leaveBalance.findUnique({
              where: { userId_year: { userId: u.id, year: currentYear } }
            })
            if (bal) {
              await prisma.leaveBalance.update({
                where: { id: bal.id },
                data: {
                  cl: (bal.cl || 0) + calcCl.accrued
                }
              })
            }
          }
        }
      }
    }
  }

  // Negative leave tracking for Amit (Rule 44/45)
  await prisma.negativeLeaveTracking.create({
    data: {
      userId: emp3.id,
      leaveType: 'PL',
      negativeDays: -3,
      dailySalary: 2000,
      recoveryAmount: 6000,
      status: 'PENDING',
      remarks: 'Employee on notice period, PL went negative after extended illness',
    }
  })

  // Leave Requests
  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: emp1.id, type: 'PL',
        startDate: new Date('2026-06-10T00:00:00.000Z'),
        endDate: new Date('2026-06-15T00:00:00.000Z'),
        reason: 'Family Vacation', status: 'HR_APPROVED', year: 2026
      },
      {
        userId: emp2.id, type: 'SL',
        startDate: new Date('2026-05-02T00:00:00.000Z'),
        endDate: new Date('2026-05-03T00:00:00.000Z'),
        reason: 'Fever and rest', status: 'HR_APPROVED', year: 2026
      },
      {
        userId: emp3.id, type: 'PL',
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-04-15T00:00:00.000Z'),
        reason: 'Extended personal leave', status: 'HR_APPROVED',
        isNegative: true, negativeAmount: 3, year: 2026
      },
      {
        userId: manager.id, type: 'CL',
        startDate: new Date('2026-07-04T00:00:00.000Z'),
        endDate: new Date('2026-07-04T00:00:00.000Z'),
        reason: 'Personal work', status: 'L1_APPROVED', year: 2026
      },
      {
        userId: manager.id, type: 'PL',
        startDate: new Date('2026-05-15T00:00:00.000Z'),
        endDate: new Date('2026-05-20T00:00:00.000Z'),
        reason: 'Summer Trip', status: 'HR_APPROVED', year: 2026
      },
      {
        userId: emp1.id, type: 'CL',
        startDate: new Date('2026-05-10T00:00:00.000Z'),
        endDate: new Date('2026-05-10T00:00:00.000Z'),
        reason: 'Urgent Work', status: 'HR_APPROVED', year: 2026
      },
      {
        userId: emp1.id, type: 'SL',
        startDate: new Date('2026-04-12T00:00:00.000Z'),
        endDate: new Date('2026-04-13T00:00:00.000Z'),
        reason: 'Viral Fever', status: 'HR_APPROVED', year: 2026
      },
      {
        userId: emp2.id, type: 'CL',
        startDate: new Date('2026-03-05T00:00:00.000Z'),
        endDate: new Date('2026-03-06T00:00:00.000Z'),
        reason: 'Visiting home', status: 'HR_APPROVED', year: 2026
      }
    ]
  })

  // A sample manual adjustment (Rule 48)
  await prisma.leaveBalanceAdjustment.create({
    data: {
      userId: emp1.id,
      leaveType: 'PL',
      amount: 2,
      adjustmentType: 'MIGRATION',
      reason: 'Manual entry for historical PL balance at system go-live (Rule 47)',
      effectiveYear: 2026,
      enteredBy: admin.id,
      enteredByName: 'Priya Sharma',
    }
  })

  console.log('✅ Database seeded with extended data (Rules 42-50) + SystemConfig defaults + Rule 51 test data!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
