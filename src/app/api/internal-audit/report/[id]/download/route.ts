import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';
import { PDFDocument, rgb, StandardFonts, degrees, PDFPage, PDFFont } from 'pdf-lib';
import {
  FINDING_TYPES,
  RISK_LEVELS,
  PRIORITY_DEFINITIONS,
  FINDING_TYPE_DEFINITIONS,
  riskLevelOf,
  riskLevelRgb,
} from '@/lib/internal-audit/report-shared';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/report/[id]/download - Download report as PDF
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const report = await prisma.auditReport.findFirst({
        where: { engagementId, ...tenantFilter, ...auditHeadFilter },
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              auditType: true,
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              department: { select: { id: true, name: true } },
              assignedAuditor: { select: { id: true, firstName: true, lastName: true } },
              auditee: { select: { id: true, firstName: true, lastName: true } },
              findings: {
                select: {
                  id: true,
                  findingId: true,
                  finding: true,
                  description: true,
                  severity: true,
                  findingType: true,
                  criteria: true,
                  condition: true,
                  cause: true,
                  effect: true,
                  recommendation: true,
                  responsiblePerson: true,
                  targetDate: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      const formatDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const fieldworkPeriod = `${formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} to ${formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}`;
      const reportDate = formatDate(report.updatedAt);
      const auditorName = report.engagement.assignedAuditor
        ? `${report.engagement.assignedAuditor.firstName} ${report.engagement.assignedAuditor.lastName}`
        : '-';
      const auditeeName = report.auditeeName ||
        (report.engagement.auditee ? `${report.engagement.auditee.firstName} ${report.engagement.auditee.lastName}` : '-');

      // ── PDF setup ────────────────────────────────────────────────────────
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const A4: [number, number] = [595, 842];
      let page: PDFPage = pdfDoc.addPage(A4);
      const { width, height } = page.getSize();
      const margin = 50;
      const contentWidth = width - 2 * margin;
      let y = height - 50;
      const black = rgb(0, 0, 0);
      const blue = rgb(0.15, 0.39, 0.93);
      const gray = rgb(0.45, 0.45, 0.45);

      const ensure = (needed: number) => {
        if (y - needed < 50) {
          page = pdfDoc.addPage(A4);
          y = height - 50;
        }
      };

      const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
        const out: string[] = [];
        const paragraphs = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
        for (const para of paragraphs) {
          const clean = para.replace(/\s+/g, ' ').trim();
          if (!clean) { out.push(''); continue; }
          const words = clean.split(' ');
          let line = '';
          for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (f.widthOfTextAtSize(test, size) > maxW && line) {
              out.push(line);
              line = w;
            } else {
              line = test;
            }
          }
          if (line) out.push(line);
        }
        return out.length ? out : [''];
      };

      const drawText = (text: string, size = 10, f: PDFFont = font, color = black, indent = 0, lineGap = 1.4) => {
        const lh = size * lineGap;
        for (const line of wrap(text, f, size, contentWidth - indent)) {
          ensure(lh);
          if (line) page.drawText(line, { x: margin + indent, y, size, font: f, color });
          y -= lh;
        }
      };

      const heading = (title: string, size = 12) => {
        ensure(size + 16);
        y -= 8;
        page.drawText(title, { x: margin, y, size, font: bold, color: black });
        y -= size + 4;
      };

      const divider = () => {
        y -= 4;
        ensure(8);
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.82, 0.82, 0.82) });
        y -= 8;
      };

      const section = (title: string, content: string | null | undefined, fallback = '') => {
        heading(title);
        const text = (content && content.trim()) ? content : fallback;
        if (text) drawText(text, 10, font, black, 0);
        else { drawText('—', 10, font, gray); }
      };

      // Generic table: columns = [{header, width}], rows = string[][]
      const drawTable = (
        columns: { header: string; width: number }[],
        rows: string[][],
        opts?: { col0Color?: ([number, number, number] | null)[]; fontSize?: number },
      ) => {
        const fs = opts?.fontSize ?? 9;
        const padX = 4;
        const padY = 5;
        const totalW = columns.reduce((a, c) => a + c.width, 0);

        const drawRow = (cells: string[], isHeader: boolean, rowIdx: number) => {
          const cellLines = cells.map((c, i) => wrap(c, isHeader ? bold : font, fs, columns[i].width - padX * 2));
          const lines = Math.max(...cellLines.map((l) => l.length));
          const rowH = lines * (fs * 1.35) + padY * 2;
          ensure(rowH);
          const top = y;
          if (isHeader) {
            page.drawRectangle({ x: margin, y: top - rowH, width: totalW, height: rowH, color: rgb(0.92, 0.92, 0.92) });
          }
          // borders
          page.drawRectangle({ x: margin, y: top - rowH, width: totalW, height: rowH, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });
          let cx = margin;
          cellLines.forEach((linesArr, ci) => {
            let ty = top - padY - fs;
            const col0 = ci === 0 ? opts?.col0Color?.[rowIdx] : null;
            const color = isHeader ? black : (col0 ? rgb(col0[0], col0[1], col0[2]) : black);
            for (const ln of linesArr) {
              page.drawText(ln, { x: cx + padX, y: ty, size: fs, font: isHeader ? bold : font, color });
              ty -= fs * 1.35;
            }
            cx += columns[ci].width;
          });
          y = top - rowH;
        };

        drawRow(columns.map((c) => c.header), true, -1);
        rows.forEach((r, i) => drawRow(r, false, i));
        y -= 6;
      };

      // ── TITLE ────────────────────────────────────────────────────────────
      const titleText = 'INTERNAL AUDIT REPORT';
      const tW = bold.widthOfTextAtSize(titleText, 16);
      page.drawText(titleText, { x: margin + (contentWidth - tW) / 2, y, size: 16, font: bold });
      y -= 30;

      // ── METADATA ───────────────────────────────────────────────────────
      const metaRow = (label: string, value: string, isBlue = false) => {
        ensure(16);
        page.drawText(label, { x: margin, y, size: 10, font: bold, color: black });
        page.drawText(value || '-', { x: margin + 130, y, size: 10, font, color: isBlue ? blue : black });
        y -= 16;
      };
      metaRow('Audit Title:', report.title, true);
      metaRow('Report Number:', report.reportCode, true);
      metaRow('Report Date:', reportDate, true);
      metaRow('Fieldwork Period:', fieldworkPeriod, true);
      metaRow('Department:', report.engagement.department?.name || '-', true);
      metaRow('Audit Manager:', auditorName, false);
      metaRow('Distribution:', 'Audit Committee, CFO, Controller, IT Head', true);
      metaRow('Auditor:', auditeeName, true);
      divider();

      // ── NARRATIVE SECTIONS ──────────────────────────────────────────────
      section('Executive Summary', report.executiveSummary);
      section('Audit Objectives', report.objectives);
      section('Scope of Work', report.scope);
      section('Exclusion from the Scope of Work', report.scopeExclusions);
      section('Audit Methodology', report.methodology);

      // Opinion
      heading('Opinion');
      const rating = report.opinionRating || 'Satisfactory';
      page.drawText('Overall Audit Opinion: ', { x: margin, y, size: 10, font: bold });
      page.drawText(rating, { x: margin + bold.widthOfTextAtSize('Overall Audit Opinion: ', 10), y, size: 10, font: bold, color: rgb(...ratingRgb(rating)) });
      y -= 16;
      if (report.opinionSummary) drawText(report.opinionSummary, 10, font, black);

      // Observation counts
      const findings = report.engagement.findings || [];
      const total = findings.length;
      const highCount = findings.filter((f) => riskLevelOf(f.severity) === 'High').length;
      const mediumCount = findings.filter((f) => riskLevelOf(f.severity) === 'Medium').length;
      const lowCount = findings.filter((f) => riskLevelOf(f.severity) === 'Low').length;
      y -= 4;
      drawText(`Total Observations: ${total}    |    High Risk: ${highCount}    |    Medium Risk: ${mediumCount}    |    Low Risk: ${lowCount}`, 10, bold);

      section('Recommendations', report.recommendations);
      section('Top Messages for Senior Management', report.topMessages);
      section('Key Risks', report.keyRisks);
      section('Summary of Key Audit Findings', report.summaryKeyFindings);

      heading("Areas Requiring Management's Attention");
      drawText('Immediate Action:', 10, bold);
      if (report.mgmtAttentionImmediate) drawText(report.mgmtAttentionImmediate, 10, font); else drawText('—', 10, font, gray);
      y -= 2;
      drawText('Medium-Term Improvement:', 10, bold);
      if (report.mgmtAttentionMediumTerm) drawText(report.mgmtAttentionMediumTerm, 10, font); else drawText('—', 10, font, gray);

      section('Follow up', report.followUp);

      // ── DETAILED REPORT ─────────────────────────────────────────────────
      page = pdfDoc.addPage(A4);
      y = height - 50;
      const drT = 'DETAILED REPORT';
      const drW = bold.widthOfTextAtSize(drT, 15);
      page.drawText(drT, { x: margin + (contentWidth - drW) / 2, y, size: 15, font: bold });
      y -= 28;

      // Priorities table
      heading('Priorities for the Implementation of Audit Recommendations');
      drawTable(
        [{ header: 'Priority', width: 90 }, { header: 'Description', width: contentWidth - 90 }],
        PRIORITY_DEFINITIONS.map((p) => [p.label, p.description]),
        { col0Color: PRIORITY_DEFINITIONS.map((p) => priorityRgb(p.label)) },
      );

      // Finding-type definitions
      heading('Definition of Finding Types');
      drawTable(
        [{ header: 'Type', width: 170 }, { header: 'Definition', width: contentWidth - 170 }],
        FINDING_TYPE_DEFINITIONS.map((d) => [d.label, d.description]),
      );

      // Summary of Audit Findings chart
      heading('Summary of Audit Findings');
      drawFindingsChart();

      // Index of Audit Notes
      heading('Index of Audit Notes');
      if (findings.length > 0) {
        drawTable(
          [
            { header: '#', width: 32 },
            { header: 'Summary of Findings', width: contentWidth - 32 - 90 },
            { header: 'Priority', width: 90 },
          ],
          findings.map((f, i) => [String(i + 1), f.finding, riskLevelOf(f.severity)]),
          { col0Color: findings.map(() => null) },
        );
      } else {
        drawText('No observations recorded.', 10, font, gray);
      }

      // Detailed Notes
      heading('Detailed Notes');
      if (findings.length > 0) {
        findings.forEach((f, i) => {
          ensure(40);
          y -= 4;
          page.drawText(`${i + 1}. ${f.finding}`, { x: margin, y, size: 11, font: bold });
          y -= 16;
          const meta = [f.findingType ? `Type: ${f.findingType}` : null, `Risk: ${riskLevelOf(f.severity)}`, f.responsiblePerson ? `Responsible: ${f.responsiblePerson}` : null, f.targetDate ? `Target: ${formatDate(f.targetDate as unknown as Date)}` : null].filter(Boolean).join('    |    ');
          drawText(meta, 9, font, gray);
          const detailRow = (label: string, val?: string | null) => {
            if (!val) return;
            drawText(`${label}: ${val}`, 10, font, black, 8);
          };
          detailRow('Criteria', f.criteria);
          detailRow('Condition', f.condition);
          detailRow('Cause', f.cause);
          detailRow('Effect', f.effect);
          detailRow('Recommendation', f.recommendation);
          y -= 4;
          ensure(8);
          page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) });
          y -= 6;
        });
      } else {
        drawText('No observations recorded.', 10, font, gray);
      }

      // ── Draft watermark ─────────────────────────────────────────────────
      const isFinalReport = report.status === 'Final' || report.status === 'Published';
      if (!isFinalReport) {
        const wm = 'DRAFT';
        const wmSize = 130;
        const wmW = bold.widthOfTextAtSize(wm, wmSize);
        const cos45 = Math.cos(Math.PI / 4);
        for (const p of pdfDoc.getPages()) {
          const { width: pw, height: ph } = p.getSize();
          p.drawText(wm, {
            x: pw / 2 - (wmW / 2) * cos45,
            y: ph / 2 - (wmW / 2) * cos45,
            size: wmSize,
            font: bold,
            color: rgb(0.5, 0.5, 0.5),
            rotate: degrees(45),
            opacity: 0.18,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${report.reportCode}_${report.title.replace(/\s+/g, '_')}.pdf"`,
        },
      });

      // ── Local helpers that close over page/y/findings ────────────────────
      function drawFindingsChart() {
        const matrix = FINDING_TYPES.map((type) => ({
          type,
          counts: RISK_LEVELS.map((lvl) => findings.filter((f) => f.findingType === type && riskLevelOf(f.severity) === lvl).length),
        }));
        const maxCount = Math.max(1, ...matrix.flatMap((m) => m.counts));
        const chartH = 110;
        ensure(chartH + 50);
        const baseY = y - chartH;
        // axis
        page.drawLine({ start: { x: margin, y: baseY }, end: { x: width - margin, y: baseY }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

        const groups = matrix.length;
        const groupW = contentWidth / groups;
        const barW = 14;
        const gap = 4;
        const clusterW = RISK_LEVELS.length * barW + (RISK_LEVELS.length - 1) * gap;

        matrix.forEach((m, gi) => {
          const groupX = margin + gi * groupW + (groupW - clusterW) / 2;
          m.counts.forEach((count, ri) => {
            const barH = (count / maxCount) * chartH;
            const bx = groupX + ri * (barW + gap);
            const [r, g, b] = riskLevelRgb(RISK_LEVELS[ri]);
            if (barH > 0) {
              page.drawRectangle({ x: bx, y: baseY, width: barW, height: barH, color: rgb(r, g, b) });
              page.drawText(String(count), { x: bx + barW / 2 - 2, y: baseY + barH + 2, size: 7, font: bold, color: black });
            }
          });
          // group label (truncated)
          const label = m.type.length > 22 ? m.type.slice(0, 20) + '…' : m.type;
          const lw = font.widthOfTextAtSize(label, 7);
          page.drawText(label, { x: margin + gi * groupW + (groupW - lw) / 2, y: baseY - 12, size: 7, font, color: gray });
        });
        y = baseY - 24;
        // legend
        let lx = margin;
        RISK_LEVELS.forEach((lvl) => {
          const [r, g, b] = riskLevelRgb(lvl);
          page.drawRectangle({ x: lx, y: y - 2, width: 8, height: 8, color: rgb(r, g, b) });
          page.drawText(lvl, { x: lx + 12, y: y - 1, size: 8, font, color: black });
          lx += 22 + font.widthOfTextAtSize(lvl, 8) + 12;
        });
        y -= 18;
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      return NextResponse.json(
        { error: 'Unable to complete the request. Please try again.' },
        { status: 500 },
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' },
);

// RGB for opinion rating text
function ratingRgb(rating: string): [number, number, number] {
  if (rating === 'Satisfactory') return [0.06, 0.5, 0.25];
  if (rating === 'Unsatisfactory') return [0.8, 0.13, 0.13];
  return [0.85, 0.55, 0.05];
}

// RGB for a priority label (matches PRIORITY_DEFINITIONS colors)
function priorityRgb(label: string): [number, number, number] {
  switch (label) {
    case 'High': return [0.86, 0.15, 0.15];
    case 'Medium': return [0.93, 0.5, 0.1];
    case 'Low': return [0.85, 0.65, 0.05];
    default: return [0.06, 0.6, 0.3]; // Minor
  }
}
