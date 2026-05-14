/**
 * READ-ONLY audit: find userName / email duplicates across customer accounts.
 * Phase 10 makes these globally unique, so any cross-tenant collision will
 * block the schema push. Run this BEFORE prisma db push --accept-data-loss.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<direct-url-port-25060>"
 *   npx tsx scripts/prod-audit-dupes.ts
 *
 * Exits with code 2 if any duplicates found (so you can chain in CI).
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany({
    select: {
      id: true,
      userName: true,
      email: true,
      customerAccount: { select: { code: true, name: true } },
      createdAt: true,
    },
  });

  const byUsername = new Map<string, typeof users>();
  const byEmail = new Map<string, typeof users>();
  for (const u of users) {
    const un = u.userName?.toLowerCase().trim();
    const em = u.email?.toLowerCase().trim();
    if (un) {
      if (!byUsername.has(un)) byUsername.set(un, []);
      byUsername.get(un)!.push(u);
    }
    if (em) {
      if (!byEmail.has(em)) byEmail.set(em, []);
      byEmail.get(em)!.push(u);
    }
  }

  let usernameDupes = 0;
  let emailDupes = 0;

  console.log(`\nScanned ${users.length} user(s).\n`);

  console.log("=== userName duplicates ===");
  for (const [name, rows] of byUsername.entries()) {
    if (rows.length > 1) {
      usernameDupes++;
      console.log(`\n  "${name}" appears ${rows.length} times:`);
      for (const r of rows) {
        console.log(
          `    id=${r.id}  customer=${r.customerAccount?.code} (${r.customerAccount?.name})  createdAt=${r.createdAt.toISOString().slice(0, 19)}`,
        );
      }
    }
  }
  if (usernameDupes === 0) console.log("  (none)");

  console.log("\n=== email duplicates ===");
  for (const [em, rows] of byEmail.entries()) {
    if (rows.length > 1) {
      emailDupes++;
      console.log(`\n  "${em}" appears ${rows.length} times:`);
      for (const r of rows) {
        console.log(
          `    id=${r.id}  userName=${r.userName}  customer=${r.customerAccount?.code} (${r.customerAccount?.name})`,
        );
      }
    }
  }
  if (emailDupes === 0) console.log("  (none)");

  console.log(
    `\nSummary: ${usernameDupes} duplicate userName(s), ${emailDupes} duplicate email(s).`,
  );
  await p.$disconnect();
  if (usernameDupes + emailDupes > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
