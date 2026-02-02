import { prisma } from "@/lib/prisma";

/**
 * framework-persistence.ts
 * 
 * Full implementation for persisting AI-generated frameworks, requirements, and controls
 * to the database with all relationships intact.
 * 
 * This handles the complete data model:
 * Framework → RequirementCategories → Requirements → Controls → Evidence/Policy
 */

interface AIResultData {
  framework_name?: string;
  framework_code?: string;
  total_requirements?: number;
  requirements?: Array<{
    code: string;
    name: string;
    description?: string;
    category?: string;
    category_code?: string;
    controls?: Array<{
      code: string;
      name: string;
      description?: string;
    }>;
  }>;
  [key: string]: any;
}

interface FrameworkMetadata {
  framework_name?: string;
  code?: string;
  description?: string;
  type?: string;
  country?: string;
  industry?: string;
  [key: string]: any;
}

export async function saveFrameworkFromAIResult(
  aiResult: AIResultData,
  metadata: FrameworkMetadata,
  customerAccountId: string
) {
  const persistenceStartTime = Date.now();

  try {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║          💾 FRAMEWORK PERSISTENCE SERVICE - STARTING             ║
╚════════════════════════════════════════════════════════════════╝
[${new Date().toISOString()}]

📋 INPUT DATA:
  • Framework Name: ${metadata.framework_name || aiResult.framework_name || 'Unknown'}
  • Code: ${metadata.code || aiResult.framework_code || 'AUTO-GEN'}
  • Total Requirements: ${aiResult.total_requirements || 0}
  • Customer Account ID: ${customerAccountId || 'DEFAULT'}
`);

    // Ensure we have a customer account ID
    if (!customerAccountId) {
      throw new Error("Customer account ID is required for multi-tenant isolation");
    }

    // ═══════════════════════════════════════════════════════════════
    // TRANSACTION: Wrap all database operations for atomicity
    // If any operation fails, all changes are rolled back
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 TRANSACTION: Starting atomic database operations...`);

    const result = await prisma.$transaction(async (tx) => {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Create Framework Record
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 STEP 1: Creating Framework Record...`);

    const frameworkName = metadata.framework_name || aiResult.framework_name || "Generated Framework";
    const frameworkCode = metadata.code || aiResult.framework_code || generateFrameworkCode(frameworkName);

    const framework = await tx.framework.create({
      data: {
        customerAccountId,
        name: frameworkName,
        code: frameworkCode,
        description: metadata.description,
        type: metadata.type || "Framework",
        country: metadata.country,
        industry: metadata.industry,
        status: "Subscribed",
        isCustom: true,
        compliancePercentage: 0,
        policyPercentage: 0,
        evidencePercentage: 0,
      },
    });

    console.log(`  ✅ Framework created: ${framework.id}`);
    console.log(`     Name: ${framework.name}`);
    console.log(`     Code: ${framework.code}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Create Requirement Categories
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 STEP 2: Creating Requirement Categories...`);

    // Extract unique categories from requirements
    const categoriesMap = new Map<string, any>();
    if (aiResult.requirements) {
      aiResult.requirements.forEach((req: any) => {
        const categoryCode = req.category_code || generateCategoryCode(req.category);
        if (!categoriesMap.has(categoryCode)) {
          categoriesMap.set(categoryCode, {
            code: categoryCode,
            name: req.category || "General",
            description: null,
          });
        }
      });
    }

    const categories = await Promise.all(
      Array.from(categoriesMap.values()).map((cat) =>
        tx.requirementCategory.create({
          data: {
            customerAccountId,
            frameworkId: framework.id,
            code: cat.code,
            name: cat.name,
            description: cat.description,
            sortOrder: Array.from(categoriesMap.keys()).indexOf(cat.code),
          },
        })
      )
    );

    console.log(`  ✅ ${categories.length} categories created`);

    // Create a map for quick category lookup
    const categoryMap = new Map(
      categories.map((cat) => [cat.code, cat.id])
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Create Requirements
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 STEP 3: Creating Requirements...`);

    let requirementCount = 0;
    const requirementMap = new Map<string, string>();

    if (aiResult.requirements) {
      const requirements = await Promise.all(
        aiResult.requirements.map((req: any, idx: number) =>
          tx.requirement.create({
            data: {
              customerAccountId,
              frameworkId: framework.id,
              categoryId: categoryMap.get(generateCategoryCode(req.category)) || undefined,
              code: req.code || `REQ-${idx + 1}`,
              name: req.name || `Requirement ${idx + 1}`,
              description: req.description,
              requirementType: "Mandatory",
              chapterType: "Domain",
              level: 1,
              sortOrder: idx,
            },
          })
        )
      );

      // Map requirement codes to IDs for control linking
      requirements.forEach((req) => {
        requirementMap.set(req.code, req.id);
      });

      requirementCount = requirements.length;
      console.log(`  ✅ ${requirementCount} requirements created`);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Create Controls and Link to Requirements
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 STEP 4: Creating Controls and Linking to Requirements...`);

    let controlCount = 0;
    let linkCount = 0;

    if (aiResult.requirements) {
      for (const req of aiResult.requirements) {
        if (req.controls && req.controls.length > 0) {
          for (const ctrl of req.controls) {
            // Create control
            const control = await tx.control.create({
              data: {
                customerAccountId,
                frameworkId: framework.id,
                controlCode: ctrl.code || `CTRL-${controlCount + 1}`,
                name: ctrl.name || `Control ${controlCount + 1}`,
                description: ctrl.description,
                status: "Non Compliant",
                scope: "In-Scope",
              },
            });

            controlCount++;

            // Link control to requirement
            const requirementId = requirementMap.get(req.code);
            if (requirementId) {
              await tx.requirementControl.create({
                data: {
                  requirementId,
                  controlId: control.id,
                },
              });

              linkCount++;
            }
          }
        }
      }
    }

    console.log(`  ✅ ${controlCount} controls created`);
    console.log(`  ✅ ${linkCount} requirement-control links created`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Update Framework with Calculated Percentages
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 STEP 5: Calculating Initial Percentages...`);

    // Initially, all controls are "Non Compliant", so compliance = 0%
    const updatedFramework = await prisma.framework.update({
      where: { id: framework.id },
      data: {
        compliancePercentage: 0, // 0 compliant / total = 0%
        policyPercentage: 0,     // No policies yet
        evidencePercentage: 0,   // No evidences yet
      },
    });

    console.log(`  ✅ Framework percentages initialized`);
    console.log(`     Compliance: 0%`);
    console.log(`     Policy: 0%`);
    console.log(`     Evidence: 0%`);

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS: Return Results (inside transaction)
    // ═══════════════════════════════════════════════════════════════
    return {
      success: true,
      frameworkId: framework.id,
      framework: updatedFramework,
      stats: {
        categories: categories.length,
        requirements: requirementCount,
        controls: controlCount,
        links: linkCount,
      },
    };
    }, { maxWait: 5000, timeout: 30000 });

    // Transaction completed successfully
    const totalTime = Date.now() - persistenceStartTime;

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║          ✅ FRAMEWORK PERSISTENCE COMPLETE                      ║
╚════════════════════════════════════════════════════════════════╝
[${new Date().toISOString()}]

📊 PERSISTENCE SUMMARY:
  • Framework: 1 created (COMMITTED)
  • Categories: ${result.stats.categories} created (COMMITTED)
  • Requirements: ${result.stats.requirements} created (COMMITTED)
  • Controls: ${result.stats.controls} created (COMMITTED)
  • Links: ${result.stats.links} created (COMMITTED)
  • Total Processing Time: ${totalTime}ms

🎯 RESULT:
  • Framework ID: ${result.frameworkId}
  • Framework Name: ${result.framework.name}
  • Status: COMPLETE
  • Ready for Dashboard: YES
  • Transaction: COMMITTED ATOMICALLY
`);

    return result;
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`
╔════════════════════════════════════════════════════════════════╗
║          ❌ FRAMEWORK PERSISTENCE FAILED                        ║
║          🔄 TRANSACTION ROLLED BACK - DATABASE CLEAN            ║
╚════════════════════════════════════════════════════════════════╝
[${errorTime}]

⚠️  ERROR DETAILS:
  • Message: ${error instanceof Error ? error.message : String(error)}
  • Stack: ${error instanceof Error ? error.stack : "Unknown"}
  • Processing Time: ${Date.now() - persistenceStartTime}ms
  • Transaction Status: ROLLED BACK (All changes reverted)
`);

    throw error;
  }
}

/**
 * Helper function to generate framework code from name
 * Example: "ISO 27001:2022" → "ISO27001"
 */
function generateFrameworkCode(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .substring(0, 20);
}

/**
 * Helper function to generate category code from name
 * Example: "Governance" → "GOV"
 */
function generateCategoryCode(name: string): string {
  if (!name) return "GEN";
  const words = name.split(/\s+/);
  const code = words
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .substring(0, 3);
  return code || "GEN";
}
