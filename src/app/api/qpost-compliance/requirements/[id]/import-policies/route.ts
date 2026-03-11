import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { parseExcelFile, generateExcelTemplate, ColumnDefinition } from "@/lib/excel-import";
import { translateRecord } from "@/lib/translation-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Template columns (only what user needs to fill)
const TEMPLATE_COLUMNS = ["Policy Name", "Document Type", "Department", "Recurrence"];

// Parse columns
const POLICY_COLUMNS: ColumnDefinition[] = [
  { name: "Policy Name", required: true, type: "string" },
  { name: "Document Type", required: false, type: "string" },
  { name: "Department", required: false, type: "string" },
  { name: "Recurrence", required: false, type: "string" },
];

const VALID_RECURRENCES = ["yearly", "half-yearly", "quarterly", "monthly"];
const VALID_DOCUMENT_TYPES = ["policy", "standard", "procedure"];

interface PolicyRow extends Record<string, unknown> {
  "Policy Name": string;
  "Document Type": string;
  Department: string;
  Recurrence: string;
}

// GET - Download sample template
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const buffer = generateExcelTemplate(TEMPLATE_COLUMNS, "Governance");

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="governance-import-template.xlsx"',
        },
      });
    } catch (error) {
      console.error("Error generating governance template:", error);
      return NextResponse.json(
        { error: "Failed to generate template" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.governance", action: "view" }
);

// POST - Import policies from Excel and link to requirement
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
        return NextResponse.json(
          { error: "Requirement not found" },
          { status: 404 }
        );
      }

      if (requirement.customerAccountId !== customerAccountId) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Get uploaded file
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file uploaded" },
          { status: 400 }
        );
      }

      // Validate file type
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        return NextResponse.json(
          { error: "Invalid file format. Please upload an Excel file (.xlsx or .xls)" },
          { status: 400 }
        );
      }

      // Parse Excel
      const arrayBuffer = await file.arrayBuffer();
      const result = parseExcelFile<PolicyRow>(arrayBuffer, POLICY_COLUMNS);

      if (!result.success && result.errors.length > 0 && result.data.length === 0) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: result.errors.slice(0, 10),
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

      // Get reference data for lookups
      const departments = await prisma.department.findMany({ where: { customerAccountId } });
      const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

      // Import policies and link to requirement in a transaction
      const importResult = await prisma.$transaction(async (tx) => {
        let imported = 0;
        let skipped = 0;
        const rowErrors: string[] = [];

        for (let i = 0; i < result.data.length; i++) {
          const row = result.data[i];
          try {
            const name = row["Policy Name"]?.toString().trim();

            if (!name) {
              skipped++;
              continue;
            }

            const documentTypeRaw = row["Document Type"]?.toString().trim() || "";
            const departmentName = row.Department?.toString().trim();
            const recurrenceRaw = row.Recurrence?.toString().trim() || "";

            // Validate document type - default to "Policy"
            let documentType = "Policy";
            if (VALID_DOCUMENT_TYPES.includes(documentTypeRaw.toLowerCase())) {
              documentType = documentTypeRaw.charAt(0).toUpperCase() + documentTypeRaw.slice(1).toLowerCase();
            }

            // Validate recurrence - only accept valid values
            const recurrence = VALID_RECURRENCES.includes(recurrenceRaw.toLowerCase())
              ? recurrenceRaw.charAt(0).toUpperCase() + recurrenceRaw.slice(1).toLowerCase()
              : null;
            const recurrenceFinal = recurrence?.toLowerCase() === "half-yearly" ? "Half-yearly" : recurrence;

            // Look up department
            const departmentId = departmentName ? departmentMap.get(departmentName.toLowerCase()) || null : null;

            // Auto-generate code based on document type (same pattern as normal create)
            const prefix = documentType === "Standard" ? "STD" : documentType === "Procedure" ? "PRC" : "POL";
            const policyCode = `${prefix}-${Date.now()}-${i + 1}`;

            // Create policy with status "Not Uploaded"
            const policy = await tx.qPostPolicy.create({
              data: {
                customerAccountId,
                code: policyCode,
                name,
                documentType,
                recurrence: recurrenceFinal,
                status: "Not Uploaded",
                departmentId,
              },
            });

            // Link policy to requirement
            await tx.qPostRequirementPolicy.create({
              data: {
                requirementId,
                policyId: policy.id,
              },
            });

            imported++;
          } catch (rowError) {
            rowErrors.push(`Row ${i + 2}: ${rowError instanceof Error ? rowError.message : "Unknown error"}`);
            skipped++;
          }
        }

        return { imported, skipped, rowErrors };
      });

      // Trigger background translation for all imported policies
      if (importResult.imported > 0 && customerAccountId) {
        const importedPolicies = await prisma.qPostPolicy.findMany({
          where: { customerAccountId, requirements: { some: { requirementId } } },
          orderBy: { createdAt: "desc" },
          take: importResult.imported,
          select: { id: true, name: true },
        });
        for (const pol of importedPolicies) {
          void translateRecord(customerAccountId, "QPostPolicy", pol.id, {
            name: pol.name,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${importResult.imported} policies`,
        totalRows: result.totalRows,
        validRows: result.validRows,
        imported: importResult.imported,
        skipped: importResult.skipped,
        errors: importResult.rowErrors.length > 0 ? importResult.rowErrors.slice(0, 10) : undefined,
        parseErrors: result.errors.length > 0 ? result.errors.slice(0, 5) : undefined,
      });
    } catch (error) {
      console.error("Error importing QPost policies for requirement:", error);
      return NextResponse.json(
        { error: "Failed to import policies" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.governance", action: "create" }
);
