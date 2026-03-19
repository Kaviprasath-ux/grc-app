import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from "@/config/external-apis";
import { AI_ENDPOINTS, getEndpointName } from "@/lib/ai-endpoints";

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Safely stringify any value for logging
 */
function safeJsonStringify(value: unknown, indent: number = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

function extractResultFromSimpleQueryResponse(data: unknown): string {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  const keys = [
    "answer",
    "result",
    "response",
    "text",
    "output",
    "review",
    "message",
  ];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const first = Object.values(o).find(
    (v) => typeof v === "string" && (v as string).trim()
  );
  return typeof first === "string" ? first.trim() : "";
}

// POST - Smart document search (ACT_SearchQueryDocLib). Calls RunPod simple_query.
export const POST = withAuth(
  async (
    request: NextRequest,
    _context: { params?: Promise<unknown> },
    session
  ) => {
    try {
      const body = await request.json();
      const { query, userId } = body;

      if (!query || typeof query !== "string") {
        return NextResponse.json(
          { error: "Query is required" },
          { status: 400 }
        );
      }

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: "Server misconfiguration: missing API secret" },
          { status: 500 }
        );
      }

      // Use the same customer_id that was used during ingest for proper data isolation
      const customerAccountId = getCustomerAccountId(session);
      const customerId = customerAccountId || "document-library";

      const payload = {
        question: query.trim(),
        customer_id: customerId,
        context_status: true,
      };

      const url = getExternalApiUrl("PYTHON_BACKEND", AI_ENDPOINTS.SIMPLE_QUERY);
      const requestId = generateRequestId();
      const endpointName = getEndpointName(AI_ENDPOINTS.SIMPLE_QUERY);
      const startTime = Date.now();

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI API REQUEST] ${endpointName}`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[${requestId}] Calling: POST ${AI_ENDPOINTS.SIMPLE_QUERY}`);
      console.log(`[${requestId}] Full URL: ${url}`);
      console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
      console.log(`[${requestId}] Payload:`);
      console.log(safeJsonStringify(payload, 2));
      console.log(`${'─'.repeat(80)}`);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          auth: secret,
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      const latency = Date.now() - startTime;

      console.log(`${'─'.repeat(80)}`);
      console.log(`[AI API RESPONSE] ${endpointName}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`[${requestId}] Status: ${res.status} ${res.statusText}`);
      console.log(`[${requestId}] Latency: ${latency}ms`);
      console.log(`[${requestId}] Response Size: ${resText.length} bytes`);
      console.log(`[${requestId}] Response:`);
      console.log(resText.slice(0, 500) + (resText.length > 500 ? "...(truncated)" : ""));
      console.log(`${'═'.repeat(80)}\n`);

      let result: string;
      let status: string;

      if (!res.ok) {
        let errMsg = "Document library search failed";
        try {
          const j = JSON.parse(resText) as { error?: string; detail?: unknown };
          if (j.error) errMsg = j.error;
        } catch {
          if (resText) errMsg = resText.slice(0, 200);
        }
        return NextResponse.json({ error: errMsg }, { status: res.status });
      }

      let data: unknown;
      try {
        data = JSON.parse(resText);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON response from RunPod" },
          { status: 502 }
        );
      }

      const extracted = extractResultFromSimpleQueryResponse(data);
      if (extracted) {
        result = extracted;
        status = "Satisfactory";
      } else {
        result =
          "Unsatisfactory: The retrieved document content does not provide any relevant information regarding your query.";
        status = "Unsatisfactory";
      }

      // Local document search for "documents" in response (optional)
      const documents = await prisma.internalAuditDocument.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { fileName: { contains: query } },
          ],
        },
        take: 10,
      });

      const effectiveUserId = userId ?? session?.id ?? null;

      const search = await prisma.documentSearch.create({
        data: {
          query: query.trim(),
          result,
          status,
          userId: effectiveUserId,
        },
      });

      console.log(`[Document Search] ✓ SUCCESS - Found ${documents.length} matching documents, status: ${status}`);

      return NextResponse.json({
        id: search.id,
        query: query.trim(),
        result,
        status,
        documents,
        timestamp: search.createdAt,
        customer_id: customerId,
      });
    } catch (error) {
      console.error(`\n${'═'.repeat(80)}`);
      console.error(`[DOCUMENT SEARCH ERROR]`);
      console.error(`${'═'.repeat(80)}`);
      console.error("[Document Search] ❌ ERROR:", error);
      console.error(`${'═'.repeat(80)}\n`);
      return NextResponse.json(
        { error: "Failed to search documents" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "view" }
);
