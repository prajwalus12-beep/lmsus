const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Starting Data Import to Supabase ---')
  
  if (!fs.existsSync('data_backup.json')) {
    console.error('Error: data_backup.json not found!')
    return
  }

  const data = JSON.parse(fs.readFileSync('data_backup.json', 'utf8'))

  // 1. Clear existing data (in reverse order of dependencies)
  console.log('Clearing existing data...')
  await prisma.leaveBalanceAdjustment.deleteMany()
  await prisma.leaveRequest.deleteMany()
  await prisma.compOffWorkEntry.deleteMany()
  await prisma.leaveBalance.deleteMany()
  await prisma.holiday.deleteMany()
  await prisma.systemConfig.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()

  // 2. Import Departments
  console.log('Importing Departments...')
  for (const item of data.departments) {
    await prisma.department.create({ data: item })
  }

  // 3. Import Users
  console.log('Importing Users...')
  for (const item of data.users) {
    await prisma.user.create({ data: item })
  }

  // 4. Import Balances
  console.log('Importing Leave Balances...')
  for (const item of data.leaveBalances) {
    await prisma.leaveBalance.create({ data: item })
  }

  // 5. Import Holidays
  console.log('Importing Holidays...')
  for (const item of data.holidays) {
    await prisma.holiday.create({ data: item })
  }

  // 6. Import System Config
  console.log('Importing System Config...')
  for (const item of data.systemConfigs) {
    await prisma.systemConfig.create({ data: item })
  }

  // 7. Import Leave Requests
  console.log('Importing Leave Requests...')
  for (const item of data.leaveRequests) {
    // Ensure dates are parsed correctly
    const requestData = {
      ...item,
      startDate: new Date(item.startDate),
      endDate: new Date(item.endDate),
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }
    await prisma.leaveRequest.create({ data: requestData })
  }

  // 8. Import Adjustments
  console.log('Importing Adjustments...')
  for (const item of data.adjustments) {
    const adjData = {
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }
    await prisma.leaveBalanceAdjustment.create({ data: adjData })
  }

  // 9. Import Comp-Off Work
  console.log('Importing Comp-Off Entries...')
  for (const item of data.compOffWork) {
    const workData = {
      ...item,
      dateWorked: new Date(item.dateWorked),
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }
    await prisma.compOffWorkEntry.create({ data: workData })
  }

  console.log('--- Import Complete! Your data is now in Supabase. ---')
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
