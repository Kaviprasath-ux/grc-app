/**
 * Fix existing AuditReports by setting auditHeadId from their engagement
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixReportAuditHeadIds() {
  console.log('Fixing AuditReport auditHeadId fields...');

  try {
    // Get all reports with their engagements
    const reports = await prisma.auditReport.findMany({
      include: {
        engagement: {
          select: {
            id: true,
            auditHeadId: true,
          },
        },
      },
    });

    console.log(`Found ${reports.length} reports to check`);

    let updatedCount = 0;

    for (const report of reports) {
      // If report has no auditHeadId but engagement does, update it
      if (!report.auditHeadId && report.engagement.auditHeadId) {
        await prisma.auditReport.update({
          where: { id: report.id },
          data: { auditHeadId: report.engagement.auditHeadId },
        });
        console.log(`Updated report ${report.reportCode} with auditHeadId: ${report.engagement.auditHeadId}`);
        updatedCount++;
      }
    }

    console.log(`\n✅ Fixed ${updatedCount} reports`);
  } catch (error) {
    console.error('Error fixing reports:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixReportAuditHeadIds()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
