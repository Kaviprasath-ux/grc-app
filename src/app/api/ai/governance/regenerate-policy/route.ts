import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  unauthorizedResponse,
  badRequestResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/governance/regenerate-policy
 *
 * Regenerate a policy document by adding content for missing controls.
 * Aligned with RunPod /api/regenerate_policy/ OpenAPI contract.
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return unauthorizedResponse();
        }
        userId = session.user.id;

        const formData = await req.formData();

        // Extract and validate required fields
        const document_type = formData.get('document_type') as string;
        const document_name = formData.get('document_name') as string;
        const policy_document = formData.get('policy_document') as File;

        if (!document_type || !document_name || !policy_document) {
            return badRequestResponse("document_type, document_name, and policy_document are required");
        }

        // Extract arrays (framework_names and missing_controls)
        const framework_names = formData.getAll('framework_names') as string[];
        const missing_controls = formData.getAll('missing_controls') as string[];

        if (!framework_names.length || !missing_controls.length) {
            return badRequestResponse("framework_names and missing_controls are required");
        }

        // Construct backend FormData payload
        const backendFormData = new FormData();
        backendFormData.append('document_type', document_type);
        backendFormData.append('document_name', document_name);

        framework_names.forEach(name => {
            backendFormData.append('framework_names', name);
        });

        missing_controls.forEach(control => {
            backendFormData.append('missing_controls', control);
        });

        // Convert File to Buffer for backend
        const fileBuffer = Buffer.from(await policy_document.arrayBuffer());
        const blob = new Blob([fileBuffer], { type: policy_document.type });
        backendFormData.append('policy_document', blob, policy_document.name);

        // Call backend API using centralized endpoint constant
        const response = await aiApiClient.post(
            AI_ENDPOINTS.REGENERATE_POLICY,
            backendFormData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        const resultData = response.data;
        const latency = Date.now() - startTime;

        // Log operation using centralized endpoint constant
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.REGENERATE_POLICY,
            method: 'POST',
            requestBody: {
                document_type,
                document_name,
                framework_names,
                missing_controls,
                policy_document: policy_document.name,
            },
            responseBody: resultData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(resultData);
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; response?: { status?: number }; status?: number };

        console.error("[Governance Regenerate] Error:", err.message);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.REGENERATE_POLICY,
            method: 'POST',
            requestBody: null,
            responseBody: { error: err.message },
            userId,
            latencyMs: latency,
            statusCode: err.response?.status || err.status || 500,
        });

        return errorResponse(
            err.message || "Failed to regenerate policy",
            err.response?.status || err.status || 500
        );
    }
}
