import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Download the Findings Discussion Meeting Minutes as a print-friendly PDF.
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, auditId: true, engagementTitle: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const form = await prisma.auditFindingsDiscussionMeeting.findUnique({ where: { engagementId: id } });

      const attendees: Array<Record<string, string>> = form?.attendees ? JSON.parse(form.attendees) : [];
      const notes: Array<Record<string, string>> = form?.notesDiscussed ? JSON.parse(form.notesDiscussed) : [];
      const actions: Array<Record<string, string>> = form?.agreedActions ? JSON.parse(form.agreedActions) : [];

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageW = 595;
      const pageH = 842;
      const margin = 40;
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
        y -= 14;
        ensureSpace(16);
        page.drawText(text, { x: margin, y: y - 12, size: 12, font: bold, color: rgb(0, 0, 0) });
        y -= 18;
      };

      const drawTable = (
        cols: Array<{ header: string; key: string; w: number }>,
        rows: Array<Record<string, string>>,
        minRows = 0
      ) => {
        const size = 8.5;
        const padX = 4;
        const padY = 4;
        const widths = cols.map((c) => c.w * contentW);
        const lineColor = rgb(0.6, 0.6, 0.6);
        const dataRows = rows.length >= minRows ? rows : [...rows, ...Array(minRows - rows.length).fill({})];

        const drawRow = (cells: string[], f: PDFFont, isHeader: boolean) => {
          const cellLines = cells.map((c, i) => wrap(c, size, f, widths[i] - padX * 2));
          const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
          const rowH = maxLines * (size + 2) + padY * 2;
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
              borderWidth: 0.7,
              color: isHeader ? rgb(0.95, 0.95, 0.95) : undefined,
            });
            let ly = top - padY - size;
            for (const ln of cellLines[i]) {
              page.drawText(ln, { x: x + padX, y: ly, size, font: f });
              ly -= size + 2;
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
      drawCentered("Findings Discussion Meeting Minutes", 14, bold);
      drawCentered(
        `${engagement.auditId || ""}  ${engagement.engagementTitle || ""}`.trim(),
        9,
        font,
        rgb(0.3, 0.3, 0.3)
      );
      y -= 6;

      sectionTitle("Meeting Details");
      drawTable(
        [
          { header: "Field", key: "k", w: 0.32 },
          { header: "Value", key: "v", w: 0.68 },
        ],
        [
          { k: "Management", v: form?.management || "" },
          { k: "Department", v: form?.department || "" },
          { k: "Audit Task Number", v: form?.auditTaskNumber || engagement.auditId || "" },
          { k: "Assignment Title", v: form?.assignmentTitle || engagement.engagementTitle || "" },
          { k: "History", v: form?.history || "" },
          { k: "Meeting Venue", v: form?.meetingVenue || "" },
        ]
      );

      sectionTitle("Attendees");
      drawTable(
        [
          { header: "Name", key: "name", w: 0.3 },
          { header: "Job Title", key: "jobTitle", w: 0.28 },
          { header: "Management", key: "management", w: 0.22 },
          { header: "Signature", key: "signature", w: 0.2 },
        ],
        attendees,
        4
      );

      sectionTitle("Notes Discussed");
      drawTable(
        [
          { header: "#", key: "number", w: 0.06 },
          { header: "Note", key: "note", w: 0.32 },
          { header: "Degree of Risk", key: "degreeOfRisk", w: 0.16 },
          { header: "Management Response", key: "managementResponse", w: 0.23 },
          { header: "Proposed Action", key: "proposedAction", w: 0.23 },
        ],
        notes,
        4
      );

      sectionTitle("Agreed Actions");
      drawTable(
        [
          { header: "Implementation Date", key: "implementationDate", w: 0.26 },
          { header: "Official", key: "official", w: 0.26 },
          { header: "Procedure", key: "procedure", w: 0.48 },
        ],
        actions,
        3
      );

      const bytes = await pdfDoc.save();
      const safeName = `Findings-Discussion-${engagement.auditId || id}.pdf`;
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": bytes.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error generating findings discussion PDF:", error);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);
