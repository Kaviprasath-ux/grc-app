"use server";

import { auth } from "@/lib/auth";
import { EXTERNAL_API_SECRETS } from "@/config/external-apis";

// We might need to access env vars directly if proxy tool is too strict
const PYTHON_API_URL = process.env.PYTHON_BACKEND_URL || "https://api.runpod.io/something"; // Need actual URL logic

export async function extractProcessControls(formData: FormData) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const file = formData.get("file");
    if (!file) throw new Error("No file provided");

    // Construct URL - verifying current proxy logic
    // In `lib/api-proxy.ts` there is `getExternalApiUrl`. Ideally strictly reuse that logic.
    // But strict proxy might struggle with FormData boundary.
    // Let's rely on standard fetch here.

    const secret = process.env.PYTHON_API_SECRET;
    const baseUrl = process.env.PYTHON_BACKEND_URL; // Verify env var name in .env check

    if (!baseUrl || !secret) {
        throw new Error("Server configuration missing");
    }

    const url = `${baseUrl}/api/extract_process_controls`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "x-api-secret": secret,
                "auth": secret,
                // Do NOT set Content-Type, let fetch set it with boundary
            },
            body: formData,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Extraction failed: ${response.status} ${text}`);
        }

        const data = await response.json();
        return data; // Expected to contain controls list

    } catch (error) {
        console.error("Control extraction error", error);
        throw new Error("Failed to extract controls");
    }
}
