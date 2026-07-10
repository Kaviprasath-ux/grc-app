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
      const { engagementId, opinionRating } = body;
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      if (!engagementId) {
        return NextResponse.json(
          { error: 'Engagement ID is required' },
          { status: 400 }
        );
      }

      // Overall audit opinion. Defaults to "Satisfactory" when not supplied.
      const RATINGS = ['Satisfactory', 'Needs Improvement', 'Unsatisfactory'];
      const rating = RATINGS.includes(opinionRating) ? opinionRating : 'Satisfactory';
      // Legacy Pass/Fail kept in sync for back-compat (Satisfactory => Pass).
      const overallResult = rating === 'Satisfactory' ? 'Pass' : 'Fail';

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

      const departmentName = engagement.department?.name || 'the Department';
      const targetDate = formatDate(engagement.actualEndDate || engagement.plannedEndDate);
      const processName = engagement.process?.name || engagement.engagementTitle;

      // ── Document-driven default section templates ──────────────────────────
      // These mirror the standard Internal Audit Report structure. The Audit
      // Head can edit any of them before finalizing.

      const executiveSummary = `The audit task on ${departmentName} was carried out as per the approved audit plan. This audit has been carried out in accordance with international internal audit standards, and aims to provide independent assurance about the effectiveness of governance, risk management and control.`;

      const objectives = `The objective of the audit was to make sure:
- Assessing the adequacy and effectiveness of controls, assessing risk management, verifying compliance with regulations and policies, and identifying opportunities for improvement.`;

      const scope = `The scope of the audit included the audit of ${engagement.engagementTitle} through the use of a comprehensive work program prepared specifically for this purpose, where the scope of the audit included all areas under the umbrella of ${departmentName}. The Internal Audit Department relied in its audit on the analyses and discussions with the management officials and the available data and records provided. Using the methodology of the selected samples, the most important areas that were focused on (but not limited to):`;

      const scopeExclusions = `The scope of work did not include:`;

      const methodology = `A risk-based audit methodology was followed, including:
- Understanding and analyzing processes
- Testing the design of controls
- Testing operational effectiveness
- Using the sampling method
- Analyzing the data (if applicable)`;

      const opinionSummary = `The attached report clarifies the observations that were discovered during the audit process on ${engagement.engagementTitle}, which is generally ${rating}.`;

      const recommendations = `In light of the observations made in the report, the Internal Audit Department recommends the following:
1.
2.`;

      const topMessages = `- Substantial risks requiring immediate intervention (if any)
- The need to strengthen the control and governance environment
- Opportunities to improve operational efficiency`;

      const keyRisks = `- Operational
- Financial
- Compliance
- Reputation`;

      const summaryKeyFindings = `1.
2.`;

      const mgmtAttentionImmediate = ``;
      const mgmtAttentionMediumTerm = ``;

      const followUp = `The Audit Department will follow up on the implementation of the recommendations and report periodically to senior management and the Audit Committee.`;

      const conclusion = `Based on the audit procedures performed and the evidence obtained, Internal Audit concludes on the system of internal control over ${processName} as of the audit period. Accordingly, this audit engagement is formally closed as of ${targetDate}.`;

      // Create the report with tenant and audit head assignment
      const report = await prisma.auditReport.create({
        data: {
          reportCode,
          engagementId,
          title: engagement.engagementTitle,
          executiveSummary,
          scope,
          scopeExclusions,
          objectives,
          methodology,
          recommendations,
          opinionRating: rating,
          opinionSummary,
          topMessages,
          keyRisks,
          summaryKeyFindings,
          mgmtAttentionImmediate,
          mgmtAttentionMediumTerm,
          followUp,
          conclusion,
          overallResult,
          status: 'Draft',
          draftGeneratedAt: new Date(),
          customerAccountId,
          auditHeadId,
        },
      });

      // Fire-and-forget: translate report fields
      if (customerAccountId) void translateRecord(customerAccountId, 'AuditReport', report.id, { title: report.title, executiveSummary: report.executiveSummary, scope: report.scope, scopeExclusions: report.scopeExclusions, objectives: report.objectives, methodology: report.methodology, recommendations: report.recommendations, opinionSummary: report.opinionSummary, topMessages: report.topMessages, keyRisks: report.keyRisks, followUp: report.followUp, conclusion: report.conclusion });

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
