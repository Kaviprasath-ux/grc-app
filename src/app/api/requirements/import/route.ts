import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const frameworkId = formData.get("frameworkId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!frameworkId) {
      return NextResponse.json(
        { error: "Framework ID is required" },
        { status: 400 }
      );
    }

    // Verify framework exists
    const framework = await prisma.framework.findUnique({
      where: { id: frameworkId },
    });

    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    // Read and parse CSV file
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV file must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // Parse header
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const codeIndex = header.findIndex((h) => h === "code");
    const nameIndex = header.findIndex((h) => h === "name");
    const descriptionIndex = header.findIndex((h) => h === "description");
    const requirementTypeIndex = header.findIndex((h) => h.includes("requirement type") || h === "requirementtype");
    const chapterTypeIndex = header.findIndex((h) => h.includes("chapter type") || h === "chaptertype");
    const applicabilityIndex = header.findIndex((h) => h === "applicability");
    const implementationStatusIndex = header.findIndex((h) => h.includes("implementation") || h === "implementationstatus");

    if (codeIndex === -1 || nameIndex === -1) {
      return NextResponse.json(
        { error: "CSV must have 'Code' and 'Name' columns" },
        { status: 400 }
      );
    }

    // Parse data rows
    const requirements = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      const code = values[codeIndex]?.trim();
      const name = values[nameIndex]?.trim();

      if (!code || !name) continue;

      requirements.push({
        code,
        name,
        description: descriptionIndex !== -1 ? values[descriptionIndex]?.trim() || null : null,
        requirementType: requirementTypeIndex !== -1 ? values[requirementTypeIndex]?.trim() || "Mandatory" : "Mandatory",
        chapterType: chapterTypeIndex !== -1 ? values[chapterTypeIndex]?.trim() || "Domain" : "Domain",
        applicability: applicabilityIndex !== -1 ? values[applicabilityIndex]?.trim() || null : null,
        implementationStatus: implementationStatusIndex !== -1 ? values[implementationStatusIndex]?.trim() || null : null,
        frameworkId,
        sortOrder: i,
      });
    }

    if (requirements.length === 0) {
      return NextResponse.json(
        { error: "No valid requirements found in CSV" },
        { status: 400 }
      );
    }

    // Import requirements (upsert to handle duplicates)
    const imported = [];
    for (const req of requirements) {
      const result = await prisma.requirement.upsert({
        where: {
          frameworkId_code: {
            frameworkId: req.frameworkId,
            code: req.code,
          },
        },
        update: {
          name: req.name,
          description: req.description,
          requirementType: req.requirementType,
          chapterType: req.chapterType,
          applicability: req.applicability,
          implementationStatus: req.implementationStatus,
        },
        create: req,
      });
      imported.push(result);
    }

    return NextResponse.json({
      message: `Successfully imported ${imported.length} requirements`,
      count: imported.length,
    });
  } catch (error) {
    console.error("Error importing requirements:", error);
    return NextResponse.json(
      { error: "Failed to import requirements" },
      { status: 500 }
    );
  }
}

// Helper function to parse CSV line handling quoted fields
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
