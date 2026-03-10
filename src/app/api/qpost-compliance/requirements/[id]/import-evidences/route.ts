import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { parseExcelFile, generateExcelTemplate, ColumnDefinition } from "@/lib/excel-import";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Template columns (only what user needs to fill)
const TEMPLATE_COLUMNS = ["Evidence Name", "Description", "Department", "Recurrence"];

// Parse columns (what we accept in the uploaded file)
const EVIDENCE_COLUMNS: ColumnDefinition[] = [
  { name: "Evidence Name", required: true, type: "string" },
  { name: "Description", required: false, type: "string" },
  { name: "Department", required: false, type: "string" },
  { name: "Recurrence", required: false, type: "string" },
];

const VALID_RECURRENCES = ["yearly", "half-yearly", "quarterly", "monthly"];

interface EvidenceRow extends Record<string, unknown> {
  "Evidence Name": string;
  Description: string;
  Department: string;
  Recurrence: string;
}

// GET - Download sample template
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const buffer = generateExcelTemplate(TEMPLATE_COLUMNS, "Evidences");

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="evidence-import-template.xlsx"',
        },
      });
    } catch (error) {
      console.error("Error generating evidence template:", error);
      return NextResponse.json(
        { error: "Failed to generate template" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);

// POST - Import evidences from Excel and link to requirement
export const POST = withAuth(
  async (request: NextRequest, context: RouteContext, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { id: requirementId } = await context.params;

      // Check if requirement exists
      const requirement = await prisma.qPostRequirement.findUnique({
        where: { id: requirementId },
        select: { id: true, customerAccountId: true, frameworkId: true },
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
      const result = parseExcelFile<EvidenceRow>(arrayBuffer, EVIDENCE_COLUMNS);

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

      // Import evidences and link to requirement in a transaction
      const importResult = await prisma.$transaction(async (tx) => {
        let imported = 0;
        let skipped = 0;
        const rowErrors: string[] = [];

        for (let i = 0; i < result.data.length; i++) {
          const row = result.data[i];
          try {
            const name = row["Evidence Name"]?.toString().trim();

            if (!name) {
              skipped++;
              continue;
            }

            const description = row.Description?.toString().trim() || null;
            const departmentName = row.Department?.toString().trim();
            const recurrenceRaw = row.Recurrence?.toString().trim() || "";

            // Validate recurrence - only accept valid values, otherwise set to null
            const recurrence = VALID_RECURRENCES.includes(recurrenceRaw.toLowerCase())
              ? recurrenceRaw.charAt(0).toUpperCase() + recurrenceRaw.slice(1).toLowerCase()
              : null;

            // Fix casing for Half-yearly
            const recurrenceFinal = recurrence?.toLowerCase() === "half-yearly" ? "Half-yearly" : recurrence;

            // Look up department
            const departmentId = departmentName ? departmentMap.get(departmentName.toLowerCase()) || null : null;

            // Auto-generate evidence code (same pattern as normal create)
            const evidenceCode = `E-${Date.now()}-${i + 1}`;

            // Create evidence with status "Not Uploaded"
            const evidence = await tx.qPostEvidence.create({
              data: {
                customerAccountId,
                evidenceCode,
                name,
                description,
                status: "Not Uploaded",
                recurrence: recurrenceFinal,
                departmentId,
                frameworkId: requirement.frameworkId || null,
              },
            });

            // Link evidence to requirement
            await tx.qPostRequirementEvidence.create({
              data: {
                requirementId,
                evidenceId: evidence.id,
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

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${importResult.imported} evidences`,
        totalRows: result.totalRows,
        validRows: result.validRows,
        imported: importResult.imported,
        skipped: importResult.skipped,
        errors: importResult.rowErrors.length > 0 ? importResult.rowErrors.slice(0, 10) : undefined,
        parseErrors: result.errors.length > 0 ? result.errors.slice(0, 5) : undefined,
      });
    } catch (error) {
      console.error("Error importing QPost evidences for requirement:", error);
      return NextResponse.json(
        { error: "Failed to import evidences" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "create" }
);
