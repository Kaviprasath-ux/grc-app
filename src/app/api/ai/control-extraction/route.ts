import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";

/**
 * POST /api/ai/control-extraction
 *
 * Extracts controls from a process document.
 * Standardized with Atomic Audit Hook pattern.
 *
 * RunPod Endpoint: POST /api/extract_process_controls
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
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        // Step 1: Log AIOperation (Request) - Standard Pre-flight Hook
        const operation = await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.EXTRACT_CONTROLS,
            method: "POST",
            requestBody: { fileName: file.name, fileSize: file.size, fileType: file.type },
            userId,
        });

        console.log(`[AI Control Extraction] Standardized processing for: ${file.name}`);

        // Step 2: Call RunPod via aiApiClient
        const response = await aiApiClient.post(AI_ENDPOINTS.EXTRACT_CONTROLS, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        const latencyMs = Date.now() - startTime;

        // Step 3: Log AIOperation (Success Update) - Standard Post-flight Hook
        if (operation) {
            await prisma.aIOperation.update({
                where: { id: operation.id },
                data: {
                    responseBody: JSON.stringify(response.data),
                    statusCode: 200,
                    latencyMs,
                }
            });
        }

        return NextResponse.json(response.data);

    } catch (error: unknown) {
        const latencyMs = Date.now() - startTime;
        const err = error as { message?: string; status?: number };
        console.error("[AI Control Extraction] Error:", err);

        // Standard Error Logging
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.EXTRACT_CONTROLS,
            method: "POST",
            error: err.message || "Unknown error",
            statusCode: err.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: err.message || "Failed to extract controls" },
            { status: err.status || 500 }
        );
    }
}
