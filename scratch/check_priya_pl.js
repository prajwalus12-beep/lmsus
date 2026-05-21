const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const priya = await prisma.user.findFirst({
    where: { name: { contains: 'Priya' } },
    include: { balances: true, requests: true }
  })
  
  if (!priya) {
    console.log("Priya Sharma not found.")
    return
  }
  
  console.log(`User: ${priya.name} (id: ${priya.id}), Email: ${priya.email}`)
  console.log("Balances:", priya.balances)
  console.log("Leave Requests:")
  for (const r of priya.requests) {
    console.log(`- Request id: ${r.id}, Type: ${r.type}, Start: ${r.startDate.toISOString().split('T')[0]}, End: ${r.endDate.toISOString().split('T')[0]}, Status: ${r.status}, Days: ${r.days || 'N/A'}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
