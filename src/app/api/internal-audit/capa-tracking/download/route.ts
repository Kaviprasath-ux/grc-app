import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/internal-audit/capa-tracking/download - Download Implementation Recommendation Document as PDF
export const GET = withAuth(
  async (req: NextRequest, context: unknown, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const departmentId = searchParams.get('departmentId');
      const status = searchParams.get('status');
      const engagementStatus = searchParams.get('engagementStatus') || 'All';
      const search = searchParams.get('search');

      // Get tenant + audit head filters (mirror the list route)
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Check if user is auditee only (has Auditee role but not AuditHead/Auditor)
      const userRoles = session.roles || [];
      const auditTeamRoles = ['AuditHead', 'Auditor', 'Auditor'];
      const isAuditTeam = userRoles.some((role: string) =>
        auditTeamRoles.some(r => r.toLowerCase() === role.toLowerCase())
      );
      const isAuditee = userRoles.some((role: string) => role.toLowerCase() === 'auditee');
      const isAuditeeOnly = isAuditee && !isAuditTeam;

      // Build where clause with tenant filter
      const where: Record<string, unknown> = { ...tenantFilter };

      // Filter findings by engagement status (default behavior matches list route)
      const engagementFilter: Record<string, unknown> = engagementStatus === 'All'
        ? {}
        : { status: engagementStatus };

      if (isAuditeeOnly && session.id) {
        where.responsiblePersonId = session.id;
        if (Object.keys(engagementFilter).length > 0) {
          where.engagement = engagementFilter;
        }
      } else if (isAuditTeam) {
        where.engagement = {
          ...auditHeadFilter,
          ...engagementFilter,
        };
      } else {
        if (Object.keys(engagementFilter).length > 0) {
          where.engagement = engagementFilter;
        }
      }

      if (departmentId) {
        where.departmentId = departmentId;
      }
      if (status) {
        where.status = status;
      }
      if (search) {
        where.OR = [
          { findingId: { contains: search, mode: 'insensitive' } },
          { finding: { contains: search, mode: 'insensitive' } },
          { responsiblePerson: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Fetch ALL matching findings (no pagination) with relations
      const findings = await prisma.internalAuditFinding.findMany({
        where,
        include: {
          engagement: { select: { engagementTitle: true } },
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formatDate = (date: Date | null) => {
        if (!date) return '-';
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      // Create PDF document using pdf-lib
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Add first page (A4)
      let page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      let yPosition = height - 50;
      const margin = 50;
      const contentWidth = width - 2 * margin;

      // Helper: add text with word wrap + page-breaking
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

      // Helper: add a labelled sub-section with word-wrapped content
      const addSection = (title: string, content: string) => {
        yPosition -= 10;

        if (yPosition < 100) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }

        page.drawText(title, { x: margin, y: yPosition, size: 11, font: helveticaBold, color: rgb(0, 0, 0) });
        yPosition -= 18;

        addText(content || '-', 10, helveticaFont);
      };

      // Title (centered, bold)
      const titleText = 'IMPLEMENTATION RECOMMENDATION DOCUMENT';
      const titleFontSize = 16;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleFontSize);
      if (titleWidth < contentWidth) {
        const titleX = margin + (contentWidth - titleWidth) / 2;
        page.drawText(titleText, { x: titleX, y: yPosition, size: titleFontSize, font: helveticaBold });
        yPosition -= 26;
      } else {
        addText(titleText, titleFontSize, helveticaBold);
        yPosition -= 8;
      }

      // Subtitle: generation date + total count (centered)
      const generationDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const subtitleText = `Generated: ${generationDate}    |    Total Findings: ${findings.length}`;
      const subtitleFontSize = 10;
      const subtitleWidth = helveticaFont.widthOfTextAtSize(subtitleText, subtitleFontSize);
      const subtitleX = subtitleWidth < contentWidth
        ? margin + (contentWidth - subtitleWidth) / 2
        : margin;
      page.drawText(subtitleText, {
        x: subtitleX,
        y: yPosition,
        size: subtitleFontSize,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 18;

      // Divider line
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 1,
        color: rgb(0.6, 0.6, 0.6),
      });
      yPosition -= 20;

      if (findings.length === 0) {
        addText('No findings match the current filters.', 11, helveticaFont, rgb(0.4, 0.4, 0.4));
      } else {
        const addMetaRow = (label: string, value: string) => {
          if (yPosition < 60) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = height - 50;
          }
          page.drawText(label, { x: margin, y: yPosition, size: 9, font: helveticaBold, color: rgb(0, 0, 0) });
          page.drawText(value, { x: margin + 130, y: yPosition, size: 9, font: helveticaFont, color: rgb(0.1, 0.1, 0.1) });
          yPosition -= 15;
        };

        for (const finding of findings) {
          // Ensure room for a block heading
          if (yPosition < 140) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = height - 50;
          }

          // Bold heading: findingId — finding
          const heading = `${finding.findingId} — ${finding.finding || ''}`;
          addText(heading, 12, helveticaBold);
          yPosition -= 4;

          // Metadata rows
          addMetaRow('Audit:', finding.engagement?.engagementTitle || '-');
          addMetaRow('Department:', finding.department?.name || '-');
          addMetaRow('Severity:', finding.severity || '-');
          addMetaRow('Responsible Person:', finding.responsiblePerson || '-');
          addMetaRow('Target Date:', formatDate(finding.targetDate));
          addMetaRow('Status:', finding.status || '-');

          // Recommendation sub-section
          addSection('Recommendation:', finding.recommendation || '-');

          // Thin divider between findings
          yPosition -= 8;
          if (yPosition < 50) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = height - 50;
          }
          page.drawLine({
            start: { x: margin, y: yPosition },
            end: { x: width - margin, y: yPosition },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.85),
          });
          yPosition -= 16;
        }
      }

      // Serialize PDF
      const pdfBytes = await pdfDoc.save();

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Implementation_Recommendation_Document.pdf"',
        },
      });
    } catch (error) {
      console.error('Error downloading Implementation Recommendation Document:', error);
      return NextResponse.json(
        { error: 'Unable to complete the request. Please try again.' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
