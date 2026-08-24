import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { validateUploadedFile } from "@/lib/upload-validation";
import { parseExcelFile, generateExcelTemplate, ColumnDefinition } from "@/lib/excel-import";
import { translateRecord } from "@/lib/translation-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const TEMPLATE_COLUMNS = ["Exception Name", "Description", "Category", "Department"];

// GET - Download sample template
export const GET = withAuth(
  async () => {
    try {
      const buffer = generateExcelTemplate(TEMPLATE_COLUMNS, "Exceptions");

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="exception-import-template.xlsx"',
        },
      });
    } catch (error) {
      console.error("Error generating exception template:", error);
      return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
  },
  { resource: "qpost-compliance.exceptions", action: "view" }
);

const EXCEPTION_COLUMNS: ColumnDefinition[] = [
  { name: "Exception Name", required: true, type: "string" },
  { name: "Description", required: false, type: "string" },
  { name: "Category", required: false, type: "string" },
  { name: "Department", required: false, type: "string" },
];

interface ExceptionRow extends Record<string, unknown> {
  "Exception Name": string;
  Description: string;
  Category: string;
  Department: string;
}

const VALID_CATEGORIES = ["Compliance", "Risk", "Policy"];

// POST - Import exceptions from Excel and link to requirement
export const POST = withAuth(
  async (request: NextRequest, context: RouteContext, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id: requirementId } = await context.params;

      // Check if requirement exists
      const requirement = await prisma.qPostRequirement.findUnique({
        where: { id: requirementId },
        select: { id: true, customerAccountId: true },
      });

      if (!requirement) {
        return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
      }

      if (requirement.customerAccountId !== customerAccountId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Get uploaded file
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        return NextResponse.json({ error: "Invalid file format. Please upload an Excel file (.xlsx or .xls)" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const result = parseExcelFile<ExceptionRow>(arrayBuffer, EXCEPTION_COLUMNS);

      if (!result.success && result.errors.length > 0 && result.data.length === 0) {
        return NextResponse.json({
          error: "Validation failed",
          details: result.errors.slice(0, 10),
          totalErrors: result.errors.length,
        }, { status: 400 });
      }

      if (result.data.length === 0) {
        return NextResponse.json({ error: "No valid data rows found in the Excel file" }, { status: 400 });
      }

      // Get reference data
      const departments = await prisma.department.findMany({ where: { customerAccountId } });
      const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

      // Import exceptions
      const importResult = await prisma.$transaction(async (tx) => {
        let imported = 0;
        let skipped = 0;

        for (let i = 0; i < result.data.length; i++) {
          const row = result.data[i];
          try {
            const name = row["Exception Name"]?.toString().trim();
            if (!name) { skipped++; continue; }

            const description = row.Description?.toString().trim() || null;
            const categoryRaw = row.Category?.toString().trim() || "Compliance";
            const category = VALID_CATEGORIES.includes(categoryRaw) ? categoryRaw : "Compliance";
            const departmentName = row.Department?.toString().trim();
            const status = "Pending"; // Default status for imported exceptions

            const departmentId = departmentName ? departmentMap.get(departmentName.toLowerCase()) || null : null;

            // Generate exception code
            const exceptionCode = `EXC-${Date.now()}-${i}`;

            const exception = await tx.qPostException.create({
              data: {
                customerAccountId: customerAccountId!,
                exceptionCode,
                name,
                description,
                category,
                departmentId,
                status,
                requirementId,
              },
            });

            // Trigger translation
            if (customerAccountId) {
              void translateRecord(customerAccountId, "QPostException", exception.id, {
                name: exception.name,
                description: exception.description || "",
              });
            }

            imported++;
          } catch (err) {
            console.error(`Error importing exception row ${i + 2}:`, err);
            skipped++;
          }
        }

        return { imported, skipped };
      });

      return NextResponse.json({
        message: `Successfully imported ${importResult.imported} exception(s)${importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ""}`,
        imported: importResult.imported,
        skipped: importResult.skipped,
      });
    } catch (error) {
      console.error("Error importing exceptions:", error);
      return NextResponse.json({ error: "Failed to import exceptions" }, { status: 500 });
    }
  },
  { resource: "qpost-compliance.exceptions", action: "create" }
);
