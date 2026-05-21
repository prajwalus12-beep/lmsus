const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking Live Users ===')
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  })
  for (const u of users) {
    console.log(`Live - Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`)
  }

  console.log('\n=== Checking Seed Users ===')
  const seedUsers = await prisma.seedUser.findMany({
    orderBy: { name: 'asc' }
  })
  for (const u of seedUsers) {
    console.log(`Seed - Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
