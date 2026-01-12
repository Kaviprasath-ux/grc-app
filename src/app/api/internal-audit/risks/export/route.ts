import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET export internal audit risks as CSV
export async function GET(request: NextRequest) {
  try {
    const risks = await prisma.internalAuditRisk.findMany({
      include: {
        department: true,
        category: true,
        auditType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // CSV header
    const headers = [
      "Risk ID",
      "Risk Description",
      "Department",
      "Creation Date",
      "Category",
      "Inherent Score",
      "Residual Score",
      "Risk Level",
      "Status",
    ];

    // CSV rows
    const rows = risks.map((risk) => [
      risk.riskId,
      escapeCSV(risk.riskDescription || risk.riskName || ""),
      escapeCSV(risk.department?.name || ""),
      risk.creationDate ? new Date(risk.creationDate).toISOString().split("T")[0] : "",
      escapeCSV(risk.category?.name || ""),
      risk.inherentScore ?? "",
      risk.residualScore ?? "",
      risk.riskLevel || "",
      risk.status,
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Return CSV response
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="risk-register-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting internal audit risks:", error);
    return NextResponse.json(
      { error: "Failed to export internal audit risks" },
      { status: 500 }
    );
  }
}

// Helper function to escape CSV values
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
