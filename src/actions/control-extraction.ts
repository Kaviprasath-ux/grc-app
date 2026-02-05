"use server";

import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";

/**
 * Extract controls from a document using AI
 */
export async function extractProcessControls(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const file = formData.get("file");
  if (!file) throw new Error("No file provided");

  try {
    const response = await aiApiClient.postFormData(AI_ENDPOINTS.EXTRACT_CONTROLS, formData);
    return response.data; // Expected to contain controls list
  } catch (error) {
    console.error("Control extraction error", error);
    throw new Error("Failed to extract controls");
  }
}
