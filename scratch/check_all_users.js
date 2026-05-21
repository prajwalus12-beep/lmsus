const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    include: { department: true }
  })
  
  console.log("=== All Users in DB ===")
  for (const u of users) {
    console.log(`- Id: ${u.id}`)
    console.log(`  Name: ${u.name}`)
    console.log(`  Email: ${u.email}`)
    console.log(`  Role: ${u.role}`)
    console.log(`  Status: ${u.status}`)
    console.log(`  Dept: ${u.department ? u.department.name : 'N/A'}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
