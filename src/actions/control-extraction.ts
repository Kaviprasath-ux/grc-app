"use server";

import { auth } from "@/lib/auth";

export async function extractProcessControls(formData: FormData) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    try {
        // Call our INTERNAL API instead of RunPod directly
        // This ensures AIOperation logging and architecture compliance
        const response = await fetch("/api/ai/control-extraction", {
            method: "POST",
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
