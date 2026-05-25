const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const john = await prisma.user.findFirst({
    where: { name: { contains: 'John' } },
    include: { balances: true, requests: true, ledgerEntries: true }
  })
  
  if (!john) {
    console.log("John Doe not found.")
    return
  }
  
  console.log(`User: ${john.name} (id: ${john.id}), Email: ${john.email}`)
  console.log("Balances:", john.balances)
  console.log("\nLeave Requests:")
  for (const r of john.requests) {
    console.log(`- Request id: ${r.id}, Type: ${r.type}, Start: ${r.startDate.toISOString()}, End: ${r.endDate.toISOString()}, Status: ${r.status}`)
  }

  console.log("\nLedger Entries:")
  for (const e of john.ledgerEntries) {
    console.log(`- Entry id: ${e.id}, Date: ${e.date.toISOString().split('T')[0]}, Type: ${e.type}, Desc: ${e.description}, Days: ${e.days}, CL Debit: ${e.clDebit}, PL Debit: ${e.plDebit}, CL Bal: ${e.clBalance}, PL Bal: ${e.plBalance}, isOpening: ${e.isOpening}, isClosing: ${e.isClosing}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
