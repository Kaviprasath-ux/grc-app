import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { parseExcelFile, ColumnDefinition, ValidationError } from "@/lib/excel-import";
import { validateUploadedFile } from "@/lib/upload-validation";

// Column definitions for framework requirements import
const REQUIREMENT_COLUMNS: ColumnDefinition[] = [
  { name: "Requirement Category", required: true, type: "string" },
  { name: "Requirement code", required: true, type: "string" },
  { name: "Requirement", required: true, type: "string" },
  { name: "Description", required: false, type: "string" },
  { name: "Control mapping", required: false, type: "string" },
  { name: "Requirement type", required: false, type: "string" },
  { name: "Chapter type", required: false, type: "string" },
];

interface RequirementRow extends Record<string, unknown> {
  "Requirement Category": string;
  "Requirement code": string;
  "Requirement": string;
  Description: string;
  "Control mapping": string;
  "Requirement type": string;
  "Chapter type": string;
}

/**
 * Parse control mapping string to extract individual control references
 * Supports comma, semicolon, and newline separators
 * De-duplicates tokens (case-insensitive) within the same row
 */
function parseControlMapping(controlMapping: string): string[] {
  if (!controlMapping || controlMapping.trim() === "") {
    return [];
  }

  // Split by comma, semicolon, or newline
  const tokens = controlMapping
    .split(/[,;\n]/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  // De-duplicate tokens (case-insensitive), keeping first occurrence
  const seen = new Set<string>();
  const uniqueTokens: string[] = [];
  for (const token of tokens) {
    const lowerToken = token.toLowerCase();
    if (!seen.has(lowerToken)) {
      seen.add(lowerToken);
      uniqueTokens.push(token);
    }
  }

  return uniqueTokens;
}

/**
 * Generate a unique control code for auto-created controls
 */
function generateControlCode(existingCodes: Set<string>, baseName: string, serialCounter: { value: number }): string {
  // UC-GEN-NNNN-YYYY format (no functional grouping available during framework import)
  const year = new Date().getFullYear();
  serialCounter.value++;
  let code = `UC-GEN-${String(serialCounter.value).padStart(4, "0")}-${year}`;

  // Ensure uniqueness
  let counter = serialCounter.value;
  while (existingCodes.has(code.toLowerCase())) {
    counter++;
    serialCounter.value = counter;
    code = `UC-GEN-${String(counter).padStart(4, "0")}-${year}`;
  }

  return code;
}

// POST import requirements from Excel
export const POST = withAuth(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id: frameworkId } = await context.params;

    // Check if framework exists
    const framework = await prisma.framework.findUnique({
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

    // Track row numbers for error reporting
    const rowNumberMap = new Map<string, number>();
    result.data.forEach((row, index) => {
      rowNumberMap.set(row["Requirement code"], index + 2); // +2 for header row and 0-index
    });

    // Fetch all existing controls for efficient lookup
    const allControls = await prisma.control.findMany({
      select: {
        id: true,
        controlCode: true,
        name: true,
      },
    });

    // Create lookup maps for controls (case-insensitive)
    const controlByCode = new Map<string, { id: string; controlCode: string; name: string }>();
    const controlByName = new Map<string, { id: string; controlCode: string; name: string }>();
    const existingControlCodes = new Set<string>();
    let maxUCSerial = 0;
    for (const control of allControls) {
      controlByCode.set(control.controlCode.toLowerCase(), control);
      controlByName.set(control.name.toLowerCase(), control);
      existingControlCodes.add(control.controlCode.toLowerCase());
      const m = control.controlCode.match(/UC-[A-Z]{3}-(\d+)-\d{4}/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxUCSerial) maxUCSerial = n; }
    }
    const serialCounter = { value: maxUCSerial };

    // Collect control mapping errors (only for actual failures, not "not found")
    const controlMappingErrors: ValidationError[] = [];

    // Create categories and requirements in transaction
    const importResult = await prisma.$transaction(async (tx) => {
      let count = 0;
      let sortOrder = 0;
      let controlMappingsCreated = 0;
      let controlsCreated = 0;
      const createdRequirements: { id: string; code: string; controlRefs: string[] }[] = [];

      const categoryEntries = Array.from(categoryMap.entries());
      for (const [categoryName, requirements] of categoryEntries) {
        // Create or find category
        let category = await tx.requirementCategory.findFirst({
          where: {
            frameworkId,
            name: categoryName,
          },
        });

        if (!category) {
          category = await tx.requirementCategory.create({
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
          const existingReq = await tx.requirement.findFirst({
            where: {
              frameworkId,
              code: req["Requirement code"],
            },
          });

          let requirementId: string;

          const requirementType = req["Requirement type"]?.trim() || undefined;
          const chapterType = req["Chapter type"]?.trim() || undefined;

          if (!existingReq) {
            const newReq = await tx.requirement.create({
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
            requirementId = newReq.id;
            count++;
          } else {
            requirementId = existingReq.id;
          }

          // Parse and store control references for later processing
          const controlRefs = parseControlMapping(req["Control mapping"]);
          if (controlRefs.length > 0) {
            createdRequirements.push({
              id: requirementId,
              code: req["Requirement code"],
              controlRefs,
            });
          }
        }
      }

      // Process control mappings after all requirements are created
      for (const reqInfo of createdRequirements) {
        const rowNum = rowNumberMap.get(reqInfo.code) || 0;

        for (const controlRef of reqInfo.controlRefs) {
          // Look up control by code first (case-insensitive), then by name
          let control = controlByCode.get(controlRef.toLowerCase());
          if (!control) {
            control = controlByName.get(controlRef.toLowerCase());
          }

          // If control not found, auto-create it
          if (!control) {
            try {
              // Generate a unique control code
              const newControlCode = generateControlCode(existingControlCodes, controlRef, serialCounter);
              existingControlCodes.add(newControlCode.toLowerCase());

              // Create the new control with required defaults
              const newControl = await tx.control.create({
                data: {
                  customerAccountId,
                  controlCode: newControlCode,
                  name: controlRef, // Use exact trimmed token value
                  status: "Non Compliant", // Default status from schema
                  entities: "Organization Wide", // Default from schema
                  isControlList: false, // Default from schema
                },
              });

              // Add to lookup maps for reuse in subsequent rows
              control = {
                id: newControl.id,
                controlCode: newControl.controlCode,
                name: newControl.name,
              };
              controlByCode.set(newControl.controlCode.toLowerCase(), control);
              controlByName.set(newControl.name.toLowerCase(), control);
              controlsCreated++;
            } catch (createError) {
              // Only add error if control creation actually fails
              controlMappingErrors.push({
                row: rowNum,
                column: "Control mapping",
                message: `Failed to create control "${controlRef}" for requirement "${reqInfo.code}": ${createError instanceof Error ? createError.message : "Unknown error"}`,
              });
              continue; // Skip to next control token
            }
          }

          // Create the Requirement ↔ Control association
          try {
            // Check if mapping already exists
            const existingMapping = await tx.requirementControl.findUnique({
              where: {
                requirementId_controlId: {
                  requirementId: reqInfo.id,
                  controlId: control.id,
                },
              },
            });

            if (!existingMapping) {
              await tx.requirementControl.create({
                data: {
                  requirementId: reqInfo.id,
                  controlId: control.id,
                },
              });
              controlMappingsCreated++;
            }
          } catch (linkError) {
            controlMappingErrors.push({
              row: rowNum,
              column: "Control mapping",
              message: `Failed to link control "${controlRef}" to requirement "${reqInfo.code}": ${linkError instanceof Error ? linkError.message : "Unknown error"}`,
            });
          }
        }
      }

      return { count, controlMappingsCreated, controlsCreated };
    });

    // Combine all errors (only actual failures, not "not found" since those are auto-created)
    const allErrors = [...result.errors, ...controlMappingErrors];

    // Build success message with summary
    const messageParts = [`Successfully imported ${importResult.count} requirements`];
    if (importResult.controlsCreated > 0) {
      messageParts.push(`${importResult.controlsCreated} controls created`);
    }
    if (importResult.controlMappingsCreated > 0) {
      messageParts.push(`${importResult.controlMappingsCreated} control mappings`);
    }
    const message = messageParts.join(", ");

    return NextResponse.json({
      success: true,
      message,
      totalRows: result.totalRows,
      validRows: result.validRows,
      importedCount: importResult.count,
      controlsCreated: importResult.controlsCreated,
      controlMappingsCreated: importResult.controlMappingsCreated,
      errors: allErrors.length > 0 ? allErrors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error importing requirements:", error);
    return NextResponse.json(
      { error: "Failed to import requirements" },
      { status: 500 }
    );
  }
  },
  { resource: "compliance.framework", action: "create" }
);
