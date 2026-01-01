import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET export risk data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const categoryId = searchParams.get("categoryId");
    const typeId = searchParams.get("typeId");
    const status = searchParams.get("status");
    const riskRating = searchParams.get("riskRating");

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (typeId) where.typeId = typeId;
    if (status) where.status = status;
    if (riskRating) where.riskRating = riskRating;

    const risks = await prisma.risk.findMany({
      where,
      include: {
        category: true,
        type: true,
        department: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        threats: {
          include: { threat: true },
        },
        vulnerabilities: {
          include: { vulnerability: true },
        },
        causes: {
          include: { cause: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform data for export (flattened structure for Excel)
    const exportData = risks.map((risk) => ({
      "Risk ID": risk.riskId,
      "Risk Name": risk.name,
      Description: risk.description || "",
      "Risk Sources": risk.riskSources || "",
      Category: risk.category?.name || "",
      "Risk Type": risk.type?.name || "",
      Department: risk.department?.name || "",
      "Risk Owner": risk.owner?.fullName || "",
      "Owner Email": risk.owner?.email || "",
      Likelihood: risk.likelihood,
      Impact: risk.impact,
      "Risk Score": risk.riskScore,
      "Risk Rating": risk.riskRating,
      Status: risk.status,
      "Response Strategy": risk.responseStrategy || "",
      "Treatment Plan": risk.treatmentPlan || "",
      "Treatment Due Date": risk.treatmentDueDate
        ? new Date(risk.treatmentDueDate).toISOString().split("T")[0]
        : "",
      "Treatment Status": risk.treatmentStatus || "",
      Threats: risk.threats.map((t) => t.threat.name).join(", "),
      Vulnerabilities: risk.vulnerabilities.map((v) => v.vulnerability.name).join(", "),
      Causes: risk.causes.map((c) => c.cause.name).join(", "),
      "Created At": new Date(risk.createdAt).toISOString().split("T")[0],
      "Updated At": new Date(risk.updatedAt).toISOString().split("T")[0],
    }));

    if (format === "csv") {
      // Return CSV format
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(","),
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = String(row[header as keyof typeof row] || "");
              // Escape quotes and wrap in quotes if contains comma
              if (value.includes(",") || value.includes('"')) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(",")
        ),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=Risk-Register.csv",
        },
      });
    }

    // Return JSON format (for Excel generation on frontend)
    return NextResponse.json({
      data: exportData,
      metadata: {
        totalCount: exportData.length,
        exportDate: new Date().toISOString(),
        filters: { categoryId, typeId, status, riskRating },
      },
    });
  } catch (error) {
    console.error("Error exporting risks:", error);
    return NextResponse.json(
      { error: "Failed to export risks" },
      { status: 500 }
    );
  }
}
