import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET export vulnerability data - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const format = searchParams.get("format") || "csv";

      // Get tenant filter for multi-tenant isolation
      const tenantFilter = getTenantFilter(session);

      const vulnerabilities = await prisma.riskVulnerability.findMany({
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
      const exportData = vulnerabilities.map((vuln) => ({
        "Vulnerability ID": vuln.vulnId || "",
        "Name": vuln.name,
        "Description": vuln.description || "",
        "Category": vuln.category?.name || "",
        "Associated Risks": vuln._count?.risks || 0,
      }));

      if (format === "csv") {
        // Return CSV format
        const headers = ["Vulnerability ID", "Name", "Description", "Category", "Associated Risks"];
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
            "Content-Disposition": "attachment; filename=Vulnerabilities.csv",
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
      console.error("Error exporting vulnerabilities:", error);
      return NextResponse.json(
        { error: "Failed to export vulnerabilities" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);
