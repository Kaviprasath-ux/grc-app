import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST import controls from CSV
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
    const controlDomains = await prisma.controlDomain.findMany();

    const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const userMap = new Map(users.map((u) => [u.fullName.toLowerCase(), u.id]));
    const frameworkMap = new Map(frameworks.map((f) => [f.name.toLowerCase(), f.id]));
    const domainMap = new Map(controlDomains.map((d) => [d.name.toLowerCase(), d.id]));

    // Get existing control codes to avoid duplicates
    const existingControls = await prisma.control.findMany({
      select: { controlCode: true },
    });
    const existingCodes = new Set(existingControls.map((c) => c.controlCode));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);

        const controlCode = getValue(values, headerMap, "control code");
        const name = getValue(values, headerMap, "control name") || getValue(values, headerMap, "name");

        // Skip if no name
        if (!name) {
          skipped++;
          continue;
        }

        // Skip if control code already exists
        if (controlCode && existingCodes.has(controlCode)) {
          skipped++;
          continue;
        }

        const description = getValue(values, headerMap, "description");
        const controlQuestion = getValue(values, headerMap, "control question");
        const functionalGrouping = getValue(values, headerMap, "functional grouping");
        const status = getValue(values, headerMap, "status") || "Non Compliant";
        const entities = getValue(values, headerMap, "entities") || "Organization Wide";
        const scope = getValue(values, headerMap, "scope");
        const domainName = getValue(values, headerMap, "domain");
        const departmentName = getValue(values, headerMap, "department");
        const ownerName = getValue(values, headerMap, "owner");
        const assigneeName = getValue(values, headerMap, "assignee");
        const frameworkName = getValue(values, headerMap, "framework");

        // Look up foreign keys
        const departmentId = departmentName ? departmentMap.get(departmentName.toLowerCase()) : null;
        const ownerId = ownerName ? userMap.get(ownerName.toLowerCase()) : null;
        const assigneeId = assigneeName ? userMap.get(assigneeName.toLowerCase()) : null;
        const frameworkId = frameworkName ? frameworkMap.get(frameworkName.toLowerCase()) : null;
        const domainId = domainName ? domainMap.get(domainName.toLowerCase()) : null;

        // Generate control code if not provided
        const newControlCode = controlCode || `CTRL-${Date.now()}-${i}`;

        // Create control
        await prisma.control.create({
          data: {
            controlCode: newControlCode,
            name,
            description: description || null,
            controlQuestion: controlQuestion || null,
            functionalGrouping: functionalGrouping || null,
            status: status || "Non Compliant",
            entities: entities || "Organization Wide",
            scope: scope || null,
            departmentId: departmentId || null,
            ownerId: ownerId || null,
            assigneeId: assigneeId || null,
            frameworkId: frameworkId || null,
            domainId: domainId || null,
          },
        });

        existingCodes.add(newControlCode);
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
    console.error("Error importing controls:", error);
    return NextResponse.json(
      { message: "Failed to import controls" },
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
