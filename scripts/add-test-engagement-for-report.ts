/**
 * Add a test completed engagement with a process for report generation testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTestEngagement() {
  console.log('Adding test engagement for report generation...');

  try {
    // Get the Audit Manager user (auditm)
    const auditManager = await prisma.user.findFirst({
      where: { userName: 'auditm' },
    });

    if (!auditManager) {
      console.error('Audit Manager (auditm) not found');
      return;
    }

    console.log(`Found Audit Manager: ${auditManager.firstName} ${auditManager.lastName}`);

    // Get a process to assign
    const process = await prisma.process.findFirst({
      where: {
        customerAccountId: auditManager.customerAccountId!,
      },
    });

    if (!process) {
      console.error('No process found for this customer account');
      return;
    }

    console.log(`Found Process: ${process.name}`);

    // Get a department
    const department = await prisma.department.findFirst({
      where: {
        customerAccountId: auditManager.customerAccountId!,
      },
    });

    // Generate unique audit ID
    const existingEngagements = await prisma.auditEngagement.count();
    const auditId = `AUD${(existingEngagements + 1).toString().padStart(3, '0')}`;

    // Create a completed engagement
    const engagement = await prisma.auditEngagement.create({
      data: {
        auditId,
        engagementTitle: 'Financial Controls Assessment 2024',
        engagementObjective: 'To assess the effectiveness of financial controls and ensure compliance with accounting standards.',
        engagementScope: 'Review of financial reporting processes, internal controls, and transaction accuracy for FY 2024.',
        description: 'Comprehensive assessment of financial controls across all departments.',
        departmentId: department?.id,
        processId: process.id, // Assign the process
        auditType: 'Internal',
        auditRating: 'Satisfactory',
        assignedAuditorId: auditManager.id,
        status: 'Completed', // Mark as completed so it shows in reports
        plannedStartDate: new Date('2024-01-15'),
        plannedEndDate: new Date('2024-03-31'),
        actualStartDate: new Date('2024-01-20'),
        actualEndDate: new Date('2024-03-25'),
        plannedHours: 120,
        actualHours: 115,
        customerAccountId: auditManager.customerAccountId!,
        auditHeadId: auditManager.auditHeadId,
      },
    });

    console.log(`\n✅ Created test engagement:`);
    console.log(`   - Audit ID: ${engagement.auditId}`);
    console.log(`   - Title: ${engagement.engagementTitle}`);
    console.log(`   - Process: ${process.name}`);
    console.log(`   - Status: ${engagement.status}`);
    console.log(`   - End Date: ${engagement.actualEndDate?.toLocaleDateString()}`);
    console.log(`\nYou can now generate a report for this engagement!`);

  } catch (error) {
    console.error('Error adding test engagement:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addTestEngagement()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
