import prisma from '../src/lib/prisma';

async function addTestRisks() {
  try {
    // Find Abhishek (AuditHead)
    const abhishek = await prisma.user.findFirst({
      where: { userName: 'abhishek' },
      select: { id: true, fullName: true, customerAccountId: true }
    });

    if (!abhishek) {
      console.log('Error: Abhishek user not found');
      return;
    }

    console.log('Found Abhishek (AuditHead):', abhishek.fullName);
    console.log('Customer Account ID:', abhishek.customerAccountId);

    // Get departments
    const departments = await prisma.department.findMany({
      where: { customerAccountId: abhishek.customerAccountId },
      select: { id: true, name: true }
    });

    console.log('\nFound departments:', departments.map(d => d.name).join(', '));

    const itOps = departments.find(d => d.name === 'IT Operations');
    const compliance = departments.find(d => d.name === 'Compliance');
    const humanResources = departments.find(d => d.name === 'Human Resources');

    if (!itOps || !compliance || !humanResources) {
      console.log('Error: Required departments not found');
      return;
    }

    console.log('\nCreating test risks...\n');

    // Create risks for IT Operations (2 Open, 1 Closed)
    const risk1 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId,
        riskId: 'RID001',
        riskName: 'Server Downtime Risk',
        riskDescription: 'Risk of server downtime affecting business operations',
        departmentId: itOps.id,
        status: 'Open',
        inherentLikelihood: 4,
        inherentImpact: 5,
        inherentScore: 20,
        residualLikelihood: 2,
        residualImpact: 3,
        residualScore: 6,
        riskLevel: 'Low',
        creationDate: new Date()
      }
    });

    const risk2 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId,
        riskId: 'RID002',
        riskName: 'Data Breach Risk',
        riskDescription: 'Risk of unauthorized access to sensitive data',
        departmentId: itOps.id,
        status: 'Open',
        inherentLikelihood: 5,
        inherentImpact: 5,
        inherentScore: 25,
        residualLikelihood: 2,
        residualImpact: 4,
        residualScore: 8,
        riskLevel: 'Low',
        creationDate: new Date()
      }
    });

    const risk3 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId,
        riskId: 'RID003',
        riskName: 'Network Security Risk',
        riskDescription: 'Risk of network vulnerabilities',
        departmentId: itOps.id,
        status: 'Closed',
        inherentLikelihood: 3,
        inherentImpact: 4,
        inherentScore: 12,
        residualLikelihood: 1,
        residualImpact: 2,
        residualScore: 2,
        riskLevel: 'Low',
        creationDate: new Date()
      }
    });

    console.log('✓ Created', risk1.riskId, '- IT Operations (Open)');
    console.log('✓ Created', risk2.riskId, '- IT Operations (Open)');
    console.log('✓ Created', risk3.riskId, '- IT Operations (Closed)');

    // Create risks for Compliance (2 Open)
    const risk4 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId,
        riskId: 'RID004',
        riskName: 'Regulatory Compliance Risk',
        riskDescription: 'Risk of non-compliance with regulatory requirements',
        departmentId: compliance.id,
        status: 'Open',
        inherentLikelihood: 3,
        inherentImpact: 5,
        inherentScore: 15,
        residualLikelihood: 2,
        residualImpact: 3,
        residualScore: 6,
        riskLevel: 'Low',
        creationDate: new Date()
      }
    });

    const risk5 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId,
        riskId: 'RID005',
        riskName: 'Audit Findings Risk',
        riskDescription: 'Risk of unresolved audit findings',
        departmentId: compliance.id,
        status: 'Open',
        inherentLikelihood: 2,
        inherentImpact: 4,
        inherentScore: 8,
        residualLikelihood: 1,
        residualImpact: 2,
        residualScore: 2,
        riskLevel: 'Low',
        creationDate: new Date()
      }
    });

    console.log('✓ Created', risk4.riskId, '- Compliance (Open)');
    console.log('✓ Created', risk5.riskId, '- Compliance (Open)');

    // Create risk for Human Resources (1 Open)
    const risk6 = await prisma.internalAuditRisk.create({
      data: {
        customerAccountId: abhishek.customerAccountId,
        riskId: 'RID006',
        riskName: 'Employee Turnover Risk',
        riskDescription: 'Risk of high employee turnover affecting operations',
        departmentId: humanResources.id,
        status: 'Open',
        inherentLikelihood: 3,
        inherentImpact: 3,
        inherentScore: 9,
        residualLikelihood: 2,
        residualImpact: 2,
        residualScore: 4,
        riskLevel: 'Low',
        creationDate: new Date()
      }
    });

    console.log('✓ Created', risk6.riskId, '- Human Resources (Open)');

    console.log('\n✅ Successfully created 6 test risks!');
    console.log('\nSummary:');
    console.log('  - IT Operations: 2 Open, 1 Closed');
    console.log('  - Compliance: 2 Open');
    console.log('  - Human Resources: 1 Open');
    console.log('\nTotal Open risks: 5');
    console.log('Total Closed risks: 1');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestRisks();
