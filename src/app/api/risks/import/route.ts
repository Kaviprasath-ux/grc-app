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

// Find or create a department for the tenant
async function findOrCreateDepartment(name: string, customerAccountId: string) {
  const existing = await prisma.department.findFirst({
    where: {
      customerAccountId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (existing) return existing;

  return prisma.department.create({
    data: { customerAccountId, name },
  });
}

// Find or create a risk category for the tenant (uses @@unique([customerAccountId, name]))
async function findOrCreateCategory(name: string, customerAccountId: string) {
  const existing = await prisma.riskCategory.findFirst({
    where: {
      customerAccountId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (existing) return existing;

  return prisma.riskCategory.create({
    data: { name, status: "Active", customerAccountId },
  });
}

// Find or create a threat for the tenant (uses @@unique([customerAccountId, name]))
async function findOrCreateThreat(name: string, customerAccountId: string) {
  const existing = await prisma.riskThreat.findFirst({
    where: {
      customerAccountId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (existing) return existing;

  return prisma.riskThreat.create({
    data: { name, customerAccountId },
  });
}

// Find or create a vulnerability for the tenant (uses @@unique([customerAccountId, name]))
async function findOrCreateVulnerability(name: string, customerAccountId: string) {
  const existing = await prisma.riskVulnerability.findFirst({
    where: {
      customerAccountId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (existing) return existing;

  return prisma.riskVulnerability.create({
    data: { name, customerAccountId },
  });
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

          console.log(`[Risk Import] Row ${rowNum}: name="${riskName}", dept="${departmentName}", cat="${riskCategoryName}", threat="${potentialThreat}", vuln="${associatedVulnerabilities}"`);

          // Handle Department - find existing or create new (tenant-scoped)
          let departmentId: string | null = null;
          if (departmentName) {
            try {
              const department = await findOrCreateDepartment(departmentName, customerAccountId);
              departmentId = department.id;
              console.log(`[Risk Import] Row ${rowNum}: Department resolved -> ${department.id} (${department.name})`);
            } catch (err) {
              console.error(`[Risk Import] Row ${rowNum}: Failed to create department "${departmentName}":`, err);
            }
          }

          // Handle Risk Category - find existing or create new (tenant-scoped)
          let categoryId: string | null = null;
          if (riskCategoryName) {
            try {
              const category = await findOrCreateCategory(riskCategoryName, customerAccountId);
              categoryId = category.id;
              console.log(`[Risk Import] Row ${rowNum}: Category resolved -> ${category.id} (${category.name})`);
            } catch (err) {
              console.error(`[Risk Import] Row ${rowNum}: Failed to create category "${riskCategoryName}":`, err);
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
              categoryId,
              departmentId,
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

          console.log(`[Risk Import] Row ${rowNum}: Risk created -> ${risk.riskId} (categoryId=${categoryId}, departmentId=${departmentId})`);

          // Handle Potential Threat - find existing or create new, then link to risk
          if (potentialThreat) {
            const threatNames = potentialThreat.split(",").map((t: string) => t.trim()).filter(Boolean);

            for (const threatName of threatNames) {
              try {
                const threat = await findOrCreateThreat(threatName, customerAccountId);
                console.log(`[Risk Import] Row ${rowNum}: Threat resolved -> ${threat.id} (${threat.name})`);

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
              } catch (err) {
                console.error(`[Risk Import] Row ${rowNum}: Failed to create/link threat "${threatName}":`, err);
              }
            }
          }

          // Handle Associated Vulnerabilities - find existing or create new, then link to risk
          if (associatedVulnerabilities) {
            const vulnNames = associatedVulnerabilities.split(",").map((v: string) => v.trim()).filter(Boolean);

            for (const vulnName of vulnNames) {
              try {
                const vulnerability = await findOrCreateVulnerability(vulnName, customerAccountId);
                console.log(`[Risk Import] Row ${rowNum}: Vulnerability resolved -> ${vulnerability.id} (${vulnerability.name})`);

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
              } catch (err) {
                console.error(`[Risk Import] Row ${rowNum}: Failed to create/link vulnerability "${vulnName}":`, err);
              }
            }
          }

          results.success++;
          results.created.push({ riskId: risk.riskId, name: risk.name });
        } catch (error) {
          console.error(`[Risk Import] Error importing row ${rowNum}:`, error);
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
