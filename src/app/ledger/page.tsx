import { getServerSession } from '@/lib/supabaseServer'
import { LedgerClient } from './LedgerClient'
import { redirect } from 'next/navigation'
import { syncUserLedger } from '@/lib/ledgerSync'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function LedgerPage() {
  const session = await getServerSession()
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  const role: string = sessionUser.role
  const userId: string = sessionUser.id
  const year = new Date().getFullYear()
  const isHR = role === 'ADMIN' || role === 'MANAGER'

  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

  let allUsers: any[] = []
  if (isHR) {
    const users = await prisma.user.findMany({
      where: {
        status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
        role: { not: 'ADMIN' }
      },
      select: {
        id: true,
        name: true,
        status: true,
        department: {
          select: { name: true }
        }
      },
      orderBy: { name: 'asc' }
    })
    allUsers = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      status: u.status,
      department: { name: u.department?.name || 'N/A' }
    }))
  }

  let targetUserId = userId
  if (isHR && allUsers.length > 0) {
    targetUserId = allUsers[0].id
  }

  // Pre-sync ledger to ensure it is dynamically calculated up-to-date
  await syncUserLedger(targetUserId, year)

  const [
    clBalanceSetting,
    profile,
    ledgerEntries
  ] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: 'SHOW_CL_BALANCE_TO_EMPLOYEE' } }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        department: true,
        balances: {
          where: { year }
        }
      }
    }),
    prisma.leaveLedgerEntry.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  ])

  if (!profile || !profile.balances[0]) {
    return <div className="p-8 text-red-600">User balance data not found. Please contact HR.</div>
  }

  const balances = profile.balances[0]
  const deptName = profile.department?.name || 'N/A'
  
  const showClBalanceToEmployee = clBalanceSetting?.value === 'true'
  const showClBalance = isHR || showClBalanceToEmployee

  const entries = (ledgerEntries || []).map((e: any) => ({
    ...e,
    id: e.id,
    date: e.date.toISOString(),
    type: e.type,
    description: e.description,
    days: e.days,
    startDate: e.startDate ? e.startDate.toISOString() : null,
    endDate: e.endDate ? e.endDate.toISOString() : null,
    clDebit: e.clDebit,
    plDebit: e.plDebit,
    clCredit: e.clCredit,
    plCredit: e.plCredit,
    clBalance: e.clBalance,
    plBalance: e.plBalance,
    isOpening: e.isOpening,
    isAdjustment: e.isAdjustment,
    isClosing: e.isClosing,
    workingDays: e.workingDays
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Ledger</h1>
        <p className="text-slate-500 text-sm mt-1">
          Accounting-style register — every CL &amp; PL transaction with running balance.
        </p>
      </div>
      <LedgerClient
        initialEntries={entries as any}
        initialUser={{
          id: profile.id,
          name: profile.name,
          status: profile.status,
          department: deptName,
          openingCl: balances?.openingCl || 0,
          openingPl: balances?.openingPl || 0,
        }}
        currentCl={balances?.cl || 0}
        currentPl={balances?.pl || 0}
        allUsers={allUsers}
        role={role}
        year={year}
        showClBalance={showClBalance}
      />
    </div>
  )
}
