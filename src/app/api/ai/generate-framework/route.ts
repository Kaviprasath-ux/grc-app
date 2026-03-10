import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";

/**
 * POST /api/ai/generate-framework
 *
 * Submit a framework generation job to the Python AI backend.
 * Returns job_id for polling status.
 */
async function handler(req: NextRequest, _context: any, session: AuthenticatedRequest['user']) {
    const startTime = Date.now();
    const endpoint = AI_ENDPOINTS.GENERATE_FRAMEWORK_JOB;
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
            description,
            type,
            country,
            industry,
            code
        };

        if (!frameworkName) {
            return NextResponse.json({ error: "framework_name is required" }, { status: 400 });
        }

        // Check for duplicate
        const existingFramework = await prisma.framework.findFirst({
            where: {
                ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
                name: frameworkName,
            },
        });

        if (existingFramework) {
            console.log(`[Generate Framework] Duplicate rejected: "${frameworkName}" (ID: ${existingFramework.id})`);
            return NextResponse.json({
                error: "Framework with this name already exists",
                existingFrameworkId: existingFramework.id,
            }, { status: 409 });
        }

        // Build library payload from user's existing data
        let libraryPayload = library;
        if (session.customerAccountId) {
            const [controls, evidences, policies] = await Promise.all([
                prisma.control.findMany({
                    where: { customerAccountId: session.customerAccountId },
                    select: { name: true, controlCode: true },
                }),
                prisma.evidence.findMany({
                    where: { customerAccountId: session.customerAccountId },
                    select: { name: true, evidenceCode: true },
                }),
                prisma.policy.findMany({
                    where: { customerAccountId: session.customerAccountId },
                    select: { name: true, code: true },
                }),
            ]);

            const libraryObj = {
                control_library: controls.map((c) => ({
                    control_name: c.name,
                    control_code: c.controlCode || c.name,
                })),
                evidence_library: evidences.map((e) => ({
                    evidence_name: e.name,
                    evidence_code: e.evidenceCode || e.name,
                })),
                governance_library: policies.map((p) => ({
                    policy_procedure_name: p.name,
                    policy_procedure_code: p.code || p.name,
                })),
            };
            libraryPayload = JSON.stringify(libraryObj);
            requestPayload.library_counts = {
                controls: controls.length,
                evidences: evidences.length,
                policies: policies.length
            };
        }

        // Prepare FormData for AI backend
        const backendFormData = new FormData();
        backendFormData.append("framework_name", frameworkName);
        if (attachment) backendFormData.append("attachment", attachment);
        if (libraryPayload) backendFormData.append("library", libraryPayload);

        console.log(`\n[Generate Framework] Submitting: "${frameworkName}"`);
        console.log(`[Generate Framework] Payload:`, JSON.stringify({
            framework_name: frameworkName,
            type,
            country,
            industry,
            has_attachment: !!attachment,
            library_counts: requestPayload.library_counts
        }));

        // Call Python backend
        const response = await aiApiClient.post(endpoint, backendFormData);
        const result = response.data as { job_id?: string; status?: string };
        jobId = result.job_id;

        console.log(`[Generate Framework] ✅ Job created: ${jobId} | Status: ${result.status} | Time: ${Date.now() - startTime}ms`);

        // Save job to database
        if (jobId) {
            await aiAuditService.createJob({
                providerJobId: jobId,
                type: 'FRAMEWORK_GEN',
                userId: session.id,
                metadata: requestPayload
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
        console.error(`[Generate Framework] ❌ Error: ${error.message}`);

        await aiAuditService.logOperation({
            endpoint,
            method: 'POST',
            requestBody: requestPayload,
            error: error.message,
            statusCode: error.status || 500,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: error.status || 500 }
        );
    }
}

export const POST = withAuthOnly(handler);
