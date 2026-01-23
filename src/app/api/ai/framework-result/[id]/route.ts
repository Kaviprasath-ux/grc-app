import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/framework-result/{jobId}
 * 
 * Get the result of a completed framework generation job.
 * This is Step 3 of the 3-step async process.
 * 
 * Response:
 * - job_id: string
 * - framework_name: string
 * - generated_at: string (ISO datetime)
 * - requirements: Array<FrameworkRequirement>
 * - total_requirements: number
 * - status: "completed"
 */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                { error: "Job ID is required" },
                { status: 400 }
            );
        }

        const backendUrl = process.env.PYTHON_BACKEND_URL?.replace(/\/$/, "");
        const apiSecret = process.env.PYTHON_API_SECRET;

        if (!backendUrl) {
            console.error("[AI Framework Result] PYTHON_BACKEND_URL not configured");
            return NextResponse.json(
                { error: "Backend configuration error" },
                { status: 500 }
            );
        }

        console.log(`[AI Framework Result] Fetching result for ID: ${id}`);

        // Call Python backend
        const response = await fetch(`${backendUrl}/api/framework_job_result/${id}`, {
            method: "GET",
            headers: {
                ...(apiSecret ? { auth: apiSecret } : {}),
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Framework Result] Backend error (${response.status}): ${errorText}`);
            return NextResponse.json(
                { error: `Backend returned ${response.status}`, details: errorText },
                { status: response.status }
            );
        }

        const result = await response.json();
        console.log(`[AI Framework Result] Success for ID: ${id}`);

        return NextResponse.json(result);
    } catch (error) {
        console.error("[AI Framework Result] Error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export const GET = withAuthOnly(handler);
