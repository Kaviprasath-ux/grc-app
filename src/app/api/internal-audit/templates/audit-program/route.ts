import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Audit Program working-paper columns (wide grid).
const COLUMNS: Array<{ header: string; weight: number }> = [
  { header: "Objective", weight: 1.2 },
  { header: "Process / Sub-process", weight: 1.2 },
  { header: "Risk", weight: 1.0 },
  { header: "Control", weight: 1.0 },
  { header: "Control Type", weight: 0.9 },
  { header: "Key Control", weight: 0.8 },
  { header: "Test Type", weight: 0.9 },
  { header: "Audit Procedure", weight: 1.4 },
  { header: "Sampling Method", weight: 1.0 },
  { header: "Sample Size", weight: 0.8 },
  { header: "Evidence Required", weight: 1.1 },
  { header: "Result", weight: 0.8 },
  { header: "Conclusion", weight: 1.0 },
  { header: "Exception", weight: 1.0 },
  { header: "Working Paper", weight: 1.0 },
];

// GET - Download a blank Audit Program template PDF (to fill offline and re-upload).
export const GET = withAuth(
  async (_req: NextRequest) => {
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // A3 landscape to fit the wide grid.
      const pageW = 1190.55;
      const pageH = 841.89;
      const margin = 28;
      const contentW = pageW - margin * 2;

      let page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;

      const newPage = () => {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - margin;
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

      // Title
      const title = "Audit Program";
      const tSize = 16;
      page.drawText(title, {
        x: margin + (contentW - bold.widthOfTextAtSize(title, tSize)) / 2,
        y: y - tSize,
        size: tSize,
        font: bold,
        color: rgb(0.1, 0.3, 0.6),
      });
      y -= tSize + 14;

      const totalWeight = COLUMNS.reduce((s, c) => s + c.weight, 0);
      const widths = COLUMNS.map((c) => (c.weight / totalWeight) * contentW);
      const lineColor = rgb(0.5, 0.5, 0.5);
      const size = 7;
      const padX = 3;

      const drawRow = (cells: string[], f: PDFFont, isHeader: boolean, rowH: number) => {
        if (y - rowH < margin) {
          newPage();
          if (!isHeader) drawHeader();
        }
        const top = y;
        let x = margin;
        for (let i = 0; i < COLUMNS.length; i++) {
          page.drawRectangle({
            x,
            y: top - rowH,
            width: widths[i],
            height: rowH,
            borderColor: lineColor,
            borderWidth: 0.6,
            color: isHeader ? rgb(0.92, 0.92, 0.92) : undefined,
          });
          if (cells[i]) {
            const lines = wrap(cells[i], size, f, widths[i] - padX * 2);
            let ly = top - 10;
            for (const ln of lines) {
              page.drawText(ln, { x: x + padX, y: ly, size, font: f });
              ly -= size + 2;
            }
          }
          x += widths[i];
        }
        y = top - rowH;
      };

      const drawHeader = () => drawRow(COLUMNS.map((c) => c.header), bold, true, 30);

      // Header + blank rows
      drawHeader();
      const blankRows = 14;
      for (let r = 0; r < blankRows; r++) {
        drawRow(
          COLUMNS.map(() => ""),
          font,
          false,
          34
        );
      }

      const bytes = await pdfDoc.save();
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Audit-Program-Template.pdf"`,
          "Content-Length": bytes.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error generating audit program template:", error);
      return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);
