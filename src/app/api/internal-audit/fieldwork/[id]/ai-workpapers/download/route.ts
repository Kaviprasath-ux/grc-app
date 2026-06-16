import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/ai-workpapers/download - Download Audit Program as PDF
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Tenant-scoped engagement lookup
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: { select: { name: true } },
          assignedAuditor: { select: { firstName: true, lastName: true } },
        },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Audit program procedures (AI-generated workpapers)
      const procedures = await prisma.aiWorkpaper.findMany({
        where: { engagementId: id },
        orderBy: { createdAt: 'asc' },
      });

      const formatDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      const auditPeriod = `${formatDate(engagement.actualStartDate || engagement.plannedStartDate)} to ${formatDate(engagement.actualEndDate || engagement.plannedEndDate)}`;
      const auditorName = engagement.assignedAuditor
        ? `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`
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

      // Helper function to add text with word wrap (handles newlines + paginates)
      const addText = (
        text: string,
        fontSize: number,
        font: typeof helveticaFont,
        color = rgb(0, 0, 0),
        lineHeight = fontSize * 1.4
      ) => {
        // Preserve newlines as paragraph breaks, wrap each line by width
        const paragraphs = text.replace(/\r\n/g, '\n').split('\n');

        for (const paragraph of paragraphs) {
          const cleanText = paragraph.replace(/\s+/g, ' ').trim();

          if (!cleanText) {
            // Blank line - advance one line height
            yPosition -= lineHeight;
            continue;
          }

          const words = cleanText.split(' ');
          let line = '';
          const maxWidth = contentWidth;

          for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);

            if (testWidth > maxWidth && line) {
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
        }
      };

      // Helper function to add a sub-section (bold label + wrapped content)
      const addSection = (title: string, content: string) => {
        yPosition -= 10;

        // Check if we need a new page
        if (yPosition < 100) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }

        // Section title
        page.drawText(title, { x: margin, y: yPosition, size: 11, font: helveticaBold, color: rgb(0, 0, 0) });
        yPosition -= 18;

        // Section content
        if (content) {
          addText(content, 10, helveticaFont);
        }
      };

      // Title (centered, bold)
      const titleText = 'AUDIT PROGRAM';
      const titleFontSize = 18;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleFontSize);
      const titleX = margin + (contentWidth - titleWidth) / 2;
      page.drawText(titleText, { x: titleX, y: yPosition, size: titleFontSize, font: helveticaBold });
      yPosition -= 35;

      // Overview / metadata block
      const blackColor = rgb(0, 0, 0);
      const addMetaRow = (label: string, value: string) => {
        if (yPosition < 60) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }
        page.drawText(label, { x: margin, y: yPosition, size: 10, font: helveticaBold, color: blackColor });
        page.drawText(value, { x: margin + 130, y: yPosition, size: 10, font: helveticaFont, color: blackColor });
        yPosition -= 16;
      };

      addMetaRow('Audit ID:', engagement.auditId || '');
      addMetaRow('Audit Title:', engagement.engagementTitle || '');
      addMetaRow('Audit Type:', engagement.auditType || '');
      addMetaRow('Department:', engagement.department?.name || '');
      addMetaRow('Auditor:', auditorName);
      addMetaRow('Audit Period:', auditPeriod);
      addMetaRow('Total Procedures:', String(procedures.length));

      // Divider line after overview
      yPosition -= 5;
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      yPosition -= 20;

      // Procedures
      if (procedures.length === 0) {
        addText('No audit program procedures have been generated yet.', 10, helveticaFont, rgb(0.5, 0.5, 0.5));
      } else {
        procedures.forEach((procedure, index) => {
          // Page-break before a new procedure heading if low on space
          if (yPosition < 120) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = height - 50;
          }

          // Procedure heading (bold)
          addSection(`Procedure ${index + 1}: ${procedure.task || ''}`, '');

          // Status line
          addText(`Status: ${procedure.executed ? 'Executed' : 'Pending'}`, 10, helveticaFont, rgb(0.4, 0.4, 0.4));

          // Steps
          addSection('Steps:', procedure.steps || '-');

          // Expected Evidence
          addSection('Expected Evidence:', procedure.evidences || '-');

          // Spacing + divider between procedures
          yPosition -= 8;
          if (yPosition > 50) {
            page.drawLine({
              start: { x: margin, y: yPosition },
              end: { x: width - margin, y: yPosition },
              thickness: 0.5,
              color: rgb(0.9, 0.9, 0.9),
            });
          }
          yPosition -= 12;
        });
      }

      // Serialize PDF
      const pdfBytes = await pdfDoc.save();

      const safeAuditId = (engagement.auditId || 'engagement').replace(/\s+/g, '_');

      // Return PDF (convert Uint8Array to Buffer for NextResponse)
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeAuditId}_Audit_Program.pdf"`,
        },
      });
    } catch (error) {
      console.error('Error downloading audit program:', error);
      return NextResponse.json(
        { error: 'Unable to complete the request. Please try again.' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
