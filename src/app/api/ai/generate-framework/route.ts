import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

/**
 * POST /api/ai/generate-framework
 * 
 * Submit a framework generation job to the Python backend.
 * This is Step 1 of the 3-step async process.
 * 
 * Request (multipart/form-data):
 * - framework_name: string (required)
 * - attachment: File (optional)
 * - library: string (optional)
 * 
 * Response:
 * - job_id: string
 * - status: "queued"
 * - message: string
 */
async function handler(req: NextRequest, _context: any, session: AuthenticatedRequest['user']) {
    const startTime = Date.now();
    const endpoint = "/api/generate_framework_job";
    let jobId: string | undefined;
    let requestPayload: any = {};

    try {
        const formData = await req.formData();

        const frameworkName = formData.get("framework_name") as string;
        const attachment = formData.get("attachment") as File | null;
        const library = formData.get("library") as string | null;
        const description = formData.get("description") as string | null;
        const type = formData.get("type") as string | null;
        const country = formData.get("country") as string | null;
        const industry = formData.get("industry") as string | null;
        const code = formData.get("code") as string | null;

        requestPayload = {
            framework_name: frameworkName,
            has_attachment: !!attachment,
            library,
            description,
            type,
            country,
            industry,
            code
        };

        if (!frameworkName) {
            return NextResponse.json(
                { error: "framework_name is required" },
                { status: 400 }
            );
        }

        // Prepare request to Python backend using aiApiClient
        const backendFormData = new FormData();
        backendFormData.append("framework_name", frameworkName);

        if (attachment) {
            backendFormData.append("attachment", attachment);
        }

        if (library) {
            backendFormData.append("library", library);
        }

        console.log(`[AI Framework] Submitting job for framework: ${frameworkName}`);

        // Call Python backend via centralized client
        const response = await aiApiClient.post(endpoint, backendFormData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        const result = response.data;
        jobId = result.job_id;

        console.log(`[AI Framework] Job submitted successfully: ${jobId}`);

        // PERSISTENCE: Create Job and Log Operation
        if (jobId) {
            await aiAuditService.createJob({
                providerJobId: jobId,
                type: 'FRAMEWORK_GEN',
                userId: session.id,
                metadata: requestPayload // Save all metadata for server-side persistence later
            });
        }

        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'POST',
            requestBody: requestPayload,
            responseBody: result,
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[AI Framework] Error submitting job:", error);

        const statusCode = error.status || 500;
        const errorMsg = error.message || "Internal server error";

        // Log failed operation
        await aiAuditService.logOperation({
            endpoint,
            method: 'POST',
            requestBody: requestPayload,
            error: errorMsg,
            statusCode,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json(
            {
                error: "Failed to submit framework generation job",
                details: error.data || errorMsg
            },
            { status: statusCode }
        );
    }
}

export const POST = withAuthOnly(handler);
