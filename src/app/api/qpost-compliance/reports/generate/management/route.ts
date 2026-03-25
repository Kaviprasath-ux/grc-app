import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";

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
        locale,
      } = body as Record<string, boolean | string>;

      // English-only labels (no locale translation for PDF)
      const t = (s: string) => s;

      const tf = getTenantFilter(session);

      // Fetch all QPost data in parallel
      const [frameworksRaw, requirementsRaw, exceptionsRaw, governanceRaw] =
        await Promise.all([
          prisma.qPostFramework.findMany({
            where: { ...tf, status: "Subscribed", isMasterTemplate: false },
            include: {
              _count: {
                select: { requirements: true, evidences: true },
              },
            },
            orderBy: { name: "asc" },
          }),
          prisma.qPostRequirement.findMany({
            where: tf,
            include: {
              framework: { select: { name: true } },
            },
            orderBy: { code: "asc" },
          }),
          prisma.qPostException.findMany({
            where: tf,
            include: {
              requirement: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.qPostPolicy.findMany({
            where: tf,
            include: {
              _count: { select: { requirements: true } },
            },
            orderBy: { code: "asc" },
          }),
        ]);

      // Filter frameworks if specific one selected
      const frameworks =
        frameworkId && typeof frameworkId === "string"
          ? frameworksRaw.filter((f) => f.id === frameworkId)
          : frameworksRaw;
      const allFrameworks = frameworksRaw;

      // Group requirements by framework
      const requirementsByFramework: Record<
        string,
        { status: string; id: string; controlCompliance: string | null }[]
      > = {};
      for (const r of requirementsRaw) {
        const fw = r.framework?.name || "Unassigned";
        if (!requirementsByFramework[fw]) requirementsByFramework[fw] = [];
        requirementsByFramework[fw].push({ status: r.controlCompliance || "Non Compliant", id: r.id, controlCompliance: r.controlCompliance });
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

      function drawBar(
        x: number,
        barWidth: number,
        barHeight: number,
        pct: number,
        color: ReturnType<typeof rgb>
      ) {
        page.drawRectangle({
          x,
          y: y - barHeight + 2,
          width: barWidth,
          height: barHeight,
          color: rgb(0.9, 0.9, 0.9),
        });
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

      function drawStackedBar(
        x: number,
        barWidth: number,
        barHeight: number,
        greenPct: number,
        yellowPct: number,
        redPct: number
      ) {
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

      function drawTable(
        headers: string[],
        rows: string[][],
        colWidths: number[]
      ) {
        const rowH = 16;
        const headerH = 20;
        const fontSize = 7.5;

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

        for (let r = 0; r < rows.length; r++) {
          if (y - rowH < MARGIN + 20) {
            newPage();
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
      page.drawText(t("QPost Compliance Management Report"), {
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
        drawSectionTitle(t("Overall Compliance"));

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

        ensureSpace(60);
        const items = [
          { label: t("Compliant"), value: `${compliantPct}%`, color: GREEN },
          { label: t("Partially Compliant"), value: `${partialPct}%`, color: YELLOW },
          { label: t("Non-Compliant"), value: `${nonCompliantPct}%`, color: RED },
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

        y -= 4;
        drawStackedBar(MARGIN + 10, CONTENT_W - 20, 14, compliantPct, partialPct, nonCompliantPct);
        y -= 20;
        drawLine();
      }

      // ============================
      // 2. Framework Compliance
      // ============================
      if (frameworkCompliance) {
        drawSectionTitle(t("Framework Compliance"));

        ensureSpace(20);
        const legendItems = [
          { label: t("Compliant"), color: GREEN },
          { label: t("Partial"), color: YELLOW },
          { label: t("Non-Compliant"), color: RED },
        ];
        let lx = MARGIN + 10;
        for (const li of legendItems) {
          page.drawRectangle({ x: lx, y: y - 6, width: 8, height: 8, color: li.color });
          page.drawText(li.label, { x: lx + 12, y: y - 5, size: 8, font, color: GRAY });
          lx += font.widthOfTextAtSize(li.label, 8) + 24;
        }
        y -= 18;

        const barW = CONTENT_W - 170;
        for (const fw of allFrameworks) {
          ensureSpace(24);
          const label = truncate(fw.name, 120, font, 8);
          page.drawText(label, { x: MARGIN + 4, y: y - 8, size: 8, font, color: BLACK });

          // Calculate compliance from requirements
          const fwReqs = requirementsByFramework[fw.name] || [];
          const unique = new Map<string, string>();
          fwReqs.forEach((r) => unique.set(r.id, r.status));
          const total = unique.size;
          let comp = 0, part = 0;
          unique.forEach((status) => {
            if (status === "Compliant") comp++;
            else if (status === "Partial Compliant") part++;
          });
          const compPct = total > 0 ? Math.round((comp / total) * 100) : 0;
          const partPctVal = total > 0 ? Math.round((part / total) * 100) : 0;
          const nonPct = total > 0 ? 100 - compPct - partPctVal : 0;

          drawStackedBar(MARGIN + 130, barW, 12, compPct, partPctVal, nonPct);
          page.drawText(`${total}`, { x: PAGE_W - MARGIN - 20, y: y - 8, size: 8, font, color: GRAY });
          y -= 20;
        }
        y -= 4;
        drawLine();
      }

      // ============================
      // 3. Controls by Framework (Requirements count)
      // ============================
      if (controlRequirementsByFramework) {
        drawSectionTitle(t("Controls by Framework"));
        drawTable(
          [t("Framework"), t("Controls")],
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
        drawSectionTitle(t("Control Implementations by Framework"));
        drawTable(
          [t("Framework"), t("Controls")],
          frameworks.map((fw) => [
            fw.name,
            String(fw._count?.requirements || 0),
          ]),
          [CONTENT_W - 100, 100]
        );
        drawLine();
      }

      // ============================
      // 5. Compliance Exceptions
      // ============================
      if (complianceRequirementsExceptions) {
        drawSectionTitle(t("Compliance Controls Exceptions"));
        const reqExceptions = exceptionsRaw.filter(
          (e) => e.requirement
        );
        if (reqExceptions.length > 0) {
          drawTable(
            [t("Exception"), t("Status"), t("Control")],
            reqExceptions.map((e) => [
              e.name,
              e.status,
              e.requirement?.name || "",
            ]),
            [CONTENT_W * 0.4, CONTENT_W * 0.25, CONTENT_W * 0.35]
          );
        } else {
          drawText(t("No control exceptions found."), 9, font, GRAY);
        }
        drawLine();
      }

      // ============================
      // 6. Control Exceptions
      // ============================
      if (controlExceptions) {
        drawSectionTitle(t("Control Exceptions"));
        // In QPost, all exceptions are requirement-based (no separate control exceptions)
        const allExceptions = exceptionsRaw;
        if (allExceptions.length > 0) {
          const approved = allExceptions.filter((e) => e.status === "Approved").length;
          const pending = allExceptions.filter((e) => e.status === "Pending").length;
          const other = allExceptions.length - approved - pending;

          ensureSpace(24);
          const summaryItems = [
            { label: `${t("Approved")}: ${approved}`, color: GREEN },
            { label: `${t("Pending")}: ${pending}`, color: YELLOW },
            { label: `${t("Other")}: ${other}`, color: RED },
          ];
          for (const item of summaryItems) {
            page.drawRectangle({ x: MARGIN + 10, y: y - 6, width: 10, height: 10, color: item.color });
            page.drawText(item.label, { x: MARGIN + 28, y: y - 4, size: 9, font, color: BLACK });
            y -= 16;
          }
          y -= 4;

          drawTable(
            [t("Exception"), t("Status"), t("Control")],
            allExceptions.map((e) => [
              e.name,
              e.status,
              e.requirement?.name || "",
            ]),
            [CONTENT_W * 0.4, CONTENT_W * 0.25, CONTENT_W * 0.35]
          );
        } else {
          drawText(t("No control exceptions found."), 9, font, GRAY);
        }
        drawLine();
      }

      // ============================
      // 7. Framework with Governance Data
      // ============================
      if (frameworkWithGovernanceData) {
        drawSectionTitle(t("Framework with Governance Data"));

        if (governanceRaw.length > 0) {
          ensureSpace(20);
          drawText(t("All Governance Documents"), 10, fontBold, BLACK, MARGIN + 4);
          drawTable(
            [t("Document"), t("Type"), t("Status")],
            governanceRaw.map((p) => [p.name, p.documentType, p.status]),
            [CONTENT_W * 0.5, CONTENT_W * 0.25, CONTENT_W * 0.25]
          );
        } else {
          drawText(t("No governance documents found."), 9, font, GRAY);
        }
        drawLine();
      }

      // ============================
      // 8. Domain Based Progress Compliance
      // ============================
      if (domainBasedProgressCompliance) {
        drawSectionTitle(t("Domain Based Progress Compliance"));

        const barW2 = CONTENT_W - 200;
        for (const fw of frameworks) {
          ensureSpace(70);
          drawText(fw.name, 10, fontBold, BLACK, MARGIN + 4);

          const metrics = [
            { label: t("Policy Progress"), value: Math.round(fw.policyPercentage || 0), color: BLUE },
            { label: t("Evidence Progress"), value: Math.round(fw.evidencePercentage || 0), color: GREEN },
            { label: t("Compliance"), value: Math.round(fw.compliancePercentage || 0), color: PURPLE },
          ];

          for (const m of metrics) {
            ensureSpace(18);
            page.drawText(m.label, { x: MARGIN + 16, y: y - 6, size: 8, font, color: BLACK });
            drawBar(MARGIN + 120, barW2, 10, m.value, m.color);
            page.drawText(`${m.value}%`, { x: PAGE_W - MARGIN - 30, y: y - 6, size: 8, font, color: GRAY });
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
        drawSectionTitle(t("Compliance Issues"));

        const filteredReqs = frameworkId
          ? requirementsRaw.filter(
              (r) =>
                r.framework?.name &&
                frameworksRaw.find((f) => f.id === frameworkId)?.name === r.framework.name
            )
          : requirementsRaw;

        const issues = filteredReqs.filter(
          (r) =>
            r.controlCompliance === "Non Compliant" ||
            r.controlCompliance === "Partial Compliant" ||
            !r.controlCompliance
        );

        if (issues.length > 0) {
          drawTable(
            [t("Control Code"), t("Name"), t("Status"), t("Framework")],
            issues.map((r) => [
              r.code,
              r.name,
              r.controlCompliance || "Non Compliant",
              r.framework?.name || "",
            ]),
            [CONTENT_W * 0.15, CONTENT_W * 0.35, CONTENT_W * 0.2, CONTENT_W * 0.3]
          );
        } else {
          drawText(t("No compliance issues found."), 9, font, GRAY);
        }
      }

      // Footer
      page.drawText(
        `${t("QPost Compliance Management Report")} - ${new Date().toLocaleDateString()}`,
        { x: MARGIN, y: MARGIN - 15, size: 7, font, color: GRAY }
      );

      const pdfBytes = await doc.save();
      const filename = `QPost_Compliance_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error("Error generating QPost management report:", error);
      return NextResponse.json(
        { error: "Unable to complete the request. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.dashboard", action: "view" }
);
