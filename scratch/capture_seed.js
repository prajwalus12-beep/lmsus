const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- Capturing Current System State as Seed ---')

  // 1. Clear existing seed data
  console.log('Clearing existing seed data...')
  await prisma.seedLeaveBalance.deleteMany()
  await prisma.seedUser.deleteMany()
  await prisma.seedDepartment.deleteMany()
  await prisma.seedHoliday.deleteMany()
  await prisma.seedSystemConfig.deleteMany()

  // 2. Fetch current data
  const departments = await prisma.department.findMany()
  const users = await prisma.user.findMany()
  const balances = await prisma.leaveBalance.findMany()
  const holidays = await prisma.holiday.findMany()
  const configs = await prisma.systemConfig.findMany()

  // 3. Populate Seed tables
  console.log(`Seeding ${departments.length} departments...`)
  for (const item of departments) {
    await prisma.seedDepartment.create({
      data: { id: item.id, name: item.name, createdAt: item.createdAt }
    })
  }

  console.log(`Seeding ${users.length} users...`)
  for (const item of users) {
    await prisma.seedUser.create({
      data: {
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role,
        password: item.password,
        departmentId: item.departmentId,
        joinDate: item.joinDate,
        status: item.status,
        communicationEmail: item.communicationEmail,
        createdAt: item.createdAt
      }
    })
  }

  console.log(`Seeding ${balances.length} balances...`)
  for (const item of balances) {
    await prisma.seedLeaveBalance.create({
      data: {
        id: item.id,
        userId: item.userId,
        year: item.year,
        openingPl: item.openingPl,
        openingCl: item.openingCl,
        openingComp: item.openingComp,
        pl: item.pl,
        cl: item.cl,
        sl: item.sl,
        comp: item.comp,
        plAccrued: item.plAccrued,
        plUsed: item.plUsed,
        clUsed: item.clUsed,
        slUsed: item.slUsed,
        createdAt: item.createdAt
      }
    })
  }

  console.log(`Seeding ${holidays.length} holidays...`)
  for (const item of holidays) {
    await prisma.seedHoliday.create({
      data: {
        id: item.id,
        name: item.name,
        date: item.date,
        type: item.type,
        createdAt: item.createdAt
      }
    })
  }

  console.log(`Seeding ${configs.length} configs...`)
  for (const item of configs) {
    await prisma.seedSystemConfig.create({
      data: {
        id: item.id,
        key: item.key,
        value: item.value,
        createdAt: item.createdAt
      }
    })
  }

  console.log('--- System Seed Captured Successfully ---')
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
