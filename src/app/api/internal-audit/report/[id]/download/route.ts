import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/report/[id]/download - Download report as PDF
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      // Find report by engagement ID
      const report = await prisma.auditReport.findUnique({
        where: { engagementId },
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              engagementObjective: true,
              engagementScope: true,
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              department: {
                select: { id: true, name: true },
              },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true },
              },
              auditee: {
                select: { id: true, firstName: true, lastName: true },
              },
              findings: {
                select: {
                  id: true,
                  findingId: true,
                  finding: true,
                  description: true,
                  severity: true,
                  status: true,
                },
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
      const reportDate = formatDate(report.updatedAt);
      const auditorName = report.engagement.assignedAuditor
        ? `${report.engagement.assignedAuditor.firstName} ${report.engagement.assignedAuditor.lastName}`
        : '';

      // Create PDF document using pdf-lib
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Add first page
      let page = pdfDoc.addPage([595, 842]); // A4 size
      const { width, height } = page.getSize();
      let yPosition = height - 50;
      const margin = 50;
      const contentWidth = width - 2 * margin;

      // Helper function to add text with word wrap
      const addText = (
        text: string,
        fontSize: number,
        font: typeof helveticaFont,
        color = rgb(0, 0, 0),
        lineHeight = fontSize * 1.4
      ) => {
        // Replace newlines with spaces and clean up multiple spaces
        const cleanText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const words = cleanText.split(' ');
        let line = '';
        const maxWidth = contentWidth;

        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);

          if (testWidth > maxWidth && line) {
            // Check if we need a new page
            if (yPosition < 50) {
              page = pdfDoc.addPage([595, 842]);
              yPosition = height - 50;
            }
            page.drawText(line, { x: margin, y: yPosition, size: fontSize, font, color });
            yPosition -= lineHeight;
            line = word;
          } else {
            line = testLine;
          }
        }

        if (line) {
          if (yPosition < 50) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = height - 50;
          }
          page.drawText(line, { x: margin, y: yPosition, size: fontSize, font, color });
          yPosition -= lineHeight;
        }
      };

      // Helper function to add a section
      const addSection = (title: string, content: string) => {
        yPosition -= 10;

        // Check if we need a new page
        if (yPosition < 100) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }

        // Section title
        page.drawText(title, { x: margin, y: yPosition, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
        yPosition -= 20;

        // Section content
        if (content) {
          addText(content, 10, helveticaFont);
        }

        // Draw line
        yPosition -= 5;
        if (yPosition > 50) {
          page.drawLine({
            start: { x: margin, y: yPosition },
            end: { x: width - margin, y: yPosition },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
          });
        }
        yPosition -= 10;
      };

      // Title
      const titleText = `REPORT ON INTERNAL AUDIT FOR THE PERIOD FROM ${formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} TO ${formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}`;

      // Center the title (split if too long)
      const titleFontSize = 12;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleFontSize);
      if (titleWidth < contentWidth) {
        const titleX = margin + (contentWidth - titleWidth) / 2;
        page.drawText(titleText, { x: titleX, y: yPosition, size: titleFontSize, font: helveticaBold });
      } else {
        addText(titleText, titleFontSize, helveticaBold);
      }
      yPosition -= 30;

      // Metadata
      const blueColor = rgb(0.15, 0.39, 0.93);
      const blackColor = rgb(0, 0, 0);

      const addMetaRow = (label: string, value: string, isBlue: boolean = false) => {
        page.drawText(label, { x: margin, y: yPosition, size: 10, font: helveticaBold, color: blackColor });
        page.drawText(value, { x: margin + 120, y: yPosition, size: 10, font: helveticaFont, color: isBlue ? blueColor : blackColor });
        yPosition -= 16;
      };

      // Get auditee name
      const auditeeName = report.auditeeName ||
        (report.engagement.auditee
          ? `${report.engagement.auditee.firstName} ${report.engagement.auditee.lastName}`
          : '');

      addMetaRow('Audit Title:', report.title, true);
      addMetaRow('Report Number:', report.reportCode, true);
      addMetaRow('Report Date:', reportDate, true);
      addMetaRow('Fieldwork Period:', fieldworkPeriod, true);
      addMetaRow('Assigned Auditor:', auditorName, false);
      addMetaRow('Distribution:', 'Audit Committee, CFO, Controller, IT Head', true);
      addMetaRow('Auditee:', auditeeName, true);

      // Draw line after metadata
      yPosition -= 5;
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      yPosition -= 15;

      // Content sections - use saved values or fall back to defaults
      const defaultExecutiveSummary = `This report presents the results of the internal audit conducted for ${report.title}. The audit was performed to assess the adequacy and effectiveness of internal controls, compliance with policies and procedures, and the efficiency of operations. Key findings and recommendations are detailed in the sections below.`;
      addSection('Executive Summary', report.executiveSummary || defaultExecutiveSummary);

      const defaultSummary = 'This section summarizes the key findings and conclusions from the internal audit conducted for the period indicated above. The audit was performed to evaluate the adequacy and effectiveness of the organization\'s internal controls, governance processes, and risk management practices.';
      addSection('Summary', report.managementResponse || defaultSummary);

      // Overall Result with dynamic Pass/Fail replacement
      const overallResult = report.overallResult || 'Pass';
      const defaultOverallResultText = 'Based on our audit procedures and findings, the overall audit result is {RESULT}. The controls tested during the audit period were found to be operating as designed, with appropriate documentation and oversight in place to manage identified risks effectively.';
      const overallResultTemplate = report.observations || defaultOverallResultText;
      const overallResultText = overallResultTemplate.replace(/{RESULT}/g, overallResult);
      addSection('Overall Result', overallResultText);

      const defaultBackground = 'The internal audit function is an independent and objective assurance activity designed to add value and improve the organization\'s operations. This audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing and the organization\'s internal audit charter.';
      addSection('Background', report.methodology || defaultBackground);

      // Objective and Scope - saved value or fall back to engagement data or default
      const defaultObjective = 'The objective of this audit was to evaluate the adequacy and effectiveness of internal controls, assess compliance with applicable policies and regulations, and identify opportunities for process improvements.';
      addSection('Objective', report.objectives || report.engagement.engagementObjective || defaultObjective);

      const defaultScope = 'The scope of this audit covered the review of relevant documentation, interviews with key personnel, testing of controls, and analysis of processes for the period specified in this report.';
      addSection('Scope', report.scope || report.engagement.engagementScope || defaultScope);

      const defaultRecommendations = 'Based on our audit findings, we recommend that management implement the corrective actions identified in the detailed findings section above. These recommendations are designed to strengthen internal controls and improve operational efficiency.';
      addSection('Recommendations', report.recommendations || defaultRecommendations);

      const defaultConclusion = 'In conclusion, this audit has provided valuable insights into the current state of internal controls and compliance within the audited area. We appreciate the cooperation of all personnel involved in this audit and look forward to working with management to address the identified findings.';
      addSection('Conclusion', report.conclusion || defaultConclusion);

      // Detail Findings section (static template text with dynamic Pass/Fail)
      const findings = report.engagement.findings || [];
      const detailFindingsText = `The controls tested were found to be ${overallResult}, providing adequate assurance over financial reporting and operational integrity.`;
      addSection('Detail Findings', detailFindingsText);

      yPosition -= 5;

      // Summary of Observation (part of Detail Findings)
      addText('Summary of Observation', 11, helveticaBold);
      yPosition -= 5;
      addText('The following table summarizes the observations identified during the audit, categorized by severity level.', 10, helveticaFont);
      yPosition -= 10;

      if (findings.length > 0) {
        // Table header
        const colWidths = [80, 150, 150, 70]; // Severity, Findings, Recommendations, Status
        const rowHeight = 18;

        // Draw header row
        let xPos = margin;
        const headers = ['Severity', 'Findings', 'Recommendations', 'Status'];

        // Header background
        page.drawRectangle({
          x: margin,
          y: yPosition - rowHeight + 5,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.9, 0.9, 0.9),
        });

        headers.forEach((header, i) => {
          page.drawText(header, { x: xPos + 3, y: yPosition - 10, size: 9, font: helveticaBold });
          xPos += colWidths[i];
        });
        yPosition -= rowHeight;

        // Draw data rows
        for (let i = 0; i < findings.length && i < 10; i++) { // Limit to 10 rows in table
          const finding = findings[i];
          xPos = margin;

          if (yPosition < 80) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = 842 - 50;
          }

          const rowData = [
            finding.severity,
            finding.finding.substring(0, 30) + (finding.finding.length > 30 ? '...' : ''),
            (finding.description || '-').substring(0, 30) + ((finding.description || '').length > 30 ? '...' : ''),
            finding.status
          ];

          rowData.forEach((text, j) => {
            page.drawText(text, { x: xPos + 3, y: yPosition - 10, size: 8, font: helveticaFont });
            xPos += colWidths[j];
          });
          yPosition -= rowHeight;
        }

        yPosition -= 10;
        addText(`Total Findings: ${findings.length}`, 10, helveticaBold);
      } else {
        addText('No observations recorded', 10, helveticaFont, rgb(0.5, 0.5, 0.5));
        addText('Total Findings: 0', 10, helveticaBold);
      }

      // Serialize PDF
      const pdfBytes = await pdfDoc.save();

      // Return PDF (convert Uint8Array to Buffer for NextResponse)
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${report.reportCode}_${report.title.replace(/\s+/g, '_')}.pdf"`,
        },
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: 'Failed to download report', details: errorMessage },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
