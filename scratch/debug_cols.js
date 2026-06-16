const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tables = ['profiles', 'leave_balances', 'leave_requests', 'leave_ledger_entries', 'comp_off_work_entries', 'carry_forward_histories', 'leave_balance_adjustments'];
    for (const table of tables) {
      const columns = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND table_schema = 'public'`);
      console.log(`Table ${table} columns:`, columns.map(c => c.column_name));
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
