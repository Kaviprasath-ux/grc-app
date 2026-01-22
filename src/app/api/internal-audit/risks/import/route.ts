import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

// POST import internal audit risks from CSV
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV file must have at least a header and one data row" },
        { status: 400 }
      );
    }

    // Parse header
    const header = parseCSVLine(lines[0]);
    const expectedHeaders = [
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

    // Validate required headers exist
    const headerMap: Record<string, number> = {};
    header.forEach((h, i) => {
      headerMap[h.trim()] = i;
    });

    // Get departments and categories for lookup
    const departments = await prisma.department.findMany();
    const categories = await prisma.auditCategory.findMany();

    const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    // Get the last risk ID to continue numbering
    const lastRisk = await prisma.internalAuditRisk.findFirst({
      orderBy: { riskId: "desc" },
    });

    let nextNumber = 1;
    if (lastRisk && lastRisk.riskId) {
      const match = lastRisk.riskId.match(/RID(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const imported: string[] = [];
    const errors: string[] = [];

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);

        const getValue = (headerName: string) => {
          const index = headerMap[headerName];
          return index !== undefined ? values[index]?.trim() || null : null;
        };

        const riskDescription = getValue("Risk Description");
        if (!riskDescription) {
          errors.push(`Row ${i + 1}: Risk Description is required`);
          continue;
        }

        const departmentName = getValue("Department");
        const categoryName = getValue("Category");

        const departmentId = departmentName
          ? departmentMap.get(departmentName.toLowerCase()) || null
          : null;
        const categoryId = categoryName
          ? categoryMap.get(categoryName.toLowerCase()) || null
          : null;

        const inherentScore = parseInt(getValue("Inherent Score") || "") || null;
        const residualScore = parseInt(getValue("Residual Score") || "") || null;

        // Determine risk level based on residual score or use provided value
        let riskLevel = getValue("Risk Level") || "Low";
        if (residualScore && !getValue("Risk Level")) {
          if (residualScore >= 20) riskLevel = "Extreme";
          else if (residualScore >= 15) riskLevel = "High";
          else if (residualScore >= 10) riskLevel = "Medium";
          else riskLevel = "Low";
        }

        // Use provided Risk ID or generate one
        let riskId = getValue("Risk ID");
        if (!riskId) {
          riskId = `RID${String(nextNumber).padStart(3, "0")}`;
          nextNumber++;
        } else {
          // If risk ID is provided, update nextNumber if needed
          const match = riskId.match(/RID(\d+)/i);
          if (match) {
            const num = parseInt(match[1]);
            if (num >= nextNumber) {
              nextNumber = num + 1;
            }
          }
        }

        // Convert Year to creation date (Jan 1 of that year)
        const year = getValue("Year");
        const creationDate = year
          ? new Date(`${year}-01-01`)
          : new Date();

        await prisma.internalAuditRisk.create({
          data: {
            customerAccountId,
            riskId,
            riskName: riskDescription,
            riskDescription,
            departmentId,
            categoryId,
            inherentScore,
            residualScore,
            riskLevel,
            status: getValue("Status") || "Open",
            creationDate,
          },
        });

        imported.push(riskId);
      } catch (rowError) {
        console.error(`Error importing row ${i + 1}:`, rowError);
        errors.push(`Row ${i + 1}: Failed to import`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      details: { imported, errors },
    });
  } catch (error) {
    console.error("Error importing internal audit risks:", error);
    return NextResponse.json(
      { error: "Failed to import internal audit risks" },
      { status: 500 }
    );
  }
  },
  { resource: "audit.risk-register", action: "create" }
);

// Helper function to parse CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
