import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId, withAuthOnly } from "@/lib/api-auth";

// Required template columns in exact order
const TEMPLATE_COLUMNS = [
  "Name",
  "Description",
  "Category",
] as const;

// GET - Download import template (CSV with required columns only)
export const GET = withAuthOnly(async () => {
  try {
    // Create CSV template with required columns only (no sample data)
    const csvContent = TEMPLATE_COLUMNS.join(",");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=Threat-Import-Template.csv",
      },
    });
  } catch (error) {
    console.error("Error generating import template:", error);
    return NextResponse.json(
      { error: "Failed to generate import template" },
      { status: 500 }
    );
  }
});

// POST - Import threats from uploaded data
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found. Cannot import threats." },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { data, columns } = body;

      if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json(
          { error: "No data provided. Please upload a file with at least one row of data." },
          { status: 400 }
        );
      }

      // Validate columns match the required template
      if (columns && Array.isArray(columns)) {
        const normalizedColumns = columns.map((c: string) => c.toLowerCase().trim());
        const requiredColumns = TEMPLATE_COLUMNS.map((c) => c.toLowerCase());

        const missingColumns = requiredColumns.filter(
          (req) => !normalizedColumns.some((col: string) => col === req)
        );

        if (missingColumns.length > 0) {
          return NextResponse.json(
            {
              error: `Invalid template. Missing required columns: ${missingColumns.join(", ")}. Please download and use the correct template.`,
            },
            { status: 400 }
          );
        }
      }

      // Fetch existing lookup data for caching
      const [existingThreats, existingCategories] = await Promise.all([
        prisma.riskThreat.findMany({
          where: { customerAccountId },
        }),
        prisma.threatCategory.findMany({
          where: { customerAccountId },
        }),
      ]);

      // Mutable caches for created entities during import
      const threatsCache = [...existingThreats];
      const categoriesCache = [...existingCategories];

      const results = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [] as { row: number; error: string }[],
        created: [] as { name: string }[],
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2; // +2 because row 1 is header, data starts at row 2

        try {
          // Get column values (case-insensitive matching)
          const getValue = (columnName: string): string => {
            const key = Object.keys(row).find(
              (k) => k.toLowerCase().trim() === columnName.toLowerCase()
            );
            return key ? String(row[key] || "").trim() : "";
          };

          const name = getValue("Name");
          const description = getValue("Description");
          const categoryName = getValue("Category");

          // Skip empty rows
          if (!name && !description) {
            continue;
          }

          // Validate required field: Name
          if (!name) {
            results.errors.push({ row: rowNum, error: "Name is required" });
            results.failed++;
            continue;
          }

          // Check for duplicate
          const existingThreat = threatsCache.find(
            (t) => t.name.toLowerCase() === name.toLowerCase()
          );

          if (existingThreat) {
            results.skipped++;
            continue;
          }

          // Handle Category - find existing or create new
          let category = null;
          if (categoryName) {
            category = categoriesCache.find(
              (c) => c.name.toLowerCase() === categoryName.toLowerCase()
            );

            if (!category) {
              // Create new category
              category = await prisma.threatCategory.create({
                data: {
                  customerAccountId,
                  name: categoryName,
                },
              });
              categoriesCache.push(category);
            }
          }

          // Create the threat
          const threat = await prisma.riskThreat.create({
            data: {
              customerAccountId,
              name,
              description: description || null,
              categoryId: category?.id || null,
            },
          });

          threatsCache.push(threat);
          results.success++;
          results.created.push({ name: threat.name });
        } catch (error) {
          console.error(`Error importing row ${rowNum}:`, error);
          results.errors.push({
            row: rowNum,
            error: error instanceof Error ? error.message : "Unknown error occurred",
          });
          results.failed++;
        }
      }

      // Return appropriate response based on results
      if (results.success === 0 && results.failed > 0) {
        return NextResponse.json(
          {
            error: "Import failed. No threats were created.",
            results,
          },
          { status: 400 }
        );
      }

      let message = `Successfully imported ${results.success} threat(s)`;
      if (results.skipped > 0) {
        message += `, ${results.skipped} skipped (duplicates)`;
      }
      if (results.failed > 0) {
        message += `, ${results.failed} failed`;
      }

      return NextResponse.json({
        message,
        results,
      });
    } catch (error) {
      console.error("Error importing threats:", error);
      return NextResponse.json(
        { error: "Failed to import threats. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
