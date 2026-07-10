import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; quarter: string }>;
}

const VALID_QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// GET - Auto-generate the quarterly audit report PDF for a given operational
// plan + quarter, summarizing the planned audits, their engagement status, and
// findings. This is generated from live data (not an uploaded document).
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id, quarter } = await (context as RouteContext).params;
      if (!VALID_QUARTERS.includes(quarter)) {
        return NextResponse.json({ error: "Invalid quarter" }, { status: 400 });
      }
      const tenantFilter = getTenantFilter(session);

      const plan = await prisma.auditOperationalPlan.findFirst({
        where: { id, ...tenantFilter },
        select: {
          id: true,
          year: true,
          planCode: true,
          title: true,
          items: {
            where: { plannedQuarter: quarter },
            orderBy: [{ priorityRank: "asc" }],
            select: {
              title: true,
              auditType: true,
              riskLevel: true,
              engagement: {
                select: {
                  auditId: true,
                  status: true,
                  findings: { select: { status: true } },
                },
              },
            },
          },
        },
      });

      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }

      const rows = plan.items.map((it, idx) => {
        const findings = it.engagement?.findings ?? [];
        const openFindings = findings.filter((f) => f.status !== "Closed").length;
        return {
          number: String(idx + 1),
          title: it.title || "",
          type: it.auditType || "",
          risk: it.riskLevel || "",
          status: it.engagement ? it.engagement.status : "Not Started",
          findings: findings.length ? `${openFindings}/${findings.length}` : "0",
        };
      });

      // Summary stats
      const total = rows.length;
      const completed = plan.items.filter((i) => i.engagement?.status === "Completed").length;
      const inProgress = plan.items.filter((i) => i.engagement?.status === "In Progress").length;
      const notStarted = total - completed - inProgress;
      const totalFindings = plan.items.reduce(
        (s, i) => s + (i.engagement?.findings.length ?? 0),
        0
      );
      const openFindings = plan.items.reduce(
        (s, i) => s + (i.engagement?.findings.filter((f) => f.status !== "Closed").length ?? 0),
        0
      );

      // ----- PDF -----
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

      const drawText = (text: string, size: number, f: PDFFont, color = rgb(0.2, 0.2, 0.2)) => {
        ensureSpace(size + 4);
        page.drawText(text, { x: margin, y: y - size, size, font: f, color });
        y -= size + 4;
      };

      const drawTable = (
        cols: Array<{ header: string; key: string; w: number }>,
        data: Array<Record<string, string>>
      ) => {
        const size = 8.5;
        const padX = 4;
        const padY = 4;
        const widths = cols.map((c) => c.w * contentW);
        const lineColor = rgb(0.6, 0.6, 0.6);

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
        if (data.length === 0) {
          drawRow([`No audits planned for ${quarter}.`, ...cols.slice(1).map(() => "")], font, false);
        } else {
          for (const r of data) {
            drawRow(cols.map((c) => (r[c.key] ?? "").toString()), font, false);
          }
        }
      };

      drawCentered("Quarterly Audit Report", 16, bold);
      drawCentered(
        `${plan.planCode}  ·  ${plan.title || ""}  ·  ${plan.year}  ·  ${quarter}`.replace(/\s+·\s+·/g, " ·"),
        9,
        font,
        rgb(0.3, 0.3, 0.3)
      );
      y -= 8;

      drawText(
        `Audits: ${total}    Completed: ${completed}    In Progress: ${inProgress}    Not Started: ${notStarted}`,
        10,
        bold
      );
      drawText(`Findings: ${totalFindings} total    ${openFindings} open`, 10, bold);
      y -= 6;

      drawTable(
        [
          { header: "#", key: "number", w: 0.05 },
          { header: "Audit", key: "title", w: 0.38 },
          { header: "Type", key: "type", w: 0.16 },
          { header: "Risk", key: "risk", w: 0.11 },
          { header: "Status", key: "status", w: 0.16 },
          { header: "Findings (open/total)", key: "findings", w: 0.14 },
        ],
        rows
      );

      const bytes = await pdfDoc.save();
      const safeName = `Quarterly-Report-${plan.planCode}-${plan.year}-${quarter}.pdf`;
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": bytes.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error generating quarterly report:", error);
      return NextResponse.json({ error: "Failed to generate quarterly report" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "view" }
);
