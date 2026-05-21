const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Updating User Emails in Database ===')

  // 1. Update Rahul Verma (Manager)
  const managerUpdate = await prisma.user.updateMany({
    where: {
      name: 'Rahul Verma',
      email: 'jane.manager@company.com'
    },
    data: {
      email: 'manager@company.com'
    }
  })
  console.log(`Rahul Verma updated: ${managerUpdate.count} row(s)`)

  // 2. Update John Doe (Employee)
  const employeeUpdate = await prisma.user.updateMany({
    where: {
      name: 'John Doe',
      email: 'john.doe@company.com'
    },
    data: {
      email: 'john@company.com'
    }
  })
  console.log(`John Doe updated: ${employeeUpdate.count} row(s)`)

  // 3. Print current users to verify
  console.log('\n=== Verification ===')
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  })
  for (const u of users) {
    console.log(`Live User - Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
