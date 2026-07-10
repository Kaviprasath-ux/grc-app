import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "";

// GET - Export the engagement's findings as an Excel (.xlsx) file.
// Works for both Continuous and Aggregated reporting modes.
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, auditId: true, engagementTitle: true, reportingMode: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      // Scope/label the export to the currently selected reporting mode.
      const modeParam = new URL(req.url).searchParams.get("mode");
      const mode =
        modeParam === "Continuous" || modeParam === "Aggregated"
          ? modeParam
          : engagement.reportingMode || "Continuous";

      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId: id, ...tenantFilter },
        select: {
          findingId: true,
          finding: true,
          severity: true,
          status: true,
          criteria: true,
          condition: true,
          cause: true,
          effect: true,
          recommendation: true,
          responsiblePerson: true,
          targetDate: true,
          sharedWithAuditeeAt: true,
          department: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const header = [
        "#",
        "Finding ID",
        "Title",
        "Severity",
        "Status",
        "Department",
        "Criteria (What should be)",
        "Condition (What is)",
        "Cause (Why it happened)",
        "Effect (The consequence)",
        "Recommendation",
        "Responsible Person",
        "Target Date",
        "Shared With Auditee",
      ];

      const rows: (string | number)[][] = [
        [`Audit Findings (${mode}) — ${engagement.auditId || ""} ${engagement.engagementTitle || ""}`.trim()],
        [`Reporting mode: ${mode}    Findings: ${findings.length}`],
        [],
        header,
        ...findings.map((f, i) => [
          i + 1,
          f.findingId || "",
          f.finding || "",
          f.severity || "",
          f.status || "",
          f.department?.name || "",
          f.criteria || "",
          f.condition || "",
          f.cause || "",
          f.effect || "",
          f.recommendation || "",
          f.responsiblePerson || "",
          fmtDate(f.targetDate),
          f.sharedWithAuditeeAt ? "Yes" : "No",
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 4 }, // #
        { wch: 12 }, // Finding ID
        { wch: 30 }, // Title
        { wch: 10 }, // Severity
        { wch: 12 }, // Status
        { wch: 16 }, // Department
        { wch: 28 }, // Criteria
        { wch: 28 }, // Condition
        { wch: 28 }, // Cause
        { wch: 28 }, // Effect
        { wch: 28 }, // Recommendation
        { wch: 20 }, // Responsible Person
        { wch: 14 }, // Target Date
        { wch: 16 }, // Shared
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Findings (${mode})`);

      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      const safeName = `Findings-${engagement.auditId || id}-${mode}.xlsx`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${safeName}"`,
        },
      });
    } catch (error) {
      console.error("Error exporting findings Excel:", error);
      return NextResponse.json({ error: "Failed to export findings" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);
