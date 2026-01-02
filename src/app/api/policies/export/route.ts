import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET export policies as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const documentType = searchParams.get("documentType");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") where.status = status;
    if (documentType && documentType !== "all") where.documentType = documentType;

    const policies = await prisma.policy.findMany({
      where,
      include: {
        department: true,
        assignee: true,
        approver: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Create CSV content
    const headers = [
      "Code",
      "Name",
      "Document Type",
      "Status",
      "Department",
      "Assignee",
      "Approver",
      "Recurrence",
      "Version",
      "Effective Date",
      "Review Date",
      "AI Review Status",
      "AI Review Score",
    ];

    const rows = policies.map((policy) => [
      policy.code || "",
      policy.name || "",
      policy.documentType || "",
      policy.status || "",
      policy.department?.name || "",
      policy.assignee?.fullName || "",
      policy.approver?.fullName || "",
      policy.recurrence || "",
      policy.version || "",
      policy.effectiveDate ? new Date(policy.effectiveDate).toLocaleDateString() : "",
      policy.reviewDate ? new Date(policy.reviewDate).toLocaleDateString() : "",
      policy.aiReviewStatus || "",
      policy.aiReviewScore?.toString() || "",
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
        "Content-Disposition": `attachment; filename="${documentType || "governance"}-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting policies:", error);
    return NextResponse.json(
      { error: "Failed to export policies" },
      { status: 500 }
    );
  }
}
