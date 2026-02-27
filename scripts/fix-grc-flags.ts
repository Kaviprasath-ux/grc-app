/**
 * One-time fix: Set isGrcAdded=true for all CustomerAccounts
 * that have both isGrcAdded=false and isTprmAdded=false (legacy accounts).
 *
 * Usage: npx tsx scripts/fix-grc-flags.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all legacy accounts with both flags false
  const legacyAccounts = await prisma.customerAccount.findMany({
    where: {
      isGrcAdded: false,
      isTprmAdded: false,
    },
    select: { id: true, code: true, name: true },
  });

  if (legacyAccounts.length === 0) {
    console.log('No legacy accounts found — all accounts already have module flags set.');
    return;
  }

  console.log(`Found ${legacyAccounts.length} legacy account(s) with both flags false:`);
  legacyAccounts.forEach(a => console.log(`  - ${a.code}: ${a.name}`));

  // Update them to have isGrcAdded=true
  const result = await prisma.customerAccount.updateMany({
    where: {
      isGrcAdded: false,
      isTprmAdded: false,
    },
    data: { isGrcAdded: true },
  });

  console.log(`\nUpdated ${result.count} account(s) — set isGrcAdded=true.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
