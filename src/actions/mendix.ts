"use server";

import { proxyToExternalApi } from "@/lib/api-proxy";
import { auth } from "@/lib/auth";

export async function syncMendixData() {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const response = await proxyToExternalApi({
        service: "PYTHON_BACKEND",
        path: "/api/mendix_db_ingest",
        method: "POST",
        body: {}, // Empty body as it's a trigger
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return { success: true, message: "Mendix Sync Triggered", data };
}
