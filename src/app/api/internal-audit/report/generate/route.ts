import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// Helper function to generate report code
async function generateReportCode(): Promise<string> {
  const lastReport = await prisma.auditReport.findFirst({
    orderBy: { reportCode: 'desc' },
    select: { reportCode: true },
  });

  if (!lastReport) {
    return 'RPT001';
  }

  const lastNumber = parseInt(lastReport.reportCode.replace('RPT', ''), 10);
  const nextNumber = lastNumber + 1;
  return `RPT${nextNumber.toString().padStart(3, '0')}`;
}

// POST /api/internal-audit/report/generate - Generate a new audit report
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { engagementId, overallResult } = body;

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
      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId },
        include: {
          department: true,
          assignedAuditor: true,
          auditReport: true,
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
      if (engagement.auditReport) {
        return NextResponse.json(
          { error: 'Report already exists for this engagement' },
          { status: 400 }
        );
      }

      // Generate report code
      const reportCode = await generateReportCode();

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

      // Create the report
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
          overallResult,
          status: 'Draft',
          draftGeneratedAt: new Date(),
        },
      });

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
