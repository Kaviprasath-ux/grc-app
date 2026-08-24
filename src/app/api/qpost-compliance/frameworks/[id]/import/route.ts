import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { validateUploadedFile } from "@/lib/upload-validation";
import { parseExcelFile, ColumnDefinition } from "@/lib/excel-import";

// Column definitions for framework requirements import
const REQUIREMENT_COLUMNS: ColumnDefinition[] = [
  { name: "Requirement Category", required: true, type: "string" },
  { name: "Requirement code", required: true, type: "string" },
  { name: "Requirement", required: true, type: "string" },
  { name: "Description", required: false, type: "string" },
  { name: "Requirement type", required: false, type: "string" },
  { name: "Chapter type", required: false, type: "string" },
];

interface RequirementRow extends Record<string, unknown> {
  "Requirement Category": string;
  "Requirement code": string;
  "Requirement": string;
  Description: string;
  "Requirement type": string;
  "Chapter type": string;
}

// POST import requirements from Excel
export const POST = withAuth(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id: frameworkId } = await context.params;

    // Check if framework exists
    const framework = await prisma.qPostFramework.findUnique({
      where: { id: frameworkId },
    });

    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    // Validate tenant access - users can only import into their own frameworks
    if (framework.customerAccountId !== customerAccountId) {
      return NextResponse.json(
        { error: "Access denied. You can only import into frameworks in your own account." },
        { status: 403 }
      );
    }

    // Get the uploaded file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const check = validateUploadedFile(file);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload an Excel file (.xlsx)" },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse Excel file
    const result = parseExcelFile<RequirementRow>(arrayBuffer, REQUIREMENT_COLUMNS);

    if (!result.success && result.errors.length > 0 && result.data.length === 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.errors.slice(0, 10), // Return first 10 errors
          totalErrors: result.errors.length,
        },
        { status: 400 }
      );
    }

    if (result.data.length === 0) {
      return NextResponse.json(
        { error: "No valid data rows found in the Excel file" },
        { status: 400 }
      );
    }

    // Group requirements by category
    const categoryMap = new Map<string, RequirementRow[]>();
    for (const row of result.data) {
      const category = row["Requirement Category"];
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(row);
    }

    // Create categories and requirements in transaction
    const importResult = await prisma.$transaction(async (tx) => {
      let count = 0;
      let sortOrder = 0;

      const categoryEntries = Array.from(categoryMap.entries());
      for (const [categoryName, requirements] of categoryEntries) {
        // Create or find category
        let category = await tx.qPostRequirementCategory.findFirst({
          where: {
            frameworkId,
            name: categoryName,
          },
        });

        if (!category) {
          category = await tx.qPostRequirementCategory.create({
            data: {
              customerAccountId,
              name: categoryName,
              frameworkId,
              sortOrder: sortOrder++,
            },
          });
        }

        // Create requirements
        for (const req of requirements) {
          // Check if requirement with same code already exists
          const existingReq = await tx.qPostRequirement.findFirst({
            where: {
              frameworkId,
              code: req["Requirement code"],
            },
          });

          const requirementType = req["Requirement type"]?.trim() || undefined;
          const chapterType = req["Chapter type"]?.trim() || undefined;

          if (!existingReq) {
            await tx.qPostRequirement.create({
              data: {
                customerAccountId,
                code: req["Requirement code"],
                name: req["Requirement"],
                description: req.Description || null,
                ...(requirementType && { requirementType }),
                ...(chapterType && { chapterType }),
                frameworkId,
                categoryId: category.id,
                level: 2,
                sortOrder: count,
              },
            });
            count++;
          }
        }
      }

      return { count };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importResult.count} requirements`,
      totalRows: result.totalRows,
      validRows: result.validRows,
      importedCount: importResult.count,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error importing QPost requirements:", error);
    return NextResponse.json(
      { error: "Failed to import requirements" },
      { status: 500 }
    );
  }
  },
  { resource: "qpost-compliance.framework", action: "create" }
);
