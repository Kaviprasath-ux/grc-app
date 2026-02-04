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
    code?: string;
    requirement_code?: string;
    name?: string;
    requirement_name?: string;
    description?: string;
    requirement_description?: string;
    category?: string;
    requirement_category?: string;
    category_code?: string;
    controls?: Array<{
      code?: string;
      name?: string;
      control_name?: string;
      description?: string;
      control_description?: string;
      policy_procedures?: Array<{ policy_procedure_name: string; policy_procedure_type: string }>;
      evidences?: Array<{ evidence_name: string; evidence_description?: string; evidence_requirement?: string }>;
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

/** Normalize RunPod API format to internal format */
function normalizeRunPodResult(aiResult: AIResultData): AIResultData {
  if (!aiResult.requirements) return aiResult;
  return {
    ...aiResult,
    requirements: aiResult.requirements.map((req: any) => ({
      code: req.requirement_code ?? req.code,
      name: req.requirement_name ?? req.name,
      description: req.requirement_description ?? req.description,
      category: req.requirement_category ?? req.category,
      category_code: req.category_code ?? generateCategoryCode(req.requirement_category ?? req.category),
      controls: (req.controls || []).map((ctrl: any, idx: number) => ({
        code: ctrl.code ?? `CTRL-${idx + 1}`,
        name: ctrl.control_name ?? ctrl.name,
        description: ctrl.control_description ?? ctrl.description,
        policy_procedures: ctrl.policy_procedures || [],
        evidences: ctrl.evidences || [],
      })),
    })),
  };
}

export async function saveFrameworkFromAIResult(
  aiResult: AIResultData,
  metadata: FrameworkMetadata,
  customerAccountId: string
) {
  const persistenceStartTime = Date.now();

  // Normalize RunPod format (requirement_code, control_name, etc.) to internal format
  const normalized = normalizeRunPodResult(aiResult);

  try {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║          💾 FRAMEWORK PERSISTENCE SERVICE - STARTING             ║
╚════════════════════════════════════════════════════════════════╝
[${new Date().toISOString()}]

📋 INPUT DATA:
  • Framework Name: ${metadata.framework_name || normalized.framework_name || 'Unknown'}
  • Code: ${metadata.code || normalized.framework_code || 'AUTO-GEN'}
  • Total Requirements: ${normalized.requirements?.length || 0}
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

    const frameworkName = metadata.framework_name || normalized.framework_name || "Generated Framework";
    const frameworkCode = metadata.code || normalized.framework_code || generateFrameworkCode(frameworkName);

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
    if (normalized.requirements) {
      normalized.requirements.forEach((req: any) => {
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

    if (normalized.requirements) {
      const requirements = await Promise.all(
        normalized.requirements.map((req: any, idx: number) =>
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
    // STEP 4: Create or Link Controls to Requirements
    // If control already exists (by name), link to it; otherwise create new
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 STEP 4: Creating/Linking Controls to Requirements...`);

    let controlCount = 0;
    let linkCount = 0;
    let linkedExistingCount = 0;

    const controlIdMap = new Map<string, string>(); // key -> control DB id (for policy/evidence linking)
    const requirementControlLinks = new Set<string>(); // "reqId|controlId" to avoid duplicates
    const fwPrefix = `AI-${framework.id.slice(-8)}`;

    // Fetch existing controls for this customer (match by name, case-insensitive)
    const existingControls = await tx.control.findMany({
      where: { customerAccountId },
      select: { id: true, name: true },
    });
    const existingControlByName = new Map(
      existingControls.map((c) => [c.name.trim().toLowerCase(), c.id])
    );

    const normalizeName = (s: string) => (s || "").trim().toLowerCase();

    if (normalized.requirements) {
      for (const req of normalized.requirements) {
        if (req.controls && req.controls.length > 0) {
          for (const ctrl of req.controls) {
            const ctrlName = ctrl.name || `Control ${controlCount + 1}`;
            const key = `${req.code}-${ctrlName}`;

            let controlId: string;
            const existingId = existingControlByName.get(normalizeName(ctrlName));

            if (existingId) {
              controlId = existingId;
              linkedExistingCount++;
            } else {
              controlCount++;
              const uniqueControlCode = `${fwPrefix}-${String(controlCount).padStart(4, "0")}`;
              const control = await tx.control.create({
                data: {
                  customerAccountId,
                  frameworkId: framework.id,
                  controlCode: uniqueControlCode,
                  name: ctrlName,
                  description: ctrl.description,
                  status: "Non Compliant",
                  scope: "In-Scope",
                },
              });
              controlId = control.id;
              existingControlByName.set(normalizeName(ctrlName), controlId);
            }

            controlIdMap.set(key, controlId);

            const requirementId = requirementMap.get(req.code!);
            if (requirementId) {
              const linkKey = `${requirementId}|${controlId}`;
              if (!requirementControlLinks.has(linkKey)) {
                requirementControlLinks.add(linkKey);
                await tx.requirementControl.create({
                  data: { requirementId, controlId },
                });
                linkCount++;
              }
            }
          }
        }
      }
    }

    if (linkedExistingCount > 0) {
      console.log(`  ✅ ${linkedExistingCount} controls linked to existing records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4b: Create Policies and Evidences from AI result
    // ═══════════════════════════════════════════════════════════════
    let policyCount = 0;
    let evidenceCount = 0;
    const policyCodeUsed = new Set<string>();
    const evidenceSeq = { n: 0 };

    if (normalized.requirements) {
      for (const req of normalized.requirements) {
        if (!req.controls) continue;
        for (const ctrl of req.controls) {
          const controlDbId = controlIdMap.get(`${req.code}-${ctrl.name}`);
          if (!controlDbId) continue;

          for (const pp of ctrl.policy_procedures || []) {
            const baseCode = generatePolicyCode(pp.policy_procedure_name);
            let code = baseCode;
            let suffix = 0;
            while (policyCodeUsed.has(code)) {
              code = `${baseCode}-${++suffix}`;
            }
            policyCodeUsed.add(code);
            const policy = await tx.policy.create({
              data: {
                customerAccountId,
                code,
                name: pp.policy_procedure_name,
                version: "1.0",
                documentType: mapDocType(pp.policy_procedure_type),
                status: "Not Uploaded",
              },
            });
            await tx.policyControl.create({
              data: { policyId: policy.id, controlId: controlDbId },
            });
            policyCount++;
          }

          for (const ev of ctrl.evidences || []) {
            evidenceSeq.n++;
            const code = `EVD-${framework.id.slice(-6)}-${String(evidenceSeq.n).padStart(4, "0")}`;
            const evidence = await tx.evidence.create({
              data: {
                customerAccountId,
                evidenceCode: code,
                name: ev.evidence_name,
                description: ev.evidence_description || ev.evidence_requirement || undefined,
                frameworkId: framework.id,
                status: "Not Uploaded",
              },
            });
            await tx.evidenceControl.create({
              data: { evidenceId: evidence.id, controlId: controlDbId },
            });
            evidenceCount++;
          }
        }
      }
    }

    if (policyCount > 0 || evidenceCount > 0) {
      console.log(`  ✅ ${policyCount} policies created`);
      console.log(`  ✅ ${evidenceCount} evidences created`);
    }

    console.log(`  ✅ ${controlCount} controls created`);
    console.log(`  ✅ ${linkCount} requirement-control links created`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Update Framework with Calculated Percentages
    // ═══════════════════════════════════════════════════════════════
    console.log(`
🔍 STEP 5: Calculating Initial Percentages...`);

    // Initially, all controls are "Non Compliant", so compliance = 0%
    const updatedFramework = await tx.framework.update({
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

function generatePolicyCode(name: string): string {
  const slug = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 15);
  return `POL-${slug || "AI"}`;
}

function mapDocType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t === "procedure") return "Procedure";
  if (t === "standard") return "Standard";
  return "Policy";
}
