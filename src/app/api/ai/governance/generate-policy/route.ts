import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  unauthorizedResponse,
  badRequestResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";

/**
 * POST /api/ai/governance/generate-policy
 *
 * Generates a policy document via RunPod /api/generate_policy/.
 *
 * Required body: { policyId: string, templateId: string }
 *
 * Uses:
 * - Linked controls as mapped_controls (JSON array string)
 * - Framework names from linked controls (JSON array string)
 * - Selected GovernanceTemplate (.docx) as template file
 *
 * RunPod API expects:
 * - document_type: string
 * - document_name: string
 * - framework_names: JSON array string (e.g., '["ISO 27001", "NIST"]')
 * - mapped_controls: JSON array string (e.g., '["Control 1", "Control 2"]')
 * - template: .docx file
 *
 * RunPod API returns:
 * - message: string
 * - document_name: string
 * - base64_doc: base64 encoded document
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return unauthorizedResponse();
        }
        userId = session.user.id;

        const body = await req.json();
        const { policyId, templateId } = body;

        if (!policyId) {
            return badRequestResponse("policyId is required");
        }

        if (!templateId) {
            return badRequestResponse("templateId is required - please select a template");
        }

        // Fetch Policy with Controls and their Frameworks
        const policy = await prisma.policy.findUnique({
            where: { id: policyId },
            include: {
                policyControls: {
                    include: {
                        control: {
                            include: {
                                framework: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!policy) {
            return notFoundResponse("Policy");
        }

        // Validate: Policy must have linked controls
        if (policy.policyControls.length === 0) {
            return badRequestResponse("Policy must have at least one linked control to generate document");
        }

        // Fetch the selected GovernanceTemplate
        const governanceTemplate = await prisma.governanceTemplate.findUnique({
            where: { id: templateId }
        });

        if (!governanceTemplate) {
            return notFoundResponse("Template");
        }

        // Validate template is .docx
        if (governanceTemplate.fileType !== "docx") {
            return badRequestResponse("Only .docx templates are supported for AI generation");
        }

        // Log AIOperation (Request)
        const operation = await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.GENERATE_POLICY,
            method: "POST",
            requestBody: { policyId, templateId },
            userId,
        });

        console.log(`[Governance Generate] ══════════════════════════════════════════════`);
        console.log(`[Governance Generate] Starting policy generation`);
        console.log(`[Governance Generate] Policy ID: ${policyId}`);
        console.log(`[Governance Generate] Policy Code: ${policy.code}`);
        console.log(`[Governance Generate] Policy Name: ${policy.name}`);
        console.log(`[Governance Generate] Document Type: ${policy.documentType}`);
        console.log(`[Governance Generate] Linked Controls: ${policy.policyControls.length}`);
        console.log(`[Governance Generate] Template: ${governanceTemplate.name} (${governanceTemplate.fileName})`);
        console.log(`[Governance Generate] ──────────────────────────────────────────────`);

        // Build mapped_controls from linked controls
        // Format: array of control descriptions for the AI to use
        const mappedControlsArray: string[] = policy.policyControls.map(pc => {
            const control = pc.control;
            // Use control code and name, optionally with description
            if (control.description) {
                return `${control.controlCode}: ${control.name} - ${control.description.substring(0, 150)}`;
            }
            return `${control.controlCode}: ${control.name}`;
        });

        // Extract unique framework names from linked controls
        const frameworkNamesSet = new Set<string>();
        policy.policyControls.forEach(pc => {
            if (pc.control.framework?.name) {
                frameworkNamesSet.add(pc.control.framework.name);
            }
        });
        const frameworkNames: string[] = frameworkNamesSet.size > 0
            ? Array.from(frameworkNamesSet)
            : ["General"];

        // Load template file
        const absolutePath = path.join(process.cwd(), "public", governanceTemplate.filePath);
        let templateBuffer: Buffer;
        try {
            templateBuffer = await readFile(absolutePath);
            console.log(`[Governance Generate] Loaded template: ${governanceTemplate.fileName} (${templateBuffer.length} bytes)`);
        } catch (e) {
            console.error(`[Governance Generate] Could not read template at ${absolutePath}`);
            return errorResponse(`Template file not found: ${governanceTemplate.fileName}`, 404);
        }

        // Build FormData for RunPod API
        // IMPORTANT: RunPod expects arrays as JSON-encoded strings, not multiple form fields
        const formData = new FormData();
        formData.append("document_type", (policy.documentType || "Policy").toLowerCase());
        formData.append("document_name", policy.name);

        // Send as plain strings (RunPod expects plain strings, not JSON arrays)
        formData.append("framework_names", frameworkNames.join(", "));
        formData.append("mapped_controls", mappedControlsArray.join("\n"));

        // Add template file (.docx)
        // Use File instead of Blob for better Node.js fetch compatibility
        const templateFile = new File(
            [new Uint8Array(templateBuffer)],
            governanceTemplate.fileName,
            { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
        );
        formData.append("template", templateFile);

        // Log FormData parameters
        console.log(`[Governance Generate] ──────────────────────────────────────────────`);
        console.log(`[Governance Generate] FormData Parameters:`);
        console.log(`[Governance Generate]   document_type: ${(policy.documentType || "Policy").toLowerCase()}`);
        console.log(`[Governance Generate]   document_name: ${policy.name}`);
        console.log(`[Governance Generate]   framework_names: ${frameworkNames.join(", ")}`);
        console.log(`[Governance Generate]   mapped_controls (${mappedControlsArray.length} items): ${mappedControlsArray.join(" | ").substring(0, 200)}...`);
        console.log(`[Governance Generate]   template: ${governanceTemplate.fileName} (${templateFile.size} bytes)`);
        console.log(`[Governance Generate] ──────────────────────────────────────────────`);
        console.log(`[Governance Generate] Calling RunPod endpoint: ${AI_ENDPOINTS.GENERATE_POLICY}`);

        // Call RunPod AI API
        const response = await aiApiClient.post(AI_ENDPOINTS.GENERATE_POLICY, formData);

        // RunPod response format: { message, document_name, base64_doc }
        const responseData = response.data as {
            message?: string;
            document_name?: string;
            base64_doc?: string;
            error?: string;
        };

        // Check for error in response
        if (responseData.error) {
            throw new Error(responseData.error);
        }

        const { base64_doc, document_name } = responseData;
        const latencyMs = Date.now() - startTime;

        console.log(`[Governance Generate] ──────────────────────────────────────────────`);
        console.log(`[Governance Generate] RunPod Response received`);
        console.log(`[Governance Generate]   message: ${responseData.message}`);
        console.log(`[Governance Generate]   document_name: ${document_name}`);
        console.log(`[Governance Generate]   base64_doc length: ${base64_doc?.length || 0} chars`);

        if (!base64_doc) {
            throw new Error("AI service returned empty document content");
        }

        // Decode and save the generated file
        const buffer = Buffer.from(base64_doc, "base64");
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "policies");
        await mkdir(uploadsDir, { recursive: true });

        const timestamp = Date.now();
        const sanitizedName = policy.name.replace(/[^a-zA-Z0-9-_]/g, '-');
        // Output is .docx as per RunPod API
        const finalFileName = `${sanitizedName}-${timestamp}.docx`;
        const filePath = path.join(uploadsDir, finalFileName);
        const publicPath = `/uploads/policies/${finalFileName}`;

        await writeFile(filePath, buffer);

        console.log(`[Governance Generate] ══════════════════════════════════════════════`);
        console.log(`[Governance Generate] SUCCESS - Policy Generated!`);
        console.log(`[Governance Generate]   File Name: ${finalFileName}`);
        console.log(`[Governance Generate]   File Size: ${buffer.length} bytes`);
        console.log(`[Governance Generate]   Public Path: ${publicPath}`);
        console.log(`[Governance Generate]   Latency: ${latencyMs}ms`);
        console.log(`[Governance Generate] ══════════════════════════════════════════════`);

        // Update AIOperation log
        if (operation) {
            await prisma.aIOperation.update({
                where: { id: operation.id },
                data: {
                    responseBody: JSON.stringify({ document_name, status: "generated" }),
                    statusCode: 200,
                    latencyMs,
                }
            });
        }

        // Create attachment record
        const attachment = await prisma.policyAttachment.create({
            data: {
                policyId,
                fileName: finalFileName,
                fileType: "docx",
                fileSize: buffer.length,
                filePath: publicPath,
            }
        });

        // Update policy status
        await prisma.policy.update({
            where: { id: policyId },
            data: { status: "Draft" }
        });

        return NextResponse.json({
            success: true,
            downloadUrl: publicPath,
            attachmentId: attachment.id,
            fileName: finalFileName,
            fileSize: buffer.length,
            controlsUsed: mappedControlsArray.length,
            frameworksUsed: frameworkNames,
            templateUsed: governanceTemplate.name,
        });

    } catch (error: unknown) {
        const latencyMs = Date.now() - startTime;
        const err = error as { message?: string; status?: number; data?: unknown };

        console.error(`[Governance Generate] ══════════════════════════════════════════════`);
        console.error(`[Governance Generate] ERROR - Policy Generation Failed!`);
        console.error(`[Governance Generate]   Message: ${err.message}`);
        console.error(`[Governance Generate]   Status: ${err.status || 500}`);
        console.error(`[Governance Generate]   Latency: ${latencyMs}ms`);
        if (err.data) {
            console.error(`[Governance Generate]   Data: ${JSON.stringify(err.data)}`);
        }
        console.error(`[Governance Generate] ══════════════════════════════════════════════`);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.GENERATE_POLICY,
            method: "POST",
            error: err.message || "Unknown error",
            statusCode: err.status || 500,
            latencyMs,
            userId,
        });

        return errorResponse(err.message || "Failed to generate policy", err.status || 500);
    }
}
