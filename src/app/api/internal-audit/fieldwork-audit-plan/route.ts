import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from "@/config/external-apis";

/**
 * POST /api/internal-audit/fieldwork-audit-plan
 * Proxies to RunPod POST /api/fieldwork-audit-plan.
 * Request: { department_name, risks: [{ associated_risk, risks_level }], CAPA?: [...] }
 * Response: { department_name, audit_plan: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { department_name?: string; risks?: Array<{ associated_risk: string; risks_level: string }>; CAPA?: Array<{ finding_name: string; audit_title: string; severity: string }>; target_language?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { department_name, risks, CAPA, target_language } = body;

    // Get target language from body or cookie (defaults to 'en')
    const targetLanguage = target_language || req.cookies.get('NEXT_LOCALE')?.value || 'en';
    if (!department_name || typeof department_name !== "string") {
      return NextResponse.json(
        { error: "department_name is required and must be a string" },
        { status: 400 }
      );
    }
    if (!Array.isArray(risks) || risks.length === 0) {
      return NextResponse.json(
        { error: "risks is required and must be a non-empty array" },
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
      department_name,
      risks: risks.map((r) => ({
        associated_risk: String(r.associated_risk ?? ""),
        risks_level: String(r.risks_level ?? "medium"),
      })),
      target_language: targetLanguage,
      ...(Array.isArray(CAPA) && CAPA.length > 0 ? { CAPA } : {}),
    };

    console.log("[RunPod fieldwork-audit-plan] Request payload:", JSON.stringify(payload, null, 2));
    console.log("[RunPod fieldwork-audit-plan] Target language:", targetLanguage);

    const url = getExternalApiUrl("PYTHON_BACKEND", "/api/fieldwork-audit-plan");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        auth: secret,
      },
      body: JSON.stringify(payload),
    });

    const resText = await res.text();
    console.log("[RunPod fieldwork-audit-plan] Response status:", res.status);
    console.log("[RunPod fieldwork-audit-plan] Response body:", resText);

    if (!res.ok) {
      let errBody: { error?: string; detail?: unknown } = { error: "Audit plan generation failed" };
      try {
        const j = JSON.parse(resText);
        if (j.detail) errBody.detail = j.detail;
        else if (j.error) errBody.error = j.error;
      } catch {
        errBody.error = resText || errBody.error;
      }
      return NextResponse.json(errBody, { status: res.status });
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

    return NextResponse.json(data);
  } catch (e) {
    console.error("[RunPod fieldwork-audit-plan] Error:", e);
    return NextResponse.json(
      { error: "Failed to generate audit plan" },
      { status: 500 }
    );
  }
}
