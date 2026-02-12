import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Colors
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT_BG = rgb(0.95, 0.95, 0.97);
const HEADER_BG = rgb(0.2, 0.25, 0.55);
const GREEN = rgb(0.13, 0.77, 0.37);
const YELLOW = rgb(0.92, 0.7, 0.03);
const RED = rgb(0.94, 0.27, 0.27);
const BLUE = rgb(0.25, 0.45, 0.85);
const PURPLE = rgb(0.55, 0.3, 0.85);
const LINE_COLOR = rgb(0.8, 0.8, 0.8);

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 45;
const CONTENT_W = PAGE_W - 2 * MARGIN;

export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const body = await req.json();
      const {
        overallCompliance,
        frameworkCompliance,
        controlRequirementsByFramework,
        controlImplementationsByFramework,
        complianceRequirementsExceptions,
        controlExceptions,
        frameworkWithGovernanceData,
        complianceIssues,
        domainBasedProgressCompliance,
        frameworkId,
      } = body as Record<string, boolean | string>;

      const tf = getTenantFilter(session);

      // Fetch all data in parallel
      const [frameworksRaw, controlsRaw, exceptionsRaw, governanceRaw] =
        await Promise.all([
          prisma.framework.findMany({
            where: { ...tf, status: "Subscribed", isMasterTemplate: false },
            include: {
              _count: {
                select: { controls: true, requirements: true, evidences: true },
              },
            },
            orderBy: { name: "asc" },
          }),
          prisma.control.findMany({
            where: tf,
            include: {
              framework: { select: { name: true } },
            },
            orderBy: { controlCode: "asc" },
          }),
          prisma.exception.findMany({
            where: tf,
            include: {
              control: { select: { name: true } },
              requirement: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.policy.findMany({
            where: tf,
            include: {
              _count: { select: { policyControls: true } },
            },
            orderBy: { code: "asc" },
          }),
        ]);

      // Filter frameworks if specific one selected
      const frameworks =
        frameworkId && typeof frameworkId === "string"
          ? frameworksRaw.filter((f) => f.id === frameworkId)
          : frameworksRaw;
      const allFrameworks = frameworksRaw; // For overall compliance always use all

      // Group controls by framework
      const controlsByFramework: Record<
        string,
        { status: string; id: string }[]
      > = {};
      for (const c of controlsRaw) {
        const fw = c.framework?.name || "Unassigned";
        if (!controlsByFramework[fw]) controlsByFramework[fw] = [];
        controlsByFramework[fw].push({ status: c.status, id: c.id });
      }

      // Build PDF
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

      let page = doc.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - MARGIN;

      function newPage() {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }

      function ensureSpace(needed: number) {
        if (y - needed < MARGIN + 20) newPage();
      }

      function truncate(text: string, maxW: number, f: PDFFont, size: number) {
        const s = String(text ?? "");
        if (f.widthOfTextAtSize(s, size) <= maxW) return s;
        let t = s;
        while (t.length > 0 && f.widthOfTextAtSize(t + "...", size) > maxW)
          t = t.slice(0, -1);
        return t + "...";
      }

      function drawSectionTitle(title: string) {
        ensureSpace(40);
        // Background band
        page.drawRectangle({
          x: MARGIN,
          y: y - 18,
          width: CONTENT_W,
          height: 24,
          color: rgb(0.93, 0.94, 0.97),
        });
        page.drawText(title, {
          x: MARGIN + 8,
          y: y - 12,
          size: 11,
          font: fontBold,
          color: rgb(0.15, 0.15, 0.4),
        });
        y -= 30;
      }

      function drawLine() {
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE_W - MARGIN, y },
          thickness: 0.5,
          color: LINE_COLOR,
        });
        y -= 8;
      }

      function drawText(
        text: string,
        size: number,
        f: PDFFont,
        color = BLACK,
        x = MARGIN
      ) {
        ensureSpace(size + 6);
        page.drawText(truncate(text, CONTENT_W - (x - MARGIN), f, size), {
          x,
          y,
          size,
          font: f,
          color,
        });
        y -= size + 4;
      }

      // Draws a simple horizontal bar at the current y position
      function drawBar(
        x: number,
        barWidth: number,
        barHeight: number,
        pct: number,
        color: ReturnType<typeof rgb>
      ) {
        // Background
        page.drawRectangle({
          x,
          y: y - barHeight + 2,
          width: barWidth,
          height: barHeight,
          color: rgb(0.9, 0.9, 0.9),
        });
        // Filled portion
        if (pct > 0) {
          page.drawRectangle({
            x,
            y: y - barHeight + 2,
            width: barWidth * (pct / 100),
            height: barHeight,
            color,
          });
        }
      }

      // Helper: draw a stacked bar (green + yellow + red)
      function drawStackedBar(
        x: number,
        barWidth: number,
        barHeight: number,
        greenPct: number,
        yellowPct: number,
        redPct: number
      ) {
        // Background
        page.drawRectangle({
          x,
          y: y - barHeight + 2,
          width: barWidth,
          height: barHeight,
          color: rgb(0.9, 0.9, 0.9),
        });
        let offset = 0;
        if (greenPct > 0) {
          page.drawRectangle({
            x: x + offset,
            y: y - barHeight + 2,
            width: barWidth * (greenPct / 100),
            height: barHeight,
            color: GREEN,
          });
          offset += barWidth * (greenPct / 100);
        }
        if (yellowPct > 0) {
          page.drawRectangle({
            x: x + offset,
            y: y - barHeight + 2,
            width: barWidth * (yellowPct / 100),
            height: barHeight,
            color: YELLOW,
          });
          offset += barWidth * (yellowPct / 100);
        }
        if (redPct > 0) {
          page.drawRectangle({
            x: x + offset,
            y: y - barHeight + 2,
            width: barWidth * (redPct / 100),
            height: barHeight,
            color: RED,
          });
        }
      }

      // Helper: draw a table
      function drawTable(
        headers: string[],
        rows: string[][],
        colWidths: number[]
      ) {
        const rowH = 16;
        const headerH = 20;
        const fontSize = 7.5;

        // Header
        ensureSpace(headerH + rowH);
        page.drawRectangle({
          x: MARGIN,
          y: y - headerH + 4,
          width: CONTENT_W,
          height: headerH,
          color: HEADER_BG,
        });
        let x = MARGIN;
        for (let i = 0; i < headers.length; i++) {
          page.drawText(
            truncate(headers[i], colWidths[i] - 6, fontBold, fontSize),
            {
              x: x + 3,
              y: y - headerH + 8,
              size: fontSize,
              font: fontBold,
              color: WHITE,
            }
          );
          x += colWidths[i];
        }
        y -= headerH;

        // Rows
        for (let r = 0; r < rows.length; r++) {
          if (y - rowH < MARGIN + 20) {
            newPage();
            // Re-draw header on new page
            page.drawRectangle({
              x: MARGIN,
              y: y - headerH + 4,
              width: CONTENT_W,
              height: headerH,
              color: HEADER_BG,
            });
            x = MARGIN;
            for (let i = 0; i < headers.length; i++) {
              page.drawText(
                truncate(headers[i], colWidths[i] - 6, fontBold, fontSize),
                {
                  x: x + 3,
                  y: y - headerH + 8,
                  size: fontSize,
                  font: fontBold,
                  color: WHITE,
                }
              );
              x += colWidths[i];
            }
            y -= headerH;
          }

          if (r % 2 === 0) {
            page.drawRectangle({
              x: MARGIN,
              y: y - rowH + 4,
              width: CONTENT_W,
              height: rowH,
              color: LIGHT_BG,
            });
          }

          x = MARGIN;
          for (let i = 0; i < headers.length; i++) {
            const val = rows[r]?.[i] ?? "";
            page.drawText(truncate(val, colWidths[i] - 6, font, fontSize), {
              x: x + 3,
              y: y - rowH + 6,
              size: fontSize,
              font,
              color: BLACK,
            });
            x += colWidths[i];
          }
          y -= rowH;
        }
        y -= 6;
      }

      // ============================
      // TITLE
      // ============================
      page.drawText("Compliance Management Report", {
        x: MARGIN,
        y,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.4),
      });
      y -= 22;
      page.drawText(
        `Generated: ${new Date().toLocaleString()} | Customer: ${session.customerAccountName || "N/A"}`,
        { x: MARGIN, y, size: 9, font, color: GRAY }
      );
      y -= 16;
      drawLine();

      // ============================
      // 1. Overall Compliance
      // ============================
      if (overallCompliance) {
        drawSectionTitle("Overall Compliance");

        const totalFw = allFrameworks.length || 1;
        let compliantCnt = 0,
          partialCnt = 0,
          nonCompliantCnt = 0;
        allFrameworks.forEach((fw) => {
          if (fw.compliancePercentage >= 80) compliantCnt++;
          else if (fw.compliancePercentage >= 40) partialCnt++;
          else nonCompliantCnt++;
        });

        const compliantPct = Math.round((compliantCnt / totalFw) * 100);
        const partialPct = Math.round((partialCnt / totalFw) * 100);
        const nonCompliantPct = 100 - compliantPct - partialPct;

        // Draw as summary lines with colored squares
        ensureSpace(60);
        const items = [
          { label: "Compliant", value: `${compliantPct}%`, color: GREEN },
          {
            label: "Partially Compliant",
            value: `${partialPct}%`,
            color: YELLOW,
          },
          {
            label: "Non-Compliant",
            value: `${nonCompliantPct}%`,
            color: RED,
          },
        ];
        for (const item of items) {
          page.drawRectangle({
            x: MARGIN + 10,
            y: y - 6,
            width: 10,
            height: 10,
            color: item.color,
          });
          page.drawText(`${item.label}: ${item.value}`, {
            x: MARGIN + 28,
            y: y - 4,
            size: 10,
            font,
            color: BLACK,
          });
          y -= 18;
        }

        // Overall bar
        y -= 4;
        drawStackedBar(
          MARGIN + 10,
          CONTENT_W - 20,
          14,
          compliantPct,
          partialPct,
          nonCompliantPct
        );
        y -= 20;
        drawLine();
      }

      // ============================
      // 2. Framework Compliance
      // ============================
      if (frameworkCompliance) {
        drawSectionTitle("Framework Compliance");

        // Legend
        ensureSpace(20);
        const legendItems = [
          { label: "Compliant", color: GREEN },
          { label: "Partial", color: YELLOW },
          { label: "Non-Compliant", color: RED },
        ];
        let lx = MARGIN + 10;
        for (const li of legendItems) {
          page.drawRectangle({
            x: lx,
            y: y - 6,
            width: 8,
            height: 8,
            color: li.color,
          });
          page.drawText(li.label, {
            x: lx + 12,
            y: y - 5,
            size: 8,
            font,
            color: GRAY,
          });
          lx += font.widthOfTextAtSize(li.label, 8) + 24;
        }
        y -= 18;

        const barW = CONTENT_W - 170;
        for (const fw of allFrameworks) {
          ensureSpace(24);
          // Framework name
          const label = truncate(fw.name, 120, font, 8);
          page.drawText(label, {
            x: MARGIN + 4,
            y: y - 8,
            size: 8,
            font,
            color: BLACK,
          });

          // Calculate compliance per framework from controls
          const fwCtrls = controlsByFramework[fw.name] || [];
          const unique = new Map<string, string>();
          fwCtrls.forEach((c) => unique.set(c.id, c.status));
          const total = unique.size;
          let comp = 0,
            part = 0;
          unique.forEach((status) => {
            if (status === "Implemented") comp++;
            else if (status === "Partially Implemented") part++;
          });
          const compPct = total > 0 ? Math.round((comp / total) * 100) : 0;
          const partPctVal = total > 0 ? Math.round((part / total) * 100) : 0;
          const nonPct = total > 0 ? 100 - compPct - partPctVal : 0;

          drawStackedBar(
            MARGIN + 130,
            barW,
            12,
            compPct,
            partPctVal,
            nonPct
          );

          // Count label
          page.drawText(`${total}`, {
            x: PAGE_W - MARGIN - 20,
            y: y - 8,
            size: 8,
            font,
            color: GRAY,
          });

          y -= 20;
        }
        y -= 4;
        drawLine();
      }

      // ============================
      // 3. Control Requirements by Framework
      // ============================
      if (controlRequirementsByFramework) {
        drawSectionTitle("Control Requirements by Framework");
        drawTable(
          ["Framework", "Requirements"],
          frameworks.map((fw) => [
            fw.name,
            String(fw._count?.requirements || 0),
          ]),
          [CONTENT_W - 100, 100]
        );
        drawLine();
      }

      // ============================
      // 4. Control Implementations by Framework
      // ============================
      if (controlImplementationsByFramework) {
        drawSectionTitle("Control Implementations by Framework");
        drawTable(
          ["Framework", "Controls"],
          frameworks.map((fw) => [
            fw.name,
            String(fw._count?.controls || 0),
          ]),
          [CONTENT_W - 100, 100]
        );
        drawLine();
      }

      // ============================
      // 5. Compliance Requirements Exceptions
      // ============================
      if (complianceRequirementsExceptions) {
        drawSectionTitle("Compliance Requirements Exceptions");
        const reqExceptions = exceptionsRaw.filter(
          (e) => e.category === "Compliance" || e.requirement
        );
        if (reqExceptions.length > 0) {
          drawTable(
            ["Exception", "Status", "Requirement"],
            reqExceptions.map((e) => [
              e.name,
              e.status,
              e.requirement?.name || "",
            ]),
            [CONTENT_W * 0.4, CONTENT_W * 0.25, CONTENT_W * 0.35]
          );
        } else {
          drawText("No requirement exceptions found.", 9, font, GRAY);
        }
        drawLine();
      }

      // ============================
      // 6. Control Exceptions
      // ============================
      if (controlExceptions) {
        drawSectionTitle("Control Exceptions");
        const ctrlExceptions = exceptionsRaw.filter(
          (e) => e.category === "Control" || e.control
        );
        if (ctrlExceptions.length > 0) {
          const approved = ctrlExceptions.filter(
            (e) => e.status === "Approved"
          ).length;
          const pending = ctrlExceptions.filter(
            (e) => e.status === "Pending"
          ).length;
          const other = ctrlExceptions.length - approved - pending;

          ensureSpace(24);
          const summaryItems = [
            { label: `Approved: ${approved}`, color: GREEN },
            { label: `Pending: ${pending}`, color: YELLOW },
            { label: `Other: ${other}`, color: RED },
          ];
          for (const item of summaryItems) {
            page.drawRectangle({
              x: MARGIN + 10,
              y: y - 6,
              width: 10,
              height: 10,
              color: item.color,
            });
            page.drawText(item.label, {
              x: MARGIN + 28,
              y: y - 4,
              size: 9,
              font,
              color: BLACK,
            });
            y -= 16;
          }
          y -= 4;

          drawTable(
            ["Exception", "Status", "Control"],
            ctrlExceptions.map((e) => [
              e.name,
              e.status,
              e.control?.name || "",
            ]),
            [CONTENT_W * 0.4, CONTENT_W * 0.25, CONTENT_W * 0.35]
          );
        } else {
          drawText("No control exceptions found.", 9, font, GRAY);
        }
        drawLine();
      }

      // ============================
      // 7. Framework with Governance Data
      // ============================
      if (frameworkWithGovernanceData) {
        drawSectionTitle("Framework with Governance Data");

        // Group governance docs by framework
        const govByFw: Record<string, { name: string; type: string }[]> = {};
        for (const p of governanceRaw) {
          // Use the policyControls to associate with framework — fallback to "General"
          const bucket = "General";
          if (!govByFw[bucket]) govByFw[bucket] = [];
          govByFw[bucket].push({ name: p.name, type: p.documentType });
        }

        for (const fw of frameworks) {
          ensureSpace(30);
          drawText(fw.name, 10, fontBold, BLACK, MARGIN + 4);
          const docs = govByFw[fw.name] || [];
          if (docs.length > 0) {
            for (const d of docs) {
              ensureSpace(14);
              page.drawText(`  ${d.name}`, {
                x: MARGIN + 16,
                y,
                size: 8,
                font,
                color: BLACK,
              });
              page.drawText(d.type, {
                x: PAGE_W - MARGIN - 60,
                y,
                size: 8,
                font,
                color: GRAY,
              });
              y -= 14;
            }
          } else {
            drawText("No governance documents", 8, font, GRAY, MARGIN + 16);
          }
        }

        // Also show docs under General if any
        if (governanceRaw.length > 0) {
          ensureSpace(20);
          drawText("All Governance Documents", 10, fontBold, BLACK, MARGIN + 4);
          drawTable(
            ["Document", "Type", "Status"],
            governanceRaw.map((p) => [p.name, p.documentType, p.status]),
            [CONTENT_W * 0.5, CONTENT_W * 0.25, CONTENT_W * 0.25]
          );
        }
        drawLine();
      }

      // ============================
      // 8. Domain Based Progress Compliance
      // ============================
      if (domainBasedProgressCompliance) {
        drawSectionTitle("Domain Based Progress Compliance");

        const barW2 = CONTENT_W - 200;
        for (const fw of frameworks) {
          ensureSpace(70);
          drawText(fw.name, 10, fontBold, BLACK, MARGIN + 4);

          const metrics = [
            {
              label: "Policy Progress",
              value: Math.round(fw.policyPercentage || 0),
              color: BLUE,
            },
            {
              label: "Evidence Progress",
              value: Math.round(fw.evidencePercentage || 0),
              color: GREEN,
            },
            {
              label: "Compliance",
              value: Math.round(fw.compliancePercentage || 0),
              color: PURPLE,
            },
          ];

          for (const m of metrics) {
            ensureSpace(18);
            page.drawText(m.label, {
              x: MARGIN + 16,
              y: y - 6,
              size: 8,
              font,
              color: BLACK,
            });
            drawBar(MARGIN + 120, barW2, 10, m.value, m.color);
            page.drawText(`${m.value}%`, {
              x: PAGE_W - MARGIN - 30,
              y: y - 6,
              size: 8,
              font,
              color: GRAY,
            });
            y -= 16;
          }
          y -= 6;
        }
        drawLine();
      }

      // ============================
      // 9. Compliance Issues
      // ============================
      if (complianceIssues) {
        drawSectionTitle("Compliance Issues");

        const filteredControls = frameworkId
          ? controlsRaw.filter(
              (c) =>
                c.framework?.name &&
                frameworksRaw.find((f) => f.id === frameworkId)?.name ===
                  c.framework.name
            )
          : controlsRaw;

        const issues = filteredControls.filter(
          (c) =>
            c.status === "Not Implemented" ||
            c.status === "Partially Implemented" ||
            c.status === "Non Compliant"
        );

        if (issues.length > 0) {
          drawTable(
            ["Control Code", "Name", "Status", "Framework"],
            issues.map((c) => [
              c.controlCode,
              c.name,
              c.status,
              c.framework?.name || "",
            ]),
            [
              CONTENT_W * 0.15,
              CONTENT_W * 0.35,
              CONTENT_W * 0.2,
              CONTENT_W * 0.3,
            ]
          );
        } else {
          drawText("No compliance issues found.", 9, font, GRAY);
        }
      }

      // Footer on last page
      page.drawText(
        `Compliance Management Report - ${new Date().toLocaleDateString()}`,
        { x: MARGIN, y: MARGIN - 15, size: 7, font, color: GRAY }
      );

      const pdfBytes = await doc.save();

      const filename = `Compliance_Management_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error("Error generating management report:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: "Failed to generate report", details: message },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.dashboard", action: "view" }
);
