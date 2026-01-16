import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/report/[id]/download - Download report
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      // Find report by engagement ID
      const report = await prisma.auditReport.findUnique({
        where: { engagementId },
        include: {
          engagement: {
            include: {
              department: {
                select: { id: true, name: true },
              },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }

      const formatDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      const fieldworkPeriod = `${formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} to ${formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}`;
      const reportDate = formatDate(report.draftGeneratedAt);
      const auditorName = report.engagement.assignedAuditor
        ? `${report.engagement.assignedAuditor.firstName} ${report.engagement.assignedAuditor.lastName}`
        : '';

      // Generate HTML content for the report
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title} - Audit Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      text-align: center;
      font-size: 16px;
      text-transform: uppercase;
      margin-bottom: 30px;
    }
    .meta-row {
      margin-bottom: 5px;
    }
    .meta-label {
      font-weight: bold;
      display: inline-block;
      width: 150px;
    }
    .meta-value {
      color: #2563eb;
    }
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 20px 0;
    }
    h2 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    p {
      font-size: 12px;
      text-align: justify;
    }
    .section {
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>REPORT ON INTERNAL AUDIT FOR THE PERIOD FROM ${formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} TO ${formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}</h1>

  <div class="meta-row">
    <span class="meta-label">Audit Title:</span>
    <span class="meta-value">${report.title}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Report Number:</span>
    <span class="meta-value">${report.reportCode}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Report Date:</span>
    <span class="meta-value">${reportDate}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Fieldwork Period:</span>
    <span class="meta-value">${fieldworkPeriod}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Assigned Auditor:</span>
    <span>${auditorName}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Distribution:</span>
    <span class="meta-value">Audit Committee, CFO, Controller, IT Head</span>
  </div>

  <hr>

  <div class="section">
    <h2>Executive Summary</h2>
    <p>${report.executiveSummary || ''}</p>
  </div>

  <hr>

  <div class="section">
    <h2>Overall Result</h2>
    <p>${(report.observations || '').replace("{Auditor's overall audit result}", report.overallResult || 'Pass')}</p>
  </div>

  <hr>

  <div class="section">
    <h2>Background</h2>
    <p>${report.methodology || ''}</p>
  </div>

  <hr>

  <div class="section">
    <h2>Objective</h2>
    <p>${report.objectives || ''}</p>
  </div>

  <hr>

  <div class="section">
    <h2>Scope</h2>
    <p>${report.scope || ''}</p>
  </div>

  ${report.recommendations ? `
  <hr>
  <div class="section">
    <h2>Recommendations</h2>
    <p>${report.recommendations}</p>
  </div>
  ` : ''}

  ${report.conclusion ? `
  <hr>
  <div class="section">
    <h2>Conclusion</h2>
    <p>${report.conclusion}</p>
  </div>
  ` : ''}
</body>
</html>
      `;

      // Return HTML as downloadable file
      // In a production environment, you would convert this to PDF using a library
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${report.reportCode}_${report.title.replace(/\s+/g, '_')}.html"`,
        },
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      return NextResponse.json(
        { error: 'Failed to download report' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
