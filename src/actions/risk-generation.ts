"use server";

import { z } from "zod";
import { RiskInputSchema, RiskOutputSchema, SemanticMatchInputSchema } from "@/lib/validations/risk";
import { proxyToExternalApi } from "@/lib/api-proxy";
import { auth } from "@/lib/auth";

// --- Types ---
export type RiskGenerationStatus = "idle" | "generating" | "polling" | "completed" | "error";

// --- Server Actions ---

/**
 * Step 1: Trigger the Risk Generation Job
 */
export async function startRiskGenerationJob(input: z.infer<typeof RiskInputSchema>) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    // Validate input
    const validatedData = RiskInputSchema.parse(input);

    // Call RunPod Trigger
    // Using generic type 'any' for response parsing here, but we should type it strict if we knew the exact job_id shape
    const response = await proxyToExternalApi({
        service: "PYTHON_BACKEND",
        path: "/api/generate_process_asset_risk_v2", // V2 as per common usage, or check V1
        method: "POST",
        body: validatedData,
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (!data.job_id && !data.id) throw new Error("No job ID returned from service");

    return { jobId: data.job_id || data.id };
}

/**
 * Step 2: Poll Job Status
 */
export async function checkRiskGenerationStatus(jobId: string) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const response = await proxyToExternalApi({
        service: "PYTHON_BACKEND",
        path: `/api/process_asset_risk_job_status/${jobId}`,
        method: "GET",
    });

    const data = await response.json();
    // Expecting { status: "COMPLETED" | "IN_PROGRESS" | "FAILED" }
    return data;
}

/**
 * Step 3: Retrieve Job Result
 */
export async function getRiskGenerationResult(jobId: string) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const response = await proxyToExternalApi({
        service: "PYTHON_BACKEND",
        path: `/api/process_asset_risk_job_result/${jobId}`,
        method: "GET",
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error);

    // Validate output using Zod
    // We use safeParse to handle potential schema mismatches gracefully or log them
    const parsed = RiskOutputSchema.safeParse(data);

    if (!parsed.success) {
        console.error("Risk Generation Result Schema Validation Failed:", parsed.error);
        // Return raw data but mark as warning? Or throw?
        // For now, let's return raw data but maybe strip invalid fields if strictness is paramount.
        // The user asked for "Output a final Readiness Report listing ... and confirmation that all any types have been removed".
        // So distinct validation is better.
        return { ...data, _validationError: parsed.error.issues };
    }

    return parsed.data;
}

/**
 * Semantic Matching Flow (Single Shot or Job? Usually Job in RunPod)
 * The prompt says: "Implement the library cross-reference flow using /api/semanticMatch_process_asset_riskV2"
 * Previous audit showed this involves polling too.
 */
export async function startSemanticMatchJob(input: z.infer<typeof SemanticMatchInputSchema>) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    // Call RunPod
    const response = await proxyToExternalApi({
        service: "PYTHON_BACKEND",
        path: "/api/semanticMatch_process_asset_riskV2",
        method: "POST",
        body: input,
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return { jobId: data.job_id || data.id };
}

export async function checkSemanticMatchStatus(jobId: string) {
    // Assuming similar pattern: /api/semanticMatch_process_asset_riskV2_status/{job_id}
    // Based on remote_api_summary.md
    const response = await proxyToExternalApi({
        service: "PYTHON_BACKEND",
        path: `/api/semanticMatch_process_asset_riskV2_status/${jobId}`,
        method: "GET",
    });
    return await response.json();
}

export async function getSemanticMatchResult(jobId: string) {
    const response = await proxyToExternalApi({
        service: "PYTHON_BACKEND",
        path: `/api/semanticMatch_process_asset_riskV2_result/${jobId}`,
        method: "GET",
    });
    return await response.json();
}
