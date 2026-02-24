import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getTenantFilter, getAuditHeadId } from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';

// Helper function to generate report code (format: RPT-NNNN - unique serial, tenant-scoped)
async function generateReportCode(customerAccountId: string): Promise<string> {
  const reports = await prisma.auditReport.findMany({
    where: { customerAccountId },
    select: { reportCode: true },
  });

  let maxNumber = 0;
  for (const report of reports) {
    // Extract trailing number from any format: RPT-0001, RPT-2025-001, RPT001
    const match = report.reportCode.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }

  return `RPT-${(maxNumber + 1).toString().padStart(4, '0')}`;
}

// POST /api/internal-audit/report/generate - Generate a new audit report
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { engagementId, overallResult } = body;
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      if (!engagementId) {
        return NextResponse.json(
          { error: 'Engagement ID is required' },
          { status: 400 }
        );
      }

      if (!overallResult || !['Pass', 'Fail'].includes(overallResult)) {
        return NextResponse.json(
          { error: 'Overall result must be Pass or Fail' },
          { status: 400 }
        );
      }

      // Check if engagement exists and is completed
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id: engagementId, ...tenantFilter },
        include: {
          department: true,
          assignedAuditor: true,
          report: true,
          process: {
            select: {
              id: true,
              name: true,
            },
          },
          findings: {
            select: {
              id: true,
              findingId: true,
              finding: true,
              severity: true,
              status: true,
            },
          },
        },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      if (engagement.status !== 'Completed') {
        return NextResponse.json(
          { error: 'Only completed engagements can have reports generated' },
          { status: 400 }
        );
      }

      // Check if report already exists
      if (engagement.report) {
        return NextResponse.json(
          { error: 'Report already exists for this engagement' },
          { status: 400 }
        );
      }

      // Generate report code - scoped to tenant
      const reportCode = await generateReportCode(customerAccountId);

      // Format dates for report
      const formatDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      const fieldworkPeriod = `${formatDate(engagement.actualStartDate || engagement.plannedStartDate)} to ${formatDate(engagement.actualEndDate || engagement.plannedEndDate)}`;

      // Generate executive summary
      const executiveSummary = `Internal Audit has completed the audit of ${engagement.engagementTitle}. The primary objective of this engagement was to assess the design and operating effectiveness of key internal controls over significant financial processes, including process, as well as IT general control areas supporting these functions.

The audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing (ISPPIA). Our procedures included review of process documentation, walkthroughs, testing of key controls, and verification of transaction accuracy and authorization during the period under review.`;

      // Generate overall result text
      const overallResultText = `Based on the work performed, the key financial and IT controls appear to be ${overallResult}. ${
        overallResult === 'Pass'
          ? 'No significant control deficiencies or reportable findings were identified during this engagement.'
          : 'Control deficiencies and reportable findings were identified during this engagement that require management attention.'
      }

We extend our appreciation to management and staff for their cooperation and support throughout the audit.`;

      // Generate background
      const background = `The integrity and reliability of financial and operational data are essential for informed decision-making. Robust internal controls over accounting cycles—such as revenue, expenditure, and treasury management—help mitigate risks of fraud, misstatement, and process inefficiencies.

This audit was part of the Annual Internal Audit Plan for FY. Designed to provide independent assurance over key financial processes and IT control environments.`;

      // Generate objective
      const objectives = `To evaluate the effectiveness of the ${engagement.engagementTitle.toLowerCase()} within the organization.`;

      // Generate scope
      const scope = `This audit will cover the organizational structure, roles and responsibilities, decision-making processes, and compliance with relevant policies and regulations.`;

      // Generate conclusion with placeholders for Audit process and target date
      const targetDate = formatDate(engagement.actualEndDate || engagement.plannedEndDate);
      const processName = engagement.process?.name || engagement.engagementTitle;
      const conclusion = `Based on the audit procedures performed and the evidence obtained, Internal Audit concludes that the system of internal control over ${processName} as of the audit period.

The control environment supports the integrity, accuracy, and reliability of the organization's financial data within the audited areas.

Accordingly, this audit engagement is formally closed as of ${targetDate}.`;

      // Create the report with tenant and audit head assignment
      const report = await prisma.auditReport.create({
        data: {
          reportCode,
          engagementId,
          title: engagement.engagementTitle,
          executiveSummary,
          observations: overallResultText,
          scope,
          objectives,
          methodology: background,
          conclusion,
          overallResult,
          status: 'Draft',
          draftGeneratedAt: new Date(),
          customerAccountId,
          auditHeadId,
        },
      });

      // Fire-and-forget: translate report fields
      if (customerAccountId) void translateRecord(customerAccountId, 'AuditReport', report.id, { title: report.title, executiveSummary: report.executiveSummary, observations: report.observations, scope: report.scope, objectives: report.objectives, methodology: report.methodology, conclusion: report.conclusion });

      return NextResponse.json({
        report,
        message: 'Report generated successfully',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);
