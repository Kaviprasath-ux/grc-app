import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface QPlan {
  residualScore?: number | null;
  riskLevel?: string | null;
  proposedPeriodical?: string | null;
  estimatedHours?: number | null;
  auditorInChargeId?: string | null;
}

// GET - Annual Audit Plan PDF (landscape table) for an operational (annual) plan.
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const plan = await prisma.auditOperationalPlan.findFirst({
        where: { id, ...tenantFilter },
        include: { items: { orderBy: [{ priorityRank: "asc" }] } },
      });
      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }

      const quarterPlans: Record<string, QPlan> = plan.quarterPlans ? JSON.parse(plan.quarterPlans) : {};

      // Resolve department + auditor names referenced by the rows.
      const deptIds = [...new Set(plan.items.map((i) => i.departmentId).filter(Boolean))] as string[];
      const userIds = [
        ...new Set([
          ...plan.items.map((i) => i.auditorInChargeId).filter(Boolean),
          ...Object.values(quarterPlans).map((q) => q?.auditorInChargeId).filter(Boolean),
        ]),
      ] as string[];
      const [depts, users] = await Promise.all([
        deptIds.length ? prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }) : [],
        userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [],
      ]);
      const deptMap = new Map(depts.map((d) => [d.id, d.name]));
      const userMap = new Map(users.map((u) => [u.id, u.fullName]));

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageW = 842;
      const pageH = 595;
      const margin = 22;
      const headerBg = rgb(0.18, 0.27, 0.42);

      // Column definitions (label + width). Widths sum to content width (798).
      const cols: { key: string; label: string; w: number; align?: "center" }[] = [
        { key: "priority", label: "Priority Order", w: 42, align: "center" },
        { key: "process", label: "Process/Entity", w: 112 },
        { key: "dept", label: "Department", w: 72 },
        { key: "type", label: "Audit Type", w: 60 },
        { key: "rrs", label: "Residual risk score", w: 50, align: "center" },
        { key: "cls", label: "Risk Classification", w: 60 },
        { key: "per", label: "Proposed Periodical", w: 76 },
        { key: "hrs", label: "Estimated Hours", w: 46, align: "center" },
        { key: "aic", label: "Auditor in Charge", w: 76 },
        { key: "q1", label: "First Quarter", w: 36, align: "center" },
        { key: "q2", label: "Second Quarter", w: 36, align: "center" },
        { key: "q3", label: "Third Quarter", w: 36, align: "center" },
        { key: "q4", label: "Fourth Quarter", w: 36, align: "center" },
        { key: "status", label: "Status", w: 54, align: "center" },
      ];
      const tableX = margin;
      const tableW = cols.reduce((s, c) => s + c.w, 0);

      const wrap = (text: string, size: number, f: PDFFont, maxW: number): string[] => {
        const clean = (text ?? "").toString().replace(/\s+/g, " ").trim();
        if (!clean) return [""];
        const words = clean.split(" ");
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (f.widthOfTextAtSize(test, size) > maxW && line) {
            lines.push(line);
            line = w;
          } else line = test;
        }
        if (line) lines.push(line);
        return lines;
      };

      let page: PDFPage = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;

      // Title
      const title = "Annual Audit Plan";
      page.drawText(title, {
        x: tableX + (tableW - bold.widthOfTextAtSize(title, 13)) / 2,
        y: y - 13,
        size: 13,
        font: bold,
        color: headerBg,
      });
      y -= 20;
      const sub = `${plan.title || plan.planCode} — ${plan.year}`;
      page.drawText(sub, {
        x: tableX + (tableW - font.widthOfTextAtSize(sub, 8)) / 2,
        y: y - 8,
        size: 8,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 18;

      const hSize = 6.5;
      const bSize = 7;
      const padX = 3;
      const padY = 4;

      const drawHeader = () => {
        // Compute header height from wrapped labels
        let maxLines = 1;
        const wrapped = cols.map((c) => {
          const ls = wrap(c.label, hSize, bold, c.w - padX * 2);
          maxLines = Math.max(maxLines, ls.length);
          return ls;
        });
        const hH = maxLines * (hSize + 1.5) + padY * 2;
        page.drawRectangle({ x: tableX, y: y - hH, width: tableW, height: hH, color: headerBg });
        let x = tableX;
        cols.forEach((c, ci) => {
          const ls = wrapped[ci];
          let ly = y - padY - hSize;
          for (const ln of ls) {
            const tw = bold.widthOfTextAtSize(ln, hSize);
            const tx = c.align === "center" ? x + (c.w - tw) / 2 : x + padX;
            page.drawText(ln, { x: tx, y: ly, size: hSize, font: bold, color: rgb(1, 1, 1) });
            ly -= hSize + 1.5;
          }
          x += c.w;
        });
        y -= hH;
      };

      const ensure = (need: number) => {
        if (y - need < margin) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - margin;
          drawHeader();
        }
      };

      drawHeader();

      const rowFor = (it: (typeof plan.items)[number], idx: number): Record<string, string> => {
        const q = it.plannedQuarter || "";
        const qp = (q && quarterPlans[q]) || ({} as QPlan);
        const rrs = qp.residualScore ?? it.residualScore;
        const cls = qp.riskLevel ?? it.riskLevel;
        const aic = qp.auditorInChargeId ?? it.auditorInChargeId;
        return {
          priority: String(it.priorityRank ?? idx + 1),
          process: it.title || "—",
          dept: (it.departmentId && deptMap.get(it.departmentId)) || "—",
          type: it.auditCategory || it.auditType || "—",
          rrs: rrs == null ? "—" : String(rrs),
          cls: cls || "—",
          per: qp.proposedPeriodical || "—",
          hrs: qp.estimatedHours == null ? "—" : String(qp.estimatedHours),
          aic: (aic && userMap.get(aic)) || "—",
          q1: q === "Q1" ? "X" : "",
          q2: q === "Q2" ? "X" : "",
          q3: q === "Q3" ? "X" : "",
          q4: q === "Q4" ? "X" : "",
          status: it.engagementId ? "In Progress" : "Planned",
        };
      };

      const drawRow = (data: Record<string, string>, idx: number) => {
        const wrapped = cols.map((c) => wrap(data[c.key] || "", bSize, font, c.w - padX * 2));
        const lines = Math.max(...wrapped.map((w) => w.length), 1);
        const rowH = lines * (bSize + 2) + padY * 2;
        ensure(rowH);
        if (idx % 2 === 1) {
          page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, color: rgb(0.95, 0.96, 0.98) });
        }
        let x = tableX;
        cols.forEach((c, ci) => {
          // cell border
          page.drawRectangle({
            x,
            y: y - rowH,
            width: c.w,
            height: rowH,
            borderColor: rgb(0.82, 0.85, 0.88),
            borderWidth: 0.5,
          });
          let ly = y - padY - bSize;
          for (const ln of wrapped[ci]) {
            const tw = font.widthOfTextAtSize(ln, bSize);
            const tx = c.align === "center" ? x + (c.w - tw) / 2 : x + padX;
            page.drawText(ln, { x: tx, y: ly, size: bSize, font, color: rgb(0.1, 0.1, 0.1) });
            ly -= bSize + 2;
          }
          x += c.w;
        });
        y -= rowH;
      };

      if (plan.items.length === 0) {
        ensure(20);
        page.drawText("No audits in this plan.", { x: tableX + padX, y: y - 12, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
        y -= 20;
      } else {
        plan.items.forEach((it, idx) => drawRow(rowFor(it, idx), idx));
      }

      const bytes = await pdfDoc.save();
      const safe = `Annual-Audit-Plan-${plan.year}.pdf`;
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safe}"`,
          "Content-Length": bytes.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error generating annual audit plan PDF:", error);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "view" }
);
