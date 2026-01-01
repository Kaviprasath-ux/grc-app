import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper function to calculate risk rating based on score
function calculateRiskRating(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

// Helper function to generate risk ID
async function generateRiskId(): Promise<string> {
  const lastRisk = await prisma.risk.findFirst({
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

  const count = await prisma.risk.count();
  return `RID${String(count + 1).padStart(3, "0")}`;
}

// GET import template structure
export async function GET() {
  try {
    // Fetch available options for dropdowns
    const [categories, types, departments] = await Promise.all([
      prisma.riskCategory.findMany({ select: { name: true } }),
      prisma.riskType.findMany({ select: { name: true } }),
      prisma.department.findMany({ select: { name: true } }),
    ]);

    const template = {
      columns: [
        { name: "Risk Name", required: true, type: "string", description: "Name of the risk" },
        { name: "Description", required: false, type: "string", description: "Risk description" },
        { name: "Risk Sources", required: false, type: "string", description: "Sources of the risk" },
        {
          name: "Category",
          required: false,
          type: "dropdown",
          options: categories.map((c) => c.name),
          description: "Risk category",
        },
        {
          name: "Risk Type",
          required: false,
          type: "dropdown",
          options: types.map((t) => t.name),
          description: "Type of risk (Asset Risk, Process Risk)",
        },
        {
          name: "Department",
          required: false,
          type: "dropdown",
          options: departments.map((d) => d.name),
          description: "Department responsible",
        },
        { name: "Risk Owner", required: false, type: "string", description: "Name of risk owner" },
        { name: "Likelihood", required: false, type: "number", min: 1, max: 5, description: "Likelihood score (1-5)" },
        { name: "Impact", required: false, type: "number", min: 1, max: 5, description: "Impact score (1-5)" },
        {
          name: "Status",
          required: false,
          type: "dropdown",
          options: ["Open", "In Progress", "Closed", "Awaiting Approval", "Pending Assessment"],
          description: "Risk status",
        },
        {
          name: "Response Strategy",
          required: false,
          type: "dropdown",
          options: ["Treat", "Transfer", "Avoid", "Accept"],
          description: "Risk response strategy",
        },
        { name: "Treatment Plan", required: false, type: "string", description: "Treatment plan description" },
      ],
      sampleData: [
        {
          "Risk Name": "Sample Risk 1",
          Description: "Description of the sample risk",
          "Risk Sources": "External",
          Category: categories[0]?.name || "Operational",
          "Risk Type": types[0]?.name || "Asset Risk",
          Department: departments[0]?.name || "IT",
          "Risk Owner": "John Doe",
          Likelihood: 3,
          Impact: 4,
          Status: "Open",
          "Response Strategy": "Treat",
          "Treatment Plan": "Implement additional controls",
        },
      ],
    };

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error getting import template:", error);
    return NextResponse.json(
      { error: "Failed to get import template" },
      { status: 500 }
    );
  }
}

// POST import risks from data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, actor = "System" } = body;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Data must be a non-empty array" },
        { status: 400 }
      );
    }

    // Fetch lookup data
    const [categories, types, departments, users] = await Promise.all([
      prisma.riskCategory.findMany(),
      prisma.riskType.findMany(),
      prisma.department.findMany(),
      prisma.user.findMany({ select: { id: true, fullName: true } }),
    ]);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { row: number; error: string }[],
      created: [] as { riskId: string; name: string }[],
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Validate required fields
        if (!row["Risk Name"] && !row.name) {
          results.errors.push({ row: i + 1, error: "Risk Name is required" });
          results.failed++;
          continue;
        }

        const name = row["Risk Name"] || row.name;
        const description = row.Description || row.description || null;
        const riskSources = row["Risk Sources"] || row.riskSources || null;
        const likelihood = parseInt(row.Likelihood || row.likelihood) || 1;
        const impact = parseInt(row.Impact || row.impact) || 1;
        const status = row.Status || row.status || "Open";
        const responseStrategy = row["Response Strategy"] || row.responseStrategy || null;
        const treatmentPlan = row["Treatment Plan"] || row.treatmentPlan || null;

        // Lookup foreign keys
        const categoryName = row.Category || row.category;
        const typeName = row["Risk Type"] || row.riskType || row.type;
        const departmentName = row.Department || row.department;
        const ownerName = row["Risk Owner"] || row.riskOwner || row.owner;

        const category = categoryName
          ? categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
          : null;
        const type = typeName
          ? types.find((t) => t.name.toLowerCase() === typeName.toLowerCase())
          : null;
        const department = departmentName
          ? departments.find((d) => d.name.toLowerCase() === departmentName.toLowerCase())
          : null;
        const owner = ownerName
          ? users.find((u) => u.fullName.toLowerCase().includes(ownerName.toLowerCase()))
          : null;

        // Calculate risk score and rating
        const riskScore = likelihood * impact;
        const riskRating = calculateRiskRating(riskScore);

        // Generate risk ID
        const riskId = await generateRiskId();

        // Create the risk
        const risk = await prisma.risk.create({
          data: {
            riskId,
            name,
            description,
            riskSources,
            categoryId: category?.id || null,
            typeId: type?.id || null,
            departmentId: department?.id || null,
            ownerId: owner?.id || null,
            likelihood,
            impact,
            riskScore,
            riskRating,
            status,
            responseStrategy,
            treatmentPlan,
            activityLogs: {
              create: {
                activity: "Imported",
                description: `Risk "${name}" was imported`,
                actor,
              },
            },
          },
        });

        results.success++;
        results.created.push({ riskId: risk.riskId, name: risk.name });
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        results.failed++;
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error("Error importing risks:", error);
    return NextResponse.json(
      { error: "Failed to import risks" },
      { status: 500 }
    );
  }
}
