import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

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
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;

        const formData = await req.formData();

        // Extract and validate required fields
        const document_type = formData.get('document_type') as string;
        const document_name = formData.get('document_name') as string;
        const policy_document = formData.get('policy_document') as File;

        if (!document_type || !document_name || !policy_document) {
            return NextResponse.json(
                { error: "document_type, document_name, and policy_document are required" },
                { status: 400 }
            );
        }

        // Extract arrays (framework_names and missing_controls)
        const framework_names = formData.getAll('framework_names') as string[];
        const missing_controls = formData.getAll('missing_controls') as string[];

        if (!framework_names.length || !missing_controls.length) {
            return NextResponse.json(
                { error: "framework_names and missing_controls are required" },
                { status: 400 }
            );
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

        // Call backend API
        const response = await aiApiClient.post(
            '/api/regenerate_policy/',
            backendFormData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        const resultData = response.data;
        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: '/api/regenerate_policy/',
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
    } catch (error: any) {
        const latency = Date.now() - startTime;

        console.error("Error regenerating policy:", error);

        await aiAuditService.logOperation({
            endpoint: '/api/regenerate_policy/',
            method: 'POST',
            requestBody: null,
            responseBody: { error: error.message },
            userId,
            latencyMs: latency,
            statusCode: error.response?.status || 500,
        });

        return NextResponse.json(
            {
                error: "Failed to regenerate policy",
                details: error.message,
            },
            { status: error.response?.status || 500 }
        );
    }
}
