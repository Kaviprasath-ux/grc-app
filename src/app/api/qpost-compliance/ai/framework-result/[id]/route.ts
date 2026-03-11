import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import prisma from "@/lib/prisma";
import { translateRecord } from "@/lib/translation-service";

export const dynamic = "force-dynamic";

interface QPostAIRequirement {
  requirement_category: string;
  requirement_code: string;
  requirement_name: string;
  requirement_description?: string;
}

interface QPostAIResult {
  framework_name: string;
  requirements: QPostAIRequirement[];
}

/**
 * Trigger background translations for all records created by AI framework generation.
 * Runs asynchronously — does not block the API response.
 */
async function translateFrameworkRecords(
  customerAccountId: string,
  frameworkId: string,
  sourceLocale: string
) {
  try {
    console.log(`[QPost Translation] Starting background translation for framework ${frameworkId} (source: ${sourceLocale})`);

    // Fetch all records created for this framework
    const [framework, categories, requirements] = await Promise.all([
      prisma.qPostFramework.findUnique({
        where: { id: frameworkId },
        select: { id: true, name: true, code: true, description: true, type: true, country: true, industry: true },
      }),
      prisma.qPostRequirementCategory.findMany({
        where: { frameworkId },
        select: { id: true, name: true, code: true, description: true },
      }),
      prisma.qPostRequirement.findMany({
        where: { frameworkId },
        select: { id: true, name: true, code: true, description: true },
      }),
    ]);

    // Translate framework (all fields)
    if (framework) {
      void translateRecord(customerAccountId, "QPostFramework", framework.id, {
        name: framework.name,
        code: framework.code || "",
        description: framework.description || "",
        type: framework.type || "",
        country: framework.country || "",
        industry: framework.industry || "",
      }, sourceLocale);
    }

    // Translate categories
    for (const cat of categories) {
      void translateRecord(customerAccountId, "QPostRequirementCategory", cat.id, {
        name: cat.name,
        code: cat.code || "",
        description: cat.description || "",
      }, sourceLocale);
    }

    // Translate requirements including code (stagger slightly to avoid overwhelming the translation API)
    for (let i = 0; i < requirements.length; i++) {
      const req = requirements[i];
      // Small delay every 10 records to be gentle on the translation API
      if (i > 0 && i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      void translateRecord(customerAccountId, "QPostRequirement", req.id, {
        name: req.name,
        code: req.code || "",
        description: req.description || "",
      }, sourceLocale);
    }

    console.log(`[QPost Translation] Queued translations: 1 framework, ${categories.length} categories, ${requirements.length} requirements`);
  } catch (error) {
    // Background task — log error but don't throw
    console.error(`[QPost Translation] Background translation error:`, error);
  }
}

/**
 * GET /api/qpost-compliance/ai/framework-result/{jobId}
 *
 * Fetch QPost framework generation result from Python backend and persist to DB.
 * Creates: QPostFramework → QPostRequirementCategory → QPostRequirement
 * Then triggers background translation to all supported languages.
 */
async function handler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
  session: AuthenticatedRequest["user"]
) {
  const startTime = Date.now();
  const { id: jobId } = await context.params;
  const endpoint = `/api/Qp_framework_job_result/${jobId}`;

  try {
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const customerAccountId = session.customerAccountId || "";
    if (!customerAccountId) {
      return NextResponse.json({ error: "Customer account not found" }, { status: 403 });
    }

    console.log(`\n[QPost Framework Result] JobID: ${jobId} | User: ${session.id}`);

    // Fetch from Python backend
    const response = await aiApiClient.get(endpoint);
    const rawData = response.data as Record<string, unknown>;

    console.log(`[QPost Framework Result] Raw response keys:`, Object.keys(rawData));

    // Extract the result object — Python API returns { job_id, status, result: { ... } }
    let aiResult: QPostAIResult;
    if (rawData?.result && typeof rawData.result === "object") {
      aiResult = rawData.result as QPostAIResult;
    } else if (rawData?.data && typeof rawData.data === "object") {
      aiResult = rawData.data as QPostAIResult;
    } else {
      aiResult = rawData as unknown as QPostAIResult;
    }

    const requirements = Array.isArray(aiResult.requirements) ? aiResult.requirements : [];
    console.log(`[QPost Framework Result] Parsed: name="${aiResult.framework_name}", requirements=${requirements.length}`);

    if (requirements.length === 0) {
      console.warn(`[QPost Framework Result] AI backend returned EMPTY requirements array!`);
    }

    // Get job metadata (stored during submit)
    const job = await prisma.aIJob.findUnique({ where: { providerJobId: jobId } });
    const metadata = job?.metadata ? JSON.parse(job.metadata) : {};

    const frameworkName = metadata.framework_name || aiResult.framework_name || "Generated Framework";

    // Idempotency check — don't create duplicate framework
    const existingFramework = await prisma.qPostFramework.findFirst({
      where: {
        customerAccountId,
        name: frameworkName,
      },
    });

    let frameworkId: string;
    let stats: Record<string, unknown>;

    if (existingFramework) {
      console.log(`[QPost Framework Result] Framework already exists: ${existingFramework.id}`);
      frameworkId = existingFramework.id;
      stats = { message: "Already persisted", requirementsCount: 0 };
    } else {
      // Persist to QPost DB tables in a transaction
      console.log(`[QPost Framework Result] Persisting new framework: "${frameworkName}" with ${requirements.length} requirements`);

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create QPostFramework
        const framework = await tx.qPostFramework.create({
          data: {
            customerAccountId,
            name: frameworkName,
            code: metadata.code || frameworkName.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20).toUpperCase(),
            description: metadata.description || null,
            type: metadata.type || "Framework",
            country: metadata.country || null,
            industry: metadata.industry || null,
            isCustom: true,
            status: "Subscribed",
            compliancePercentage: 0,
            policyPercentage: 0,
            evidencePercentage: 0,
          },
        });

        // 2. Group requirements by category
        const categoryMap = new Map<string, QPostAIRequirement[]>();
        for (const req of requirements) {
          const catName = req.requirement_category || "General";
          if (!categoryMap.has(catName)) {
            categoryMap.set(catName, []);
          }
          categoryMap.get(catName)!.push(req);
        }

        // 3. Create categories and requirements
        let totalReqs = 0;
        let sortOrder = 0;

        for (const [categoryName, categoryReqs] of categoryMap.entries()) {
          // Create or find category
          let category = await tx.qPostRequirementCategory.findFirst({
            where: {
              frameworkId: framework.id,
              name: categoryName,
            },
          });

          if (!category) {
            category = await tx.qPostRequirementCategory.create({
              data: {
                customerAccountId,
                name: categoryName,
                frameworkId: framework.id,
                sortOrder: sortOrder++,
              },
            });
          }

          // Create requirements
          for (const req of categoryReqs) {
            const reqCode = req.requirement_code || `REQ-${totalReqs + 1}`;
            const reqName = req.requirement_name || reqCode;

            // Skip duplicates within this framework
            const existingReq = await tx.qPostRequirement.findFirst({
              where: {
                frameworkId: framework.id,
                code: reqCode,
              },
            });

            if (!existingReq) {
              await tx.qPostRequirement.create({
                data: {
                  customerAccountId,
                  code: reqCode,
                  name: reqName,
                  description: req.requirement_description || null,
                  frameworkId: framework.id,
                  categoryId: category.id,
                  requirementType: "requirement",
                  chapterType: "main",
                  level: 2,
                  sortOrder: totalReqs,
                },
              });
              totalReqs++;
            }
          }
        }

        return {
          frameworkId: framework.id,
          categoriesCount: categoryMap.size,
          requirementsCount: totalReqs,
        };
      });

      frameworkId = result.frameworkId;
      stats = result;

      console.log(`[QPost Framework Result] Persisted: ${result.categoriesCount} categories, ${result.requirementsCount} requirements`);
    }

    // Update job status
    await aiAuditService.updateJobStatus(jobId, "COMPLETED");

    // Trigger background translations — fire-and-forget, doesn't block response
    const sourceLocale = metadata.target_language || "en";
    if (!existingFramework) {
      void translateFrameworkRecords(customerAccountId, frameworkId, sourceLocale);
    }

    console.log(`[QPost Framework Result] Complete: frameworkId=${frameworkId}, time=${Date.now() - startTime}ms`);

    // Log operation
    await aiAuditService.logOperation({
      jobId,
      endpoint,
      method: "GET",
      responseBody: { success: true, frameworkId },
      statusCode: response.status,
      latencyMs: Date.now() - startTime,
      userId: session.id,
    });

    return NextResponse.json({
      success: true,
      frameworkId,
      framework_name: frameworkName,
      stats,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[QPost Framework Result] Error: ${errMsg}`, error);

    if (jobId) {
      await aiAuditService.updateJobStatus(jobId, "FAILED");
    }

    await aiAuditService.logOperation({
      jobId,
      endpoint,
      method: "GET",
      error: errMsg,
      statusCode: 500,
      latencyMs: Date.now() - startTime,
      userId: session.id,
    });

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export const GET = withAuthOnly(handler);
