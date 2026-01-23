import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly } from "@/lib/api-auth";

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
async function handler(req: NextRequest) {
    try {
        const formData = await req.formData();

        const frameworkName = formData.get("framework_name") as string;
        const attachment = formData.get("attachment") as File | null;
        const library = formData.get("library") as string | null;

        if (!frameworkName) {
            return NextResponse.json(
                { error: "framework_name is required" },
                { status: 400 }
            );
        }

        // Prepare request to Python backend
        const backendFormData = new FormData();
        backendFormData.append("framework_name", frameworkName);

        if (attachment) {
            backendFormData.append("attachment", attachment);
        }

        if (library) {
            backendFormData.append("library", library);
        }

        const backendUrl = process.env.PYTHON_BACKEND_URL?.replace(/\/$/, ""); // Remove trailing slash
        const apiSecret = process.env.PYTHON_API_SECRET;

        if (!backendUrl) {
            console.error("PYTHON_BACKEND_URL not configured");
            return NextResponse.json(
                { error: "Backend configuration error" },
                { status: 500 }
            );
        }

        console.log(`[AI Framework] Submitting job for framework: ${frameworkName}`);
        console.log(`[AI Framework] Backend URL: ${backendUrl}/api/generate_framework_job`);

        // Call Python backend
        const response = await fetch(`${backendUrl}/api/generate_framework_job`, {
            method: "POST",
            headers: {
                ...(apiSecret ? { auth: apiSecret } : {}),
            },
            body: backendFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Framework] Backend error: ${response.status} - ${errorText}`);
            return NextResponse.json(
                { error: "Failed to submit framework generation job", details: errorText },
                { status: response.status }
            );
        }

        const result = await response.json();
        console.log(`[AI Framework] Job submitted successfully: ${result.job_id}`);

        return NextResponse.json(result);
    } catch (error) {
        console.error("[AI Framework] Error submitting job:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export const POST = withAuthOnly(handler);
