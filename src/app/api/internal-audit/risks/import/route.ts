import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST import internal audit risks from CSV
export async function POST(request: NextRequest) {
  try {
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
      "Risk Name",
      "Risk Description",
      "Department",
      "Category",
      "Audit Type",
    ];

    // Validate required headers exist
    const headerMap: Record<string, number> = {};
    header.forEach((h, i) => {
      headerMap[h.trim()] = i;
    });

    // Get departments and categories for lookup
    const departments = await prisma.department.findMany();
    const categories = await prisma.auditCategory.findMany();
    const auditTypes = await prisma.auditType.findMany();

    const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const auditTypeMap = new Map(auditTypes.map((a) => [a.name.toLowerCase(), a.id]));

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

        const riskName = getValue("Risk Name");
        if (!riskName) {
          errors.push(`Row ${i + 1}: Risk Name is required`);
          continue;
        }

        const departmentName = getValue("Department");
        const categoryName = getValue("Category");
        const auditTypeName = getValue("Audit Type");

        const departmentId = departmentName
          ? departmentMap.get(departmentName.toLowerCase()) || null
          : null;
        const categoryId = categoryName
          ? categoryMap.get(categoryName.toLowerCase()) || null
          : null;
        const auditTypeId = auditTypeName
          ? auditTypeMap.get(auditTypeName.toLowerCase()) || null
          : null;

        const inherentLikelihood = parseInt(getValue("Inherent Likelihood") || "") || null;
        const inherentImpact = parseInt(getValue("Inherent Impact") || "") || null;
        const residualLikelihood = parseInt(getValue("Residual Likelihood") || "") || null;
        const residualImpact = parseInt(getValue("Residual Impact") || "") || null;

        const inherentScore = inherentLikelihood && inherentImpact
          ? inherentLikelihood * inherentImpact
          : parseInt(getValue("Inherent Score") || "") || null;

        const residualScore = residualLikelihood && residualImpact
          ? residualLikelihood * residualImpact
          : parseInt(getValue("Residual Score") || "") || null;

        // Determine risk level based on residual score
        let riskLevel = getValue("Risk Level") || "Low";
        if (residualScore && !getValue("Risk Level")) {
          if (residualScore >= 250) riskLevel = "Extreme";
          else if (residualScore >= 100) riskLevel = "High";
          else if (residualScore >= 50) riskLevel = "Medium";
          else riskLevel = "Low";
        }

        const riskId = `RID${String(nextNumber).padStart(3, "0")}`;
        nextNumber++;

        await prisma.internalAuditRisk.create({
          data: {
            riskId,
            riskName,
            riskDescription: getValue("Risk Description"),
            departmentId,
            categoryId,
            auditTypeId,
            sectionProcess: getValue("Section/Process"),
            subProcess: getValue("Sub Process"),
            activity: getValue("Activity"),
            inherentLikelihood,
            inherentImpact,
            inherentScore,
            controlDescription: getValue("Control Description"),
            controlEffectiveness: getValue("Control Effectiveness"),
            residualLikelihood,
            residualImpact,
            residualScore,
            riskLevel,
            status: getValue("Status") || "Open",
            creationDate: getValue("Creation Date")
              ? new Date(getValue("Creation Date")!)
              : new Date(),
            auditComment: getValue("Audit Comment"),
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
}

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
