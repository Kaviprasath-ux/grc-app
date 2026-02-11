import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Count total risks
  const totalRisks = await prisma.internalAuditRisk.count();
  console.log(`\n📊 Total Internal Audit Risks: ${totalRisks}\n`);

  // Group by department
  const risksByDepartment = await prisma.internalAuditRisk.findMany({
    include: {
      department: true,
      category: true,
      auditType: true,
    },
    orderBy: {
      riskId: 'asc',
    },
  });

  // Group and count by department
  const deptCounts: { [key: string]: number } = {};
  risksByDepartment.forEach((risk) => {
    const deptName = risk.department?.name || 'No Department';
    deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
  });

  console.log("📈 Risks by Department:");
  Object.entries(deptCounts).forEach(([dept, count]) => {
    console.log(`   ${dept}: ${count} risks`);
  });

  // Show risk levels distribution
  const riskLevels: { [key: string]: number } = {};
  risksByDepartment.forEach((risk) => {
    const level = risk.riskLevel || 'Unassessed';
    riskLevels[level] = (riskLevels[level] || 0) + 1;
  });

  console.log("\n🎯 Risk Levels Distribution:");
  Object.entries(riskLevels).forEach(([level, count]) => {
    console.log(`   ${level}: ${count} risks`);
  });

  // Show sample risks
  console.log("\n📋 Sample Risks (first 10):");
  risksByDepartment.slice(0, 10).forEach((risk) => {
    console.log(`   ${risk.riskId}: ${risk.riskName} (${risk.department?.name}) - ${risk.riskLevel}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
