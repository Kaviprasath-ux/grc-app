import { NextRequest, NextResponse } from "next/server";

// GET download import template for internal audit risks
export async function GET(request: NextRequest) {
  try {
    // CSV header matching the import format
    const headers = [
      "Risk ID",
      "Year",
      "Risk Description",
      "Department",
      "Category",
      "Inherent Score",
      "Residual Score",
      "Risk Level",
      "Status",
    ];

    // Sample row to show the expected format
    const sampleRow = [
      "RISK-001",
      "2025",
      "Sample risk description",
      "Finance",
      "Operational",
      "16",
      "9",
      "Medium",
      "Open",
    ];

    // Build CSV content
    const csvContent = [
      headers.join(","),
      sampleRow.join(","),
    ].join("\n");

    // Return CSV response
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="risk-import-template.csv"',
      },
    });
  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
