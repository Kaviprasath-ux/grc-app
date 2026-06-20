import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Download the Audit Program as a print-friendly (landscape) PDF.
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, auditId: true, engagementTitle: true, department: { select: { name: true } } },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const ap = await prisma.auditProgram.findUnique({ where: { engagementId: id } });
      const rows: Array<Record<string, string>> = ap?.rows ? JSON.parse(ap.rows) : [];

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Landscape A4
      const pageW = 842;
      const pageH = 595;
      const margin = 32;
      const contentW = pageW - margin * 2;

      let page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;

      const ensureSpace = (needed: number) => {
        if (y - needed < margin) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - margin;
        }
      };

      const wrap = (text: string, size: number, f: PDFFont, maxW: number): string[] => {
        const clean = (text || "").replace(/\s+/g, " ").trim();
        if (!clean) return [""];
        const words = clean.split(" ");
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (f.widthOfTextAtSize(test, size) > maxW && line) {
            lines.push(line);
            line = w;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        return lines;
      };

      const drawCentered = (text: string, size: number, f: PDFFont, color = rgb(0.1, 0.3, 0.6)) => {
        for (const ln of wrap(text, size, f, contentW)) {
          const w = f.widthOfTextAtSize(ln, size);
          ensureSpace(size + 6);
          page.drawText(ln, { x: margin + (contentW - w) / 2, y: y - size, size, font: f, color });
          y -= size + 6;
        }
      };

      const sectionTitle = (text: string) => {
        y -= 12;
        ensureSpace(16);
        page.drawText(text, { x: margin, y: y - 11, size: 11, font: bold, color: rgb(0.1, 0.3, 0.6) });
        y -= 16;
      };

      const paragraph = (text: string) => {
        for (const ln of wrap(text, 9, font, contentW)) {
          ensureSpace(12);
          page.drawText(ln, { x: margin, y: y - 9, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
          y -= 12;
        }
      };

      const drawTable = (
        cols: Array<{ header: string; key: string; w: number }>,
        data: Array<Record<string, string>>,
        minRows = 0,
        size = 6.5
      ) => {
        const padX = 2.5;
        const padY = 3;
        const widths = cols.map((c) => c.w * contentW);
        const lineColor = rgb(0.6, 0.6, 0.6);
        const dataRows = data.length >= minRows ? data : [...data, ...Array(minRows - data.length).fill({})];

        const drawRow = (cells: string[], f: PDFFont, isHeader: boolean) => {
          const cellLines = cells.map((c, i) => wrap(c, size, f, widths[i] - padX * 2));
          const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
          const rowH = maxLines * (size + 1.5) + padY * 2;
          ensureSpace(rowH);
          const top = y;
          let x = margin;
          for (let i = 0; i < cols.length; i++) {
            page.drawRectangle({
              x,
              y: top - rowH,
              width: widths[i],
              height: rowH,
              borderColor: lineColor,
              borderWidth: 0.6,
              color: isHeader ? rgb(0.93, 0.93, 0.93) : undefined,
            });
            let ly = top - padY - size;
            for (const ln of cellLines[i]) {
              page.drawText(ln, { x: x + padX, y: ly, size, font: f });
              ly -= size + 1.5;
            }
            x += widths[i];
          }
          y = top - rowH;
        };

        drawRow(cols.map((c) => c.header), bold, true);
        for (const r of dataRows) {
          drawRow(cols.map((c) => (r[c.key] ?? "").toString()), font, false);
        }
      };

      // ----- Document -----
      drawCentered("Audit Program", 14, bold);
      drawCentered(
        `${engagement.auditId || ""}  ${engagement.engagementTitle || ""}`.trim(),
        9,
        font,
        rgb(0.3, 0.3, 0.3)
      );
      y -= 4;

      // A. Overview
      sectionTitle("A. Audit Program Overview");
      drawTable(
        [
          { header: "Audit Title", key: "auditTitle", w: 0.34 },
          { header: "Department", key: "department", w: 0.33 },
          { header: "Period", key: "period", w: 0.33 },
        ],
        [
          {
            auditTitle: ap?.auditTitle || engagement.engagementTitle || "",
            department: ap?.department || engagement.department?.name || "",
            period: ap?.period || "",
          },
        ],
        0,
        9
      );

      // B. Instructions
      sectionTitle("B. Instructions");
      paragraph(ap?.instructions || "");

      // C. Detailed Audit Program
      sectionTitle("C. Detailed Audit Program");
      drawTable(
        [
          { header: "Objective", key: "objective", w: 0.08 },
          { header: "Process / Sub-process", key: "processSubprocess", w: 0.08 },
          { header: "Risk", key: "risk", w: 0.08 },
          { header: "Control", key: "control", w: 0.08 },
          { header: "Control Type", key: "controlType", w: 0.06 },
          { header: "Test Type", key: "testType", w: 0.06 },
          { header: "Audit Procedure", key: "auditProcedure", w: 0.1 },
          { header: "Sampling Method", key: "samplingMethod", w: 0.07 },
          { header: "Sample Size", key: "sampleSize", w: 0.05 },
          { header: "Evidence Required", key: "evidenceRequired", w: 0.08 },
          { header: "Result", key: "result", w: 0.06 },
          { header: "Conclusion", key: "conclusion", w: 0.06 },
          { header: "Exception", key: "exception", w: 0.06 },
          { header: "WP Ref", key: "workingPaperRef", w: 0.05 },
        ],
        rows,
        4
      );

      // D. Review & Approval
      sectionTitle("D. Review & Approval");
      drawTable(
        [
          { header: "Prepared by", key: "preparedBy", w: 0.17 },
          { header: "Date", key: "preparedDate", w: 0.16 },
          { header: "Reviewed by", key: "reviewedBy", w: 0.17 },
          { header: "Date", key: "reviewedDate", w: 0.16 },
          { header: "Approved by", key: "approvedBy", w: 0.17 },
          { header: "Date", key: "approvedDate", w: 0.17 },
        ],
        [
          {
            preparedBy: ap?.preparedBy || "",
            preparedDate: ap?.preparedDate || "",
            reviewedBy: ap?.reviewedBy || "",
            reviewedDate: ap?.reviewedDate || "",
            approvedBy: ap?.approvedBy || "",
            approvedDate: ap?.approvedDate || "",
          },
        ],
        0,
        8
      );

      const bytes = await pdfDoc.save();
      const safeName = `Audit-Program-${engagement.auditId || id}.pdf`;
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": bytes.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error generating audit program PDF:", error);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);
