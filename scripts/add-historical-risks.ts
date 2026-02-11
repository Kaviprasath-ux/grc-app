import prisma from '../src/lib/prisma';

async function addHistoricalRisks() {
  try {
    // Find Abhishek and IT Operations department
    const abhishek = await prisma.user.findFirst({
      where: { userName: 'abhishek' },
      select: { id: true, fullName: true, customerAccountId: true }
    });

    if (!abhishek) {
      console.log('Error: Abhishek user not found');
      return;
    }

    const itOps = await prisma.department.findFirst({
      where: {
        customerAccountId: abhishek.customerAccountId!,
        name: 'IT Operations'
      }
    });

    if (!itOps) {
      console.log('Error: IT Operations department not found');
      return;
    }

    console.log('Creating historical risks for testing...\n');

    const currentYear = new Date().getFullYear(); // 2026
    const lastYear = currentYear - 1; // 2025
    const twoYearsAgo = currentYear - 2; // 2024

    // 1. Closed risk from current year (2026) - SHOULD appear in Historical Risks
    const risk1 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId!,
        riskId: 'RID007',
        riskName: 'Software License Compliance Risk',
        riskDescription: 'Risk of unlicensed software usage (Closed - Current Year)',
        departmentId: itOps.id,
        status: 'Closed',
        inherentLikelihood: 3,
        inherentImpact: 4,
        inherentScore: 12,
        residualLikelihood: 1,
        residualImpact: 1,
        residualScore: 1,
        riskLevel: 'Low',
        creationDate: new Date(currentYear, 0, 15) // Jan 15, 2026
      }
    });
    console.log(`✓ Created ${risk1.riskId} - Closed - Current Year (${currentYear})`);

    // 2. Closed risk from last year (2025) - SHOULD appear in Historical Risks
    const risk2 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId!,
        riskId: 'RID008',
        riskName: 'Hardware Maintenance Risk',
        riskDescription: 'Risk of hardware failure (Closed - Last Year)',
        departmentId: itOps.id,
        status: 'Closed',
        inherentLikelihood: 2,
        inherentImpact: 3,
        inherentScore: 6,
        residualLikelihood: 1,
        residualImpact: 1,
        residualScore: 1,
        riskLevel: 'Low',
        creationDate: new Date(lastYear, 5, 10) // Jun 10, 2025
      }
    });
    console.log(`✓ Created ${risk2.riskId} - Closed - Last Year (${lastYear})`);

    // 3. Closed risk from 2 years ago (2024) - should NOT appear in Historical Risks
    const risk3 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId!,
        riskId: 'RID009',
        riskName: 'Old System Migration Risk',
        riskDescription: 'Risk of system migration issues (Closed - 2 Years Ago)',
        departmentId: itOps.id,
        status: 'Closed',
        inherentLikelihood: 4,
        inherentImpact: 5,
        inherentScore: 20,
        residualLikelihood: 1,
        residualImpact: 1,
        residualScore: 1,
        riskLevel: 'Low',
        creationDate: new Date(twoYearsAgo, 2, 20) // Mar 20, 2024
      }
    });
    console.log(`✓ Created ${risk3.riskId} - Closed - 2 Years Ago (${twoYearsAgo})`);

    console.log('\n✅ Successfully created 3 historical test risks!');
    console.log('\nExpected behavior in Historical Risks section:');
    console.log(`  ✓ SHOULD show: RID007 (${currentYear}) and RID008 (${lastYear})`);
    console.log(`  ✗ should NOT show: RID009 (${twoYearsAgo})`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addHistoricalRisks();
