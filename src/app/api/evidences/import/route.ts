import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST import evidences from CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { message: "CSV file is empty or has no data rows" },
        { status: 400 }
      );
    }

    // Parse header
    const headers = parseCSVLine(lines[0]);
    const headerMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      headerMap[header.toLowerCase().trim()] = index;
    });

    // Get reference data for lookups
    const departments = await prisma.department.findMany();
    const users = await prisma.user.findMany();
    const frameworks = await prisma.framework.findMany();

    const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const userMap = new Map(users.map((u) => [u.fullName.toLowerCase(), u.id]));
    const frameworkMap = new Map(frameworks.map((f) => [f.name.toLowerCase(), f.id]));

    // Get existing evidence codes to avoid duplicates
    const existingEvidences = await prisma.evidence.findMany({
      select: { evidenceCode: true },
    });
    const existingCodes = new Set(existingEvidences.map((e) => e.evidenceCode));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);

        const evidenceCode = getValue(values, headerMap, "evidence code");
        const name = getValue(values, headerMap, "evidence name");

        // Skip if no name
        if (!name) {
          skipped++;
          continue;
        }

        // Skip if evidence code already exists
        if (evidenceCode && existingCodes.has(evidenceCode)) {
          skipped++;
          continue;
        }

        const description = getValue(values, headerMap, "description");
        const domain = getValue(values, headerMap, "domain");
        const status = getValue(values, headerMap, "status") || "Pending";
        const departmentName = getValue(values, headerMap, "department");
        const assigneeName = getValue(values, headerMap, "assignee");
        const recurrence = getValue(values, headerMap, "recurrence");
        const frameworkName = getValue(values, headerMap, "framework");
        const kpiRequired = getValue(values, headerMap, "kpi required")?.toLowerCase() === "yes";

        // Look up foreign keys
        const departmentId = departmentName ? departmentMap.get(departmentName.toLowerCase()) : null;
        const assigneeId = assigneeName ? userMap.get(assigneeName.toLowerCase()) : null;
        const frameworkId = frameworkName ? frameworkMap.get(frameworkName.toLowerCase()) : null;

        // Generate evidence code if not provided
        const newEvidenceCode = evidenceCode || `EVD-${Date.now()}-${i}`;

        // Create evidence
        await prisma.evidence.create({
          data: {
            evidenceCode: newEvidenceCode,
            name,
            description: description || null,
            domain: domain || null,
            status: status || "Pending",
            recurrence: recurrence || null,
            departmentId: departmentId || null,
            assigneeId: assigneeId || null,
            frameworkId: frameworkId || null,
            kpiRequired,
          },
        });

        existingCodes.add(newEvidenceCode);
        imported++;
      } catch (rowError) {
        errors.push(`Row ${i + 1}: ${rowError instanceof Error ? rowError.message : "Unknown error"}`);
        skipped++;
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error importing evidences:", error);
    return NextResponse.json(
      { message: "Failed to import evidences" },
      { status: 500 }
    );
  }
}

// Helper function to parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// Helper function to get value from parsed row
function getValue(values: string[], headerMap: Record<string, number>, headerName: string): string | undefined {
  const index = headerMap[headerName];
  if (index !== undefined && index < values.length) {
    return values[index] || undefined;
  }
  return undefined;
}
