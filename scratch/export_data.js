const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Starting Data Export ---')
  
  const data = {
    departments: await prisma.department.findMany(),
    users: await prisma.user.findMany(),
    leaveBalances: await prisma.leaveBalance.findMany(),
    holidays: await prisma.holiday.findMany(),
    systemConfigs: await prisma.systemConfig.findMany(),
    leaveRequests: await prisma.leaveRequest.findMany(),
    adjustments: await prisma.leaveBalanceAdjustment.findMany(),
    compOffWork: await prisma.compOffWorkEntry.findMany(),
  }

  fs.writeFileSync('data_backup.json', JSON.stringify(data, null, 2))
  console.log('--- Export Complete! Data saved to data_backup.json ---')
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
