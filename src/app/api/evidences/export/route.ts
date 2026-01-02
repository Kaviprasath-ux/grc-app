import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET export evidences as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const frameworkId = searchParams.get("frameworkId");
    const departmentId = searchParams.get("departmentId");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") where.status = status;
    if (frameworkId && frameworkId !== "all") where.frameworkId = frameworkId;
    if (departmentId && departmentId !== "all") where.departmentId = departmentId;

    const evidences = await prisma.evidence.findMany({
      where,
      include: {
        framework: true,
        department: true,
        assignee: true,
        evidenceControls: {
          include: {
            control: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Create CSV content
    const headers = [
      "Evidence Code",
      "Evidence Name",
      "Description",
      "Domain",
      "Status",
      "Department",
      "Assignee",
      "Recurrence",
      "Review Date",
      "Framework",
      "Linked Controls",
      "KPI Required",
    ];

    const rows = evidences.map((evidence) => [
      evidence.evidenceCode || "",
      evidence.name || "",
      evidence.description || "",
      evidence.domain || "",
      evidence.status || "",
      evidence.department?.name || "",
      evidence.assignee?.fullName || "",
      evidence.recurrence || "",
      evidence.reviewDate ? new Date(evidence.reviewDate).toLocaleDateString() : "",
      evidence.framework?.name || "",
      evidence.evidenceControls.map((ec) => ec.control.controlCode).join("; ") || "",
      evidence.kpiRequired ? "Yes" : "No",
    ]);

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Return as CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="evidence-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting evidences:", error);
    return NextResponse.json(
      { error: "Failed to export evidences" },
      { status: 500 }
    );
  }
}
