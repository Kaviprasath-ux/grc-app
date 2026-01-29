import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from "@/config/external-apis";

const DOC_LIB_CUSTOMER_ID =
  process.env.DOCUMENT_LIBRARY_CUSTOMER_ID || "document-library";

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
    session: { id?: string }
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

      const payload = {
        question: query.trim(),
        customer_id: DOC_LIB_CUSTOMER_ID,
        context_status: true,
      };

      const url = getExternalApiUrl("PYTHON_BACKEND", "/api/simple_query");
      console.log(
        "[RunPod simple_query] Document Library search, question=" +
          query.slice(0, 80) +
          "..."
      );
      console.log("[RunPod simple_query] Calling RunPod POST " + url);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          auth: secret,
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      console.log(
        "[RunPod simple_query] Document Library response status: " + res.status
      );
      console.log(
        "[RunPod simple_query] Document Library response body: " +
          resText.slice(0, 300) +
          (resText.length > 300 ? "..." : "")
      );

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

      return NextResponse.json({
        id: search.id,
        query: query.trim(),
        result,
        status,
        documents,
        timestamp: search.createdAt,
      });
    } catch (error) {
      console.error("Error searching documents:", error);
      return NextResponse.json(
        { error: "Failed to search documents" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "view" }
);
