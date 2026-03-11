import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import prisma from "@/lib/prisma";

const ENDPOINT = "/api/Qp_generate_framework_job";

/**
 * POST /api/qpost-compliance/ai/generate-framework
 *
 * Submit a QPost framework generation job to the Python AI backend.
 * Input: framework_name (required), attachment (optional), target_language (optional)
 * Returns: { job_id, status }
 */
async function handler(req: NextRequest, _context: unknown, session: AuthenticatedRequest["user"]) {
  const startTime = Date.now();
  let jobId: string | undefined;
  let requestPayload: Record<string, unknown> = {};

  try {
    const formData = await req.formData();

    const frameworkName = formData.get("framework_name") as string;
    const attachment = formData.get("attachment") as File | null;
    const targetLanguage = formData.get("target_language") as string | null;

    // Also accept extra metadata from frontend (stored locally, not sent to Python)
    const description = formData.get("description") as string | null;
    const type = formData.get("type") as string | null;
    const country = formData.get("country") as string | null;
    const industry = formData.get("industry") as string | null;
    const code = formData.get("code") as string | null;

    requestPayload = {
      framework_name: frameworkName,
      has_attachment: !!attachment,
      target_language: targetLanguage || "en",
      description,
      type,
      country,
      industry,
      code,
    };

    if (!frameworkName) {
      return NextResponse.json({ error: "framework_name is required" }, { status: 400 });
    }

    // Check for duplicate in QPost frameworks
    const existingFramework = await prisma.qPostFramework.findFirst({
      where: {
        ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
        name: frameworkName,
      },
    });

    if (existingFramework) {
      console.log(`[QPost Generate Framework] Duplicate rejected: "${frameworkName}" (ID: ${existingFramework.id})`);
      return NextResponse.json(
        {
          error: "Framework with this name already exists",
          existingFrameworkId: existingFramework.id,
        },
        { status: 409 }
      );
    }

    // Build FormData for Python backend — only sends what the QPost API expects
    const backendFormData = new FormData();
    backendFormData.append("framework_name", frameworkName);
    if (attachment) backendFormData.append("attachment", attachment);
    backendFormData.append("target_language", targetLanguage || "en");

    console.log(`\n[QPost Generate Framework] Submitting: "${frameworkName}" | language: ${targetLanguage || "en"}`);

    // Call Python backend
    const response = await aiApiClient.post(ENDPOINT, backendFormData);
    const result = response.data as { job_id?: string; status?: string };
    jobId = result.job_id;

    console.log(`[QPost Generate Framework] Job created: ${jobId} | Status: ${result.status} | Time: ${Date.now() - startTime}ms`);

    // Save job to AIJob table for tracking
    if (jobId) {
      await aiAuditService.createJob({
        providerJobId: jobId,
        type: "QPOST_FRAMEWORK_GEN",
        userId: session.id,
        metadata: requestPayload,
      });
    }

    await aiAuditService.logOperation({
      jobId,
      endpoint: ENDPOINT,
      method: "POST",
      requestBody: requestPayload,
      responseBody: result,
      statusCode: response.status,
      latencyMs: Date.now() - startTime,
      userId: session.id,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[QPost Generate Framework] Error: ${errMsg}`);

    await aiAuditService.logOperation({
      endpoint: ENDPOINT,
      method: "POST",
      requestBody: requestPayload,
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

export const POST = withAuthOnly(handler);
