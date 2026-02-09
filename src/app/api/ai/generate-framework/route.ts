import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/generate-framework
 *
 * Submit a framework generation job to the Python backend.
 * This is Step 1 of the 3-step async process.
 *
 * RunPod Endpoint: POST /api/generate_framework_job
 * 
 * Request (multipart/form-data):
 * - framework_name: string (required)
 * - attachment: File (optional)
 * - library: string (optional)
 * 
 * Response:
 * - job_id: string (use this for polling)
 * - status: "queued"
 * - message: string
 * 
 * TESTING FLOW:
 * Step 1: POST /api/ai/generate-framework → Get job_id
 * Step 2: Poll GET /api/ai/framework-status/{job_id} every 15s
 * Step 3: When complete, GET /api/ai/framework-result/{job_id} → Persists data
 */
async function handler(req: NextRequest, _context: any, session: AuthenticatedRequest['user']) {
    const startTime = Date.now();
    const endpoint = "/api/generate_framework_job";
    let jobId: string | undefined;
    let requestPayload: any = {};

    try {
        const formData = await req.formData();

        const frameworkName = formData.get("framework_name") as string;
        const attachment = formData.get("attachment") as File | null;
        const library = formData.get("library") as string | null;
        const description = formData.get("description") as string | null;
        const type = formData.get("type") as string | null;
        const country = formData.get("country") as string | null;
        const industry = formData.get("industry") as string | null;
        const code = formData.get("code") as string | null;

        requestPayload = {
            framework_name: frameworkName,
            has_attachment: !!attachment,
            library,
            description,
            type,
            country,
            industry,
            code
        };

        if (!frameworkName) {
            return NextResponse.json(
                { error: "framework_name is required" },
                { status: 400 }
            );
        }


        const existingFramework = await prisma.framework.findFirst({
            where: {
                ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
                name: frameworkName,
            },
        });

        if (existingFramework) {
            console.log(`
⚠️  DUPLICATE FRAMEWORK DETECTED
[${new Date().toISOString()}]

📊 FRAMEWORK DETAILS:
  • Name: ${frameworkName}
  • Existing ID: ${existingFramework.id}
  • Status: ${existingFramework.status}
  • Created: ${existingFramework.createdAt}

❌ REQUEST REJECTED: Framework with this name already exists
`);

            return NextResponse.json(
                {
                    error: "Framework with this name already exists",
                    existingFrameworkId: existingFramework.id,
                    existingFramework: {
                        id: existingFramework.id,
                        name: existingFramework.name,
                        code: existingFramework.code,
                        status: existingFramework.status,
                    },
                },
                { status: 409 } // Conflict
            );
        }

        // ═══════════════════════════════════════════════════════════════
        // BUILD LIBRARY: Fetch user's controls, evidences, policies
        // API expects: { control_library, evidence_library, governance_library }
        // ═══════════════════════════════════════════════════════════════
        let libraryPayload = library;
        if (session.customerAccountId) {
            const [controls, evidences, policies] = await Promise.all([
                prisma.control.findMany({
                    where: { customerAccountId: session.customerAccountId },
                    select: { name: true, controlCode: true },
                    orderBy: { controlCode: "asc" },
                }),
                prisma.evidence.findMany({
                    where: { customerAccountId: session.customerAccountId },
                    select: { name: true, evidenceCode: true },
                    orderBy: { evidenceCode: "asc" },
                }),
                prisma.policy.findMany({
                    where: { customerAccountId: session.customerAccountId },
                    select: { name: true, code: true },
                    orderBy: { code: "asc" },
                }),
            ]);

            const libraryObj = {
                control_library: controls.map((c) => ({
                    control_name: c.name,
                    control_code: c.controlCode || c.name,
                })),
                evidence_library: evidences.map((e) => ({
                    evidence_name: e.name,
                    evidence_code: e.evidenceCode || e.name,
                })),
                governance_library: policies.map((p) => ({
                    policy_procedure_name: p.name,
                    policy_procedure_code: p.code || p.name,
                })),
            };
            libraryPayload = JSON.stringify(libraryObj);
            requestPayload.library_summary = { controlCount: controls.length, evidenceCount: evidences.length, policyCount: policies.length };
            console.log(`📚 Library built: ${controls.length} controls, ${evidences.length} evidences, ${policies.length} policies`);
        }

        // Prepare request to Python backend using aiApiClient
        const backendFormData = new FormData();
        backendFormData.append("framework_name", frameworkName);

        if (attachment) {
            backendFormData.append("attachment", attachment);
        }

        if (libraryPayload) {
            backendFormData.append("library", libraryPayload);
        }

        // Log full payload for debugging
        const payloadLog = {
            framework_name: frameworkName,
            attachment: attachment ? { name: attachment.name, size: attachment.size } : null,
            library: libraryPayload ? JSON.parse(libraryPayload as string) : null,
        };
        console.log("[AI Framework] Payload being sent to RunPod:", JSON.stringify(payloadLog, null, 2));

        const createdAt = new Date().toISOString();
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║          🔵 STEP 1/3: JOB CREATION                              ║
║          POST /api/ai/generate-framework                       ║
╚════════════════════════════════════════════════════════════════╝
[${createdAt}]

📋 REQUEST PARAMETERS:
  Framework Name    : ${frameworkName}
  Code              : ${code || 'AUTO-GENERATED'}
  Type              : ${type || 'N/A'}
  Country           : ${country || 'N/A'}
  Industry          : ${industry || 'N/A'}
  Description       : ${description ? 'YES' : 'NO'}
  Library           : ${libraryPayload ? `YES (user data: controls/evidences/policies)` : 'N/A'}
  Attachment        : ${attachment ? 'YES (' + attachment.name + ')' : 'NO'}
  Customer ID       : ${session.customerAccountId || 'NOT SET'}
  User ID           : ${session.id}

📤 SUBMITTING TO PYTHON BACKEND:
  Endpoint          : POST /api/generate_framework_job
  Backend URL       : https://a4t2jogsl4815o-9000.proxy.runpod.net/
`);

        // Call Python backend via centralized client (no Content-Type for FormData - fetch sets boundary)
        const response = await aiApiClient.post(endpoint, backendFormData);

        const result = response.data as { job_id?: string; status?: string };
        jobId = result.job_id;
        const latency = Date.now() - startTime;

        console.log(`
✅ JOB CREATED SUCCESSFULLY
[${new Date().toISOString()}]

📊 JOB RESPONSE FROM PYTHON BACKEND:
  Job ID            : ${jobId} ← USE THIS FOR POLLING
  Status            : ${result.status}
  Response Time     : ${latency}ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ STEP 2/3: POLLING (Every 15 seconds for 120 minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 POLLING SETUP:
  Endpoint          : GET /api/ai/framework-status/${jobId}
  Interval          : Every 15 seconds
  Timeout           : 120 minutes
  
✅ This is automatic - UI will poll in background

Expected Status Transitions:
  QUEUED → PROCESSING → COMPLETED

Manual Test (if needed):
  curl "http://localhost:3000/api/ai/framework-status/${jobId}" \\
    -H "Authorization: Bearer YOUR_TOKEN"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ STEP 3/3: RESULT RETRIEVAL & PERSISTENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When Job COMPLETED:
  Endpoint          : GET /api/ai/framework-result/${jobId}
  
This automatically:
  1. Fetches results from Python backend
  2. Extracts 114+ requirements & 200+ controls
  3. Persists to database (ATOMIC TRANSACTION)
  4. Returns success response

Manual Test (after COMPLETED):
  curl "http://localhost:3000/api/ai/framework-result/${jobId}" \\
    -H "Authorization: Bearer YOUR_TOKEN"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  T=0s         : ✅ Job submitted
  T=0-120min   : ⏳ AI processing (background)
  T=Completion : 📥 Result fetched & persisted
  
Job ID Reference: ${jobId}
`);

        // DATABASE: Create Job and Log Operation
        if (jobId) {
            const jobRecord = await aiAuditService.createJob({
                providerJobId: jobId,
                type: 'FRAMEWORK_GEN',
                userId: session.id,
                metadata: requestPayload
            });
            console.log(`✅ Database: AIJob record created [ID: ${jobRecord.id}]`);
        }

        const logRecord = await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'POST',
            requestBody: requestPayload,
            responseBody: result,
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });
        if (logRecord) {
            console.log(`✅ Database: Operation logged [ID: ${logRecord.id}]\\n`);
        }

        return NextResponse.json(result);
    } catch (error: any) {
        const errorTime = new Date().toISOString();
        const latency = Date.now() - startTime;
        console.error(`
╔════════════════════════════════════════════════════════════════╗
║          ❌ STEP 1/3: JOB CREATION FAILED                       ║
║          Cannot submit to Python backend                       ║
╚════════════════════════════════════════════════════════════════╝
[${errorTime}]

📊 ERROR DETAILS:
  Framework Name    : ${requestPayload.framework_name || 'NOT SET'}
  Error Message     : ${error.message || 'Unknown error'}
  HTTP Status       : ${error.status || 'N/A'}
  Response Time     : ${latency}ms
  Error Code        : ${error.code || 'UNKNOWN'}

📍 FAILURE POINT:
  Stage             : Job Submission to Python Backend
  Endpoint Called   : POST /api/generate_framework_job
  Backend URL       : https://a4t2jogsl4815o-9000.proxy.runpod.net/

🔧 TROUBLESHOOTING:

1️⃣  Check Python Backend Status:
    • Visit: https://a4t2jogsl4815o-9000.proxy.runpod.net/health
    • Should return 200 OK

2️⃣  Verify Environment Variables:
    • PYTHON_API_SECRET - Must be set and valid
    • PYTHON_API_URL - Check value
    • Run: grep -E 'PYTHON_API' .env

3️⃣  Check Network Connectivity:
    • Test connection: curl https://a4t2jogsl4815o-9000.proxy.runpod.net/
    • Check firewall/proxy settings
    • Verify VPN if required

4️⃣  Review Python Backend Logs:
    • SSH to RunPod instance
    • Check job submission logs
    • Look for validation errors

5️⃣  Validate Request Data:
    • Framework Name provided: ${requestPayload.framework_name ? 'YES' : 'NO'}
    • Customer ID available: ${session.customerAccountId ? 'YES' : 'NO'}
    • All fields valid JSON: Check logs above

📋 REQUEST THAT FAILED:
  Framework     : ${requestPayload.framework_name || 'NOT SET'}
  Type          : ${requestPayload.type || 'N/A'}
  Country       : ${requestPayload.country || 'N/A'}
  Industry      : ${requestPayload.industry || 'N/A'}
  Description   : ${requestPayload.description || 'N/A'}
`);

        const statusCode = error.status || 500;
        const errorMsg = error.message || "Internal server error";

        // Log failed operation
        await aiAuditService.logOperation({
            endpoint,
            method: 'POST',
            requestBody: requestPayload,
            error: errorMsg,
            statusCode,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json(
            {
                error: "Failed to submit framework generation job",
                details: error.data || errorMsg
            },
            { status: statusCode }
        );
    }
}

export const POST = withAuthOnly(handler);
