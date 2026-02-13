import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET export threat data - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const format = searchParams.get("format") || "csv";

      // Get tenant filter for multi-tenant isolation
      const tenantFilter = getTenantFilter(session);

      const threats = await prisma.riskThreat.findMany({
        where: tenantFilter,
        include: {
          category: true,
          _count: {
            select: { risks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      // Transform data for export
      const exportData = threats.map((threat) => ({
        "Name": threat.name,
        "Description": threat.description || "",
        "Category": threat.category?.name || "",
      }));

      if (format === "csv") {
        // Return CSV format
        const headers = ["Name", "Description", "Category"];
        const csvContent = [
          headers.join(","),
          ...exportData.map((row) =>
            headers
              .map((header) => {
                const value = String(row[header as keyof typeof row] || "");
                // Escape quotes and wrap in quotes if contains comma
                if (value.includes(",") || value.includes('"') || value.includes("\n")) {
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
            "Content-Disposition": "attachment; filename=Threats.csv",
          },
        });
      }

      // Return JSON format
      return NextResponse.json({
        data: exportData,
        metadata: {
          totalCount: exportData.length,
          exportDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error exporting threats:", error);
      return NextResponse.json(
        { error: "Failed to export threats" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);
