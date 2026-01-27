import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId, withAuthOnly } from "@/lib/api-auth";

// Required template columns in exact order
const TEMPLATE_COLUMNS = [
  "Risk name",
  "Risk description",
  "Department",
  "Risk sources",
  "Risk category",
  "Potential threat",
  "Associated vulnerabilities",
] as const;

// Helper function to calculate risk rating based on score
function calculateRiskRating(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

// Helper function to generate risk ID
async function generateRiskId(customerAccountId: string): Promise<string> {
  const lastRisk = await prisma.risk.findFirst({
    where: { customerAccountId },
    orderBy: { createdAt: "desc" },
    select: { riskId: true },
  });

  if (!lastRisk) {
    return "RID001";
  }

  const match = lastRisk.riskId.match(/RID(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `RID${String(nextNum).padStart(3, "0")}`;
  }

  const count = await prisma.risk.count({ where: { customerAccountId } });
  return `RID${String(count + 1).padStart(3, "0")}`;
}

// GET - Download import template (CSV with required columns only - no sample data)
export const GET = withAuthOnly(async () => {
  try {
    // Create CSV template with required columns only (no sample data)
    const csvContent = TEMPLATE_COLUMNS.join(",");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=Risk-Import-Template.csv",
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

// POST - Import risks from uploaded data
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found. Cannot import risks." },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { data, columns, actor = session?.name || "System" } = body;

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

      // Fetch existing lookup data for caching (will be updated as we create new entities)
      const [existingCategories, existingDepartments, existingThreats, existingVulnerabilities] = await Promise.all([
        prisma.riskCategory.findMany({
          where: { customerAccountId },
        }),
        prisma.department.findMany({
          where: { customerAccountId },
        }),
        prisma.riskThreat.findMany({
          where: { customerAccountId },
        }),
        prisma.riskVulnerability.findMany({
          where: { customerAccountId },
        }),
      ]);

      // Mutable caches for created entities during import
      const categoriesCache = [...existingCategories];
      const departmentsCache = [...existingDepartments];
      const threatsCache = [...existingThreats];
      const vulnerabilitiesCache = [...existingVulnerabilities];

      const results = {
        success: 0,
        failed: 0,
        errors: [] as { row: number; error: string }[],
        created: [] as { riskId: string; name: string }[],
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

          const riskName = getValue("Risk name");
          const riskDescription = getValue("Risk description");
          const departmentName = getValue("Department");
          const riskSources = getValue("Risk sources");
          const riskCategoryName = getValue("Risk category");
          const potentialThreat = getValue("Potential threat");
          const associatedVulnerabilities = getValue("Associated vulnerabilities");

          // Skip empty rows
          if (!riskName && !riskDescription && !departmentName) {
            continue;
          }

          // Validate required field: Risk name
          if (!riskName) {
            results.errors.push({ row: rowNum, error: "Risk name is required" });
            results.failed++;
            continue;
          }

          // Handle Department - find existing or create new (multi-tenant isolated)
          let department = null;
          if (departmentName) {
            department = departmentsCache.find(
              (d) => d.name.toLowerCase() === departmentName.toLowerCase()
            );

            if (!department) {
              // Create new department for this tenant
              department = await prisma.department.create({
                data: {
                  customerAccountId,
                  name: departmentName,
                },
              });
              departmentsCache.push(department);
            }
          }

          // Handle Risk Category - find existing or create new (multi-tenant isolated)
          let category = null;
          if (riskCategoryName) {
            category = categoriesCache.find(
              (c) => c.name.toLowerCase() === riskCategoryName.toLowerCase()
            );

            if (!category) {
              // Create new category for this tenant
              category = await prisma.riskCategory.create({
                data: {
                  customerAccountId,
                  name: riskCategoryName,
                  status: "Active",
                },
              });
              categoriesCache.push(category);
            }
          }

          // Generate risk ID
          const riskId = await generateRiskId(customerAccountId);

          // Default values for assessment
          const likelihood = 1;
          const impact = 1;
          const riskScore = likelihood * impact;
          const riskRating = calculateRiskRating(riskScore);

          // Create the risk with activity log
          const risk = await prisma.risk.create({
            data: {
              customerAccountId,
              riskId,
              name: riskName,
              description: riskDescription || null,
              riskSources: riskSources || null,
              categoryId: category?.id || null,
              departmentId: department?.id || null,
              likelihood,
              impact,
              riskScore,
              riskRating,
              status: "Open",
              activityLogs: {
                create: {
                  activity: "Imported",
                  description: `Risk "${riskName}" was imported from template`,
                  actor,
                },
              },
            },
          });

          // Handle Potential Threat - find existing or create new (multi-tenant isolated)
          if (potentialThreat) {
            const threatNames = potentialThreat.split(",").map((t) => t.trim()).filter(Boolean);

            for (const threatName of threatNames) {
              let threat = threatsCache.find(
                (t) => t.name.toLowerCase() === threatName.toLowerCase()
              );

              if (!threat) {
                // Create new threat for this tenant
                threat = await prisma.riskThreat.create({
                  data: {
                    customerAccountId,
                    name: threatName,
                  },
                });
                threatsCache.push(threat);
              }

              // Create mapping (use upsert to avoid duplicates)
              await prisma.riskThreatMapping.upsert({
                where: {
                  riskId_threatId: {
                    riskId: risk.id,
                    threatId: threat.id,
                  },
                },
                update: {},
                create: {
                  riskId: risk.id,
                  threatId: threat.id,
                },
              });
            }
          }

          // Handle Associated Vulnerabilities - find existing or create new (multi-tenant isolated)
          if (associatedVulnerabilities) {
            const vulnNames = associatedVulnerabilities.split(",").map((v) => v.trim()).filter(Boolean);

            for (const vulnName of vulnNames) {
              let vulnerability = vulnerabilitiesCache.find(
                (v) => v.name.toLowerCase() === vulnName.toLowerCase()
              );

              if (!vulnerability) {
                // Create new vulnerability for this tenant
                vulnerability = await prisma.riskVulnerability.create({
                  data: {
                    customerAccountId,
                    name: vulnName,
                  },
                });
                vulnerabilitiesCache.push(vulnerability);
              }

              // Create mapping (use upsert to avoid duplicates)
              await prisma.riskVulnerabilityMapping.upsert({
                where: {
                  riskId_vulnerabilityId: {
                    riskId: risk.id,
                    vulnerabilityId: vulnerability.id,
                  },
                },
                update: {},
                create: {
                  riskId: risk.id,
                  vulnerabilityId: vulnerability.id,
                },
              });
            }
          }

          results.success++;
          results.created.push({ riskId: risk.riskId, name: risk.name });
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
            error: "Import failed. No risks were created.",
            results,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message:
          results.failed === 0
            ? `Successfully imported ${results.success} risk(s)`
            : `Import completed: ${results.success} successful, ${results.failed} failed`,
        results,
      });
    } catch (error) {
      console.error("Error importing risks:", error);
      return NextResponse.json(
        { error: "Failed to import risks. Please try again." },
        { status: 500 }
      );
    }
  },
  { resource: "risk.register", action: "create" }
);
