import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const remediations = await prisma.tPRMIssueRemediation.findMany({
    where: { issueCode: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, customerAccountId: true },
  });

  if (remediations.length === 0) {
    console.log('No remediations to backfill.');
    return;
  }

  // Group by customer and assign codes per customer
  const byCustomer = new Map<string, string[]>();
  for (const r of remediations) {
    const list = byCustomer.get(r.customerAccountId) || [];
    list.push(r.id);
    byCustomer.set(r.customerAccountId, list);
  }

  for (const [customerAccountId, ids] of byCustomer) {
    // Find the last existing issue code for this customer
    const last = await prisma.tPRMIssueRemediation.findFirst({
      where: { customerAccountId, issueCode: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { issueCode: true },
    });
    let nextNum = 1;
    if (last?.issueCode) {
      const match = last.issueCode.match(/ISS-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }

    for (const id of ids) {
      const issueCode = `ISS-${String(nextNum).padStart(3, '0')}`;
      await prisma.tPRMIssueRemediation.update({
        where: { id },
        data: { issueCode },
      });
      console.log(`Updated ${id} -> ${issueCode}`);
      nextNum++;
    }
  }

  console.log(`Backfilled ${remediations.length} issue codes.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
