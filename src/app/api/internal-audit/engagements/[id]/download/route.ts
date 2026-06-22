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

// GET /api/internal-audit/engagements/[id]/download - Download engagement as PDF
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const engagement = await prisma.auditEngagement.findUnique({
        where: { id },
        include: {
          department: {
            select: { id: true, name: true },
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true },
          },
          auditee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Add page
      let page = pdfDoc.addPage([595, 842]); // A4 Portrait
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
        const cleanText = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
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
      };

      // Helper function to add a section
      const addSection = (title: string, content: string) => {
        yPosition -= 10;

        if (yPosition < 100) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }

        page.drawText(title, { x: margin, y: yPosition, size: 12, font: helveticaBold, color: rgb(0.12, 0.23, 0.37) });
        yPosition -= 20;

        if (content) {
          addText(content, 10, helveticaFont);
        } else {
          addText('-', 10, helveticaFont, rgb(0.5, 0.5, 0.5));
        }

        yPosition -= 5;
        page.drawLine({
          start: { x: margin, y: yPosition },
          end: { x: width - margin, y: yPosition },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        yPosition -= 10;
      };

      // Format date helper
      const formatDate = (date: Date | null) => {
        if (!date) return '-';
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      // Title
      const title = 'AUDIT ENGAGEMENT DETAILS';
      const titleWidth = helveticaBold.widthOfTextAtSize(title, 16);
      page.drawText(title, {
        x: (width - titleWidth) / 2,
        y: yPosition,
        size: 16,
        font: helveticaBold,
        color: rgb(0.12, 0.23, 0.37),
      });
      yPosition -= 40;

      // Metadata section
      const addMetaRow = (label: string, value: string) => {
        page.drawText(label, { x: margin, y: yPosition, size: 10, font: helveticaBold });
        page.drawText(value, { x: margin + 150, y: yPosition, size: 10, font: helveticaFont, color: rgb(0.15, 0.39, 0.93) });
        yPosition -= 18;
      };

      addMetaRow('Audit ID:', engagement.auditId);
      addMetaRow('Engagement Title:', engagement.engagementTitle);
      addMetaRow('Department:', engagement.department?.name || '-');
      addMetaRow('Audit Type:', engagement.auditType || '-');
      addMetaRow('Audit Rating:', engagement.auditRating || '-');
      addMetaRow('Status:', engagement.status);

      const auditorName = engagement.assignedAuditor
        ? `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`
        : '-';
      addMetaRow('Audit Manager:', auditorName);

      const auditeeName = engagement.auditee
        ? `${engagement.auditee.firstName} ${engagement.auditee.lastName}`
        : '-';
      addMetaRow('Auditor:', auditeeName);

      addMetaRow('Planned Start Date:', formatDate(engagement.plannedStartDate));
      addMetaRow('Planned End Date:', formatDate(engagement.plannedEndDate));
      addMetaRow('Planned Hours:', engagement.plannedHours?.toString() || '0');

      yPosition -= 10;
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      yPosition -= 10;

      // Content sections
      addSection('Engagement Objective', engagement.engagementObjective || '');
      addSection('Engagement Scope', engagement.engagementScope || '');
      addSection('Description', engagement.description || '');

      // Serialize PDF
      const pdfBytes = await pdfDoc.save();

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${engagement.auditId}_${engagement.engagementTitle.replace(/\s+/g, '_')}.pdf"`,
        },
      });
    } catch (error) {
      console.error('Error downloading engagement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: "Unable to complete the request. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);
