import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/internal-audit/audit-plan/download - Download Annual Audit Plan as PDF
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const filterType = searchParams.get('filterType') || 'Year';
      const year = searchParams.get('year') || new Date().getFullYear().toString();
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');

      let startDate: Date;
      let endDate: Date;
      let scopeText: string;
      let docReference: string;
      let filename: string;

      if (filterType === 'DateRange' && startDateParam && endDateParam) {
        startDate = new Date(startDateParam);
        endDate = new Date(`${endDateParam}T23:59:59.999Z`);
        const scopeYear = startDateParam.split('-')[0];
        scopeText = `Financial year ${scopeYear}`;
        docReference = `MOF-IAD-${startDateParam}-${endDateParam}`;
        filename = `Annual_Audit_Plan_${startDateParam}_to_${endDateParam}.pdf`;
      } else {
        startDate = new Date(`${year}-01-01`);
        endDate = new Date(`${year}-12-31T23:59:59.999Z`);
        scopeText = `Financial year ${year}`;
        docReference = `MOF-IAD-${year}`;
        filename = `Annual_Audit_Plan_${year}.pdf`;
      }

      const engagements = await prisma.auditEngagement.findMany({
        where: {
          OR: [
            {
              plannedStartDate: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          ],
        },
        include: {
          department: {
            select: { id: true, name: true },
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { auditId: 'asc' },
      });

      // Count risks from Risk table (main risk register) for the date range
      const riskCount = await prisma.risk.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Count findings from InternalAuditFinding for the date range
      const findingCount = await prisma.internalAuditFinding.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get Audit Head info
      // If current user is Audit Head, use their name; otherwise find the most recent Audit Head
      let auditHeadName = '';
      const currentUserRoles = session?.roles || [];
      const isCurrentUserAuditHead = currentUserRoles.includes('AuditHead');

      if (isCurrentUserAuditHead && session?.name) {
        auditHeadName = session.name;
      } else {
        // Find the most recent user with AuditHead role
        const auditHeadRole = await prisma.role.findFirst({
          where: { name: 'AuditHead' },
        });

        if (auditHeadRole) {
          const auditHeadUser = await prisma.userRole.findFirst({
            where: { roleId: auditHeadRole.id },
            include: {
              user: {
                select: { fullName: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (auditHeadUser?.user?.fullName) {
            auditHeadName = auditHeadUser.user.fullName;
          }
        }
      }

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Add first page - A4 Portrait
      let page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      let yPosition = height - 50;
      const margin = 50;
      const labelWidth = 180;

      // Helper to check and add new page if needed
      const checkNewPage = (requiredSpace: number = 100) => {
        if (yPosition < requiredSpace) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }
      };

      // Helper to draw label-value pair
      const drawLabelValue = (label: string, value: string, valueColor = rgb(0, 0, 0)) => {
        checkNewPage(30);
        page.drawText(label, {
          x: margin,
          y: yPosition,
          size: 10,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        });

        // Handle multi-line values
        const maxValueWidth = width - margin - labelWidth - margin;
        const words = value.split(' ');
        let line = '';
        let firstLine = true;

        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const testWidth = helveticaFont.widthOfTextAtSize(testLine, 10);

          if (testWidth > maxValueWidth && line) {
            page.drawText(line, {
              x: margin + labelWidth,
              y: yPosition,
              size: 10,
              font: helveticaFont,
              color: valueColor,
            });
            yPosition -= 14;
            checkNewPage(30);
            line = word;
            firstLine = false;
          } else {
            line = testLine;
          }
        }

        if (line) {
          page.drawText(line, {
            x: margin + labelWidth,
            y: yPosition,
            size: 10,
            font: helveticaFont,
            color: valueColor,
          });
        }

        yPosition -= 18;
      };

      // Helper to draw section heading
      const drawSectionHeading = (title: string) => {
        checkNewPage(50);
        yPosition -= 10;
        page.drawText(title, {
          x: margin,
          y: yPosition,
          size: 11,
          font: helveticaBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= 18;
      };

      // Helper to draw paragraph text
      const drawParagraph = (text: string, indent: number = 0) => {
        const maxWidth = width - 2 * margin - indent;
        const words = text.split(' ');
        let line = '';

        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const testWidth = helveticaFont.widthOfTextAtSize(testLine, 10);

          if (testWidth > maxWidth && line) {
            checkNewPage(20);
            page.drawText(line, {
              x: margin + indent,
              y: yPosition,
              size: 10,
              font: helveticaFont,
              color: rgb(0.2, 0.2, 0.2),
            });
            yPosition -= 14;
            line = word;
          } else {
            line = testLine;
          }
        }

        if (line) {
          checkNewPage(20);
          page.drawText(line, {
            x: margin + indent,
            y: yPosition,
            size: 10,
            font: helveticaFont,
            color: rgb(0.2, 0.2, 0.2),
          });
          yPosition -= 14;
        }
      };

      // Helper to draw bullet point
      const drawBullet = (text: string) => {
        checkNewPage(20);
        page.drawText('•', {
          x: margin + 10,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        drawParagraph(text, 25);
      };

      // Helper to draw numbered item
      const drawNumberedItem = (num: number, text: string) => {
        checkNewPage(20);
        page.drawText(`${num}.`, {
          x: margin + 10,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        drawParagraph(text, 25);
      };

      // ===== DOCUMENT METADATA =====
      drawLabelValue('Document Type :', 'Annual plan report', rgb(0.12, 0.46, 0.7));
      drawLabelValue('Document Reference :', docReference, rgb(0.12, 0.46, 0.7));
      drawLabelValue('Responsible Department :', 'Internal Audit Department');
      drawLabelValue('Document Description :', 'This document includes the objectives and scope of the engagement, the audit team, completion timeline, execution phases, and reporting procedures.');
      drawLabelValue('Purpose :', 'To use the form for documenting the planning of the internal audit engagement.');
      drawLabelValue('Scope of Application :', 'Internal Audit Department');

      // Related Policies
      checkNewPage(50);
      page.drawText('Related Policies :', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText('• Internal Audit Charter', {
        x: margin + labelWidth,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= 14;
      page.drawText('• Internal Audit Methodology', {
        x: margin + labelWidth,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= 18;

      drawLabelValue('Related Procedures :', 'None');

      // Reference Documents
      checkNewPage(50);
      page.drawText('Reference Documents :', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText('• International Standards for the Professional Practice of', {
        x: margin + labelWidth,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= 14;
      page.drawText('  Internal Auditing (IIA)', {
        x: margin + labelWidth,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= 14;
      page.drawText('• Supplementary Guidance issued by the Institute of', {
        x: margin + labelWidth,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= 14;
      page.drawText('  Internal Auditors (IIA)', {
        x: margin + labelWidth,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= 20;

      // ===== ENGAGEMENT OVERVIEW =====
      drawSectionHeading('Engagement Overview');
      drawParagraph('The independent review of the internal controls established by the department, assessing their adequacy and effectiveness against the objectives they aim to achieve, and ensuring compliance with laws, regulations, policies, and procedures related to the relevant control systems, etc');
      yPosition -= 5;
      drawBullet('Independent review of the internal control system and its adequacy and effectiveness.');
      drawBullet('Verify compliance with laws, regulations, policies, and procedures.');
      drawBullet('Review the procedures and policies implemented in the department.');
      drawBullet('Follow up on the implementation of previous internal audit recommendations.');

      // ===== AUDIT SCOPE =====
      drawSectionHeading('Audit Scope');
      drawParagraph(scopeText);

      // ===== INITIAL RISKS =====
      drawSectionHeading('Initial Risks and Observations from Preliminary Document Review');

      // Draw risk count (row 1)
      checkNewPage(40);
      page.drawText('Count of Risk:', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(riskCount.toString(), {
        x: margin + 120,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.12, 0.46, 0.7),
      });
      yPosition -= 18;

      // Draw finding count (row 2)
      page.drawText('Count of Findings:', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(findingCount.toString(), {
        x: margin + 120,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.12, 0.46, 0.7),
      });
      yPosition -= 20;

      // ===== AUDIT PROCEDURES AND TESTS =====
      drawSectionHeading('Audit Procedures and Tests');
      drawParagraph('The team shall adhere to the following:');
      yPosition -= 5;
      drawNumberedItem(1, 'Prepare and update the audit program and comply with it');
      drawNumberedItem(2, 'Use audit methods such as data analysis, document review, and sampling audit');
      drawNumberedItem(3, 'Follow up on previous audit results');

      // ===== APPROVALS =====
      drawSectionHeading('Approvals');
      drawParagraph('Job Title : Audit Head');
      drawParagraph(`Name : ${auditHeadName || '-'}`);

      // Serialize PDF
      const pdfBytes = await pdfDoc.save();

      // Return PDF
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error('Error generating annual audit plan report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: 'Failed to generate report', details: errorMessage },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);
