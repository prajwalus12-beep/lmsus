const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const adjs = await prisma.leaveBalanceAdjustment.findMany({
    where: { adjustmentType: 'MONTHLY_ACCRUAL' },
    select: { id: true, reason: true, createdAt: true }
  })
  console.log(JSON.stringify(adjs, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
