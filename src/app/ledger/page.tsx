import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { LedgerClient } from './LedgerClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export default async function LedgerPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const sessionUser = session.user as any
  const role: string = sessionUser.role
  const userId: string = sessionUser.id
  const year = new Date().getFullYear()
  const isHR = role === 'ADMIN'

  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`)
  const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`)

  const allUsers = isHR
    ? await prisma.user.findMany({
        select: { id: true, name: true, department: { select: { name: true } } },
        where: {
          status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
          role: { not: 'ADMIN' },
        },
        orderBy: { name: 'asc' },
      })
    : []

  let targetUserId = userId
  if (isHR && allUsers.length > 0) {
    targetUserId = allUsers[0].id
  }

  const [clBalanceSetting, user, ledgerEntries] = await Promise.all([
    prisma.systemConfig.findUnique({
      where: { key: 'SHOW_CL_BALANCE_TO_EMPLOYEE' },
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      include: { balances: true, department: true },
    }),
    prisma.leaveLedgerEntry.findMany({
      where: { 
        userId: targetUserId, 
        date: { gte: startOfYear, lte: endOfYear } 
      },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  ])

  if (!user || !user.balances) {
    return <div className="p-8 text-red-600">User balance data not found. Please contact HR.</div>
  }

  const showClBalanceToEmployee = clBalanceSetting?.value === 'true'
  const showClBalance = isHR || showClBalanceToEmployee

  const entries = ledgerEntries.map(e => ({
    ...e,
    id: e.id,
    date: e.date.toISOString(),
    type: e.type,
    description: e.description,
    days: e.days,
    startDate: e.startDate?.toISOString() || null,
    endDate: e.endDate?.toISOString() || null,
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
          id: user.id,
          name: user.name,
          department: user.department?.name || 'N/A',
          openingCl: user.balances.openingCl,
          openingPl: user.balances.openingPl,
        }}
        currentCl={user.balances.cl}
        currentPl={user.balances.pl}
        allUsers={allUsers}
        role={role}
        year={year}
        showClBalance={showClBalance}
      />
    </div>
  )
}
