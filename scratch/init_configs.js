const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const configs = [
    { key: 'ACCRUAL_RATE_PL', value: '1.5', description: 'PL accrual rate per month' },
    { key: 'ACCRUAL_BASE_DAYS', value: '20', description: 'Base working days for full PL accrual' },
    { key: 'MAX_CARRY_FORWARD_PL', value: '30', description: 'Maximum PL days that can be carried forward' },
    { key: 'MIN_WORKED_DAYS_FOR_PL', value: '15', description: 'Minimum days to work in a month to be eligible for PL' },
    { key: 'PROBATION_PERIOD_MONTHS', value: '6', description: 'Probation period in months' },
    { key: 'MAX_NEGATIVE_LEAVE', value: '-5', description: 'Maximum allowed negative leave balance' }
  ]

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    })
    console.log(`Ensured config: ${config.key}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
