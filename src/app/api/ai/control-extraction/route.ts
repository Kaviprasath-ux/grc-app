import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/control-extraction
 * 
 * Extracts controls from a process document.
 * Standardized with Atomic Audit Hook pattern.
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
            endpoint: "/api/extract_process_controls",
            method: "POST",
            requestBody: { fileName: file.name, fileSize: file.size, fileType: file.type },
            userId,
        });

        console.log(`[AI Control Extraction] Standardized processing for: ${file.name}`);

        // Step 2: Call RunPod via aiApiClient
        const response = await aiApiClient.post("/api/extract_process_controls", formData, {
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

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error("[AI Control Extraction] Error:", error);

        // Standard Error Logging
        await aiAuditService.logOperation({
            endpoint: "/api/extract_process_controls",
            method: "POST",
            error: error.message || "Unknown error",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: error.message || "Failed to extract controls" },
            { status: error.status || 500 }
        );
    }
}
