import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from "@/config/external-apis";

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"];
const MAX_FILE_SIZE_MB = 20;
const MAX_FILES = 10;

function isAllowedFile(name: string, size: number): boolean {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
  if (size > MAX_FILE_SIZE_MB * 1024 * 1024) return false;
  return true;
}

// POST - AI risk suggestion via RunPod /api/assess-risks
export async function POST(request: NextRequest) {
  try {
    console.log("[RunPod assess-risks] POST /api/internal-audit/risk-identification/suggest received");

    const session = await auth();
    if (!session?.user) {
      console.log("[RunPod assess-risks] Abort: Unauthorized (no session)");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const departmentId = formData.get("departmentId") as string;
    const auditFocus = (formData.get("auditFocus") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!departmentId) {
      console.log("[RunPod assess-risks] Abort: Department is required");
      return NextResponse.json(
        { error: "Department is required" },
        { status: 400 }
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      console.log("[RunPod assess-risks] Abort: Department not found for id=" + departmentId);
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
    if (!secret) {
      console.log("[RunPod assess-risks] Abort: Missing PYTHON_API_SECRET");
      return NextResponse.json(
        { error: "Server misconfiguration: missing API secret" },
        { status: 500 }
      );
    }

    const payload = new FormData();
    payload.append("department", department.name);
    if (auditFocus.trim()) {
      payload.append("specific_audit_focus", auditFocus.trim());
    }

    const validFiles = files.filter(
      (f): f is File => f instanceof File && f.size > 0 && isAllowedFile(f.name, f.size)
    );
    if (validFiles.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 }
      );
    }
    for (const f of validFiles) {
      payload.append("files", f);
    }

    const url = getExternalApiUrl("PYTHON_BACKEND", "/api/assess-risks");
    console.log("[RunPod assess-risks] Request -> department=" + department.name + ", auditFocus=" + (auditFocus || "(none)") + ", filesCount=" + validFiles.length);
    console.log("[RunPod assess-risks] Calling RunPod POST " + url);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        auth: secret,
      },
      body: payload,
    });

    const resText = await res.text();
    console.log("[RunPod assess-risks] RunPod response status: " + res.status);
    console.log("[RunPod assess-risks] RunPod response body: " + resText);

    if (!res.ok) {
      console.log("[RunPod assess-risks] RunPod call failed, returning error to client");
      const errText = resText;
      let errBody: { error?: string; detail?: unknown } = { error: "AI risk assessment failed" };
      try {
        const j = JSON.parse(errText);
        if (j.detail) errBody.detail = j.detail;
        else if (j.error) errBody.error = j.error;
      } catch {
        errBody.error = errText || errBody.error;
      }
      return NextResponse.json(errBody, { status: res.status });
    }

    let data: unknown;
    try {
      data = JSON.parse(resText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON response from RunPod" }, { status: 502 });
    }
    const count = typeof data === "object" && data !== null && Array.isArray((data as { generated_risks?: unknown[] }).generated_risks)
      ? (data as { generated_risks: unknown[] }).generated_risks.length
      : 0;
    console.log("[RunPod assess-risks] Success, returning " + count + " generated risk(s) to client");
    return NextResponse.json(data);
  } catch (e) {
    console.error("[RunPod assess-risks] Error suggesting risks:", e);
    return NextResponse.json(
      { error: "Failed to suggest risks" },
      { status: 500 }
    );
  }
}
