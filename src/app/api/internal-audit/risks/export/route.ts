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
      "Risk Name",
      "Risk Description",
      "Department",
      "Category",
      "Audit Type",
      "Section/Process",
      "Sub Process",
      "Activity",
      "Inherent Likelihood",
      "Inherent Impact",
      "Inherent Score",
      "Control Description",
      "Control Effectiveness",
      "Residual Likelihood",
      "Residual Impact",
      "Residual Score",
      "Risk Level",
      "Status",
      "Creation Date",
      "Audit Comment",
    ];

    // CSV rows
    const rows = risks.map((risk) => [
      risk.riskId,
      escapeCSV(risk.riskName),
      escapeCSV(risk.riskDescription || ""),
      escapeCSV(risk.department?.name || ""),
      escapeCSV(risk.category?.name || ""),
      escapeCSV(risk.auditType?.name || ""),
      escapeCSV(risk.sectionProcess || ""),
      escapeCSV(risk.subProcess || ""),
      escapeCSV(risk.activity || ""),
      risk.inherentLikelihood ?? "",
      risk.inherentImpact ?? "",
      risk.inherentScore ?? "",
      escapeCSV(risk.controlDescription || ""),
      escapeCSV(risk.controlEffectiveness || ""),
      risk.residualLikelihood ?? "",
      risk.residualImpact ?? "",
      risk.residualScore ?? "",
      risk.riskLevel || "",
      risk.status,
      risk.creationDate ? new Date(risk.creationDate).toISOString().split("T")[0] : "",
      escapeCSV(risk.auditComment || ""),
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
