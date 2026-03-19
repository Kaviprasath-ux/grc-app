import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { REGULATORY_AI_BASE_URL, REGULATORY_AI_ENDPOINTS } from '@/lib/regulatory-ai-endpoints';

const API_SECRET = process.env.PYTHON_API_SECRET;

/**
 * POST /api/ai/governance/generate-policy-v2
 *
 * Generates a GRC Policy Document using AI (Advanced AI Review).
 * Calls the external /api/generate_policy_v2 endpoint which:
 * - Accepts GRC control metadata and organizational context
 * - Calls GPT-4o to generate a structured policy
 * - Returns a ready-to-download .docx file
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { policyId } = body;

    if (!policyId) {
      return NextResponse.json(
        { error: 'policyId is required' },
        { status: 400 }
      );
    }

    // Load Policy with linked controls and organization context
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        policyControls: {
          include: {
            control: {
              include: {
                framework: true,
              },
            },
          },
        },
        department: true,
      },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Validate tenant access
    const userCustomerAccountId = session.user.customerAccountId;
    if (userCustomerAccountId && policy.customerAccountId !== userCustomerAccountId) {
      return NextResponse.json(
        { error: 'Access denied to this policy' },
        { status: 403 }
      );
    }

    // Check if policy already has a document
    const existingAttachments = await prisma.policyAttachment.count({
      where: { policyId },
    });
    const existingVaultLinks = await prisma.governanceVaultDocumentLink.count({
      where: { policyId },
    });

    if (existingAttachments > 0 || existingVaultLinks > 0) {
      return NextResponse.json(
        { error: 'Policy already has a document. Delete existing document first.' },
        { status: 400 }
      );
    }

    // Validate linked controls
    if (!policy.policyControls || policy.policyControls.length === 0) {
      return NextResponse.json(
        {
          error: 'Policy has no linked controls',
          details: 'Please link at least one control to this policy before generating.',
        },
        { status: 400 }
      );
    }

    // Get organization for context
    const organization = await prisma.organization.findFirst({
      where: { customerAccountId: policy.customerAccountId },
    });

    // Get the first linked control for the API (primary control)
    const primaryControl = policy.policyControls[0].control;
    const framework = primaryControl.framework;

    // Build the request payload for generate_policy_v2
    const requestPayload = {
      framework_law: framework?.name || 'ISO 27001',
      control_id: primaryControl.controlCode,
      control_name: primaryControl.name,
      control_description: primaryControl.description || primaryControl.name,
      organization_context: organization?.description || `${policy.name} policy for ${organization?.name || 'the organization'}`,
      industry: framework?.industry || 'Technology',
      region: framework?.country || 'Global',
      organization_type: 'Enterprise',
    };

    // Construct the external API URL
    const baseUrl = REGULATORY_AI_BASE_URL.replace(/\/+$/, '');
    const endpoint = REGULATORY_AI_ENDPOINTS.GENERATE_POLICY_V2;
    const apiUrl = `${baseUrl}${endpoint}`;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Generate Policy V2] REQUEST`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[Generate Policy V2] Policy: ${policy.code} - ${policy.name}`);
    console.log(`[Generate Policy V2] API URL: POST ${apiUrl}`);
    console.log(`[Generate Policy V2] Framework: ${framework?.name}, Control: ${primaryControl.controlCode}`);
    console.log(`[Generate Policy V2] Payload:`);
    console.log(JSON.stringify(requestPayload, null, 2));
    console.log(`${'='.repeat(80)}\n`);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    if (API_SECRET) {
      headers['auth'] = API_SECRET;
    }

    // Create AbortController for timeout (5 minutes for AI processing)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    // Call the external API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Generate Policy V2] RESPONSE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[Generate Policy V2] Status: ${response.status} ${response.statusText}`);
    console.log(`[Generate Policy V2] Latency: ${latencyMs}ms`);
    console.log(`[Generate Policy V2] Response Headers:`);
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    if (!response.ok) {
      let errorMessage = 'Policy generation failed';
      const errorBody = await response.text();
      console.log(`[Generate Policy V2] Error Body: ${errorBody}`);

      try {
        const errorData = JSON.parse(errorBody);
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            errorMessage = errorData.detail[0].msg || errorMessage;
          }
        }
      } catch {
        errorMessage = `Policy generation failed with status ${response.status}`;
      }

      console.error(`[Generate Policy V2] Error: ${errorMessage}`);
      console.log(`${'='.repeat(80)}\n`);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Get the DOCX file from response
    const contentType = response.headers.get('content-type') || '';
    const isDocx = contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
                   contentType.includes('application/octet-stream');

    console.log(`[Generate Policy V2] Content-Type: ${contentType}`);
    console.log(`[Generate Policy V2] Is DOCX: ${isDocx}`);

    if (!isDocx) {
      try {
        const jsonResponse = await response.json();
        console.log(`[Generate Policy V2] Unexpected JSON response:`, jsonResponse);
        console.log(`${'='.repeat(80)}\n`);
        return NextResponse.json(
          { error: 'Unexpected response format from AI service' },
          { status: 502 }
        );
      } catch {
        console.log(`${'='.repeat(80)}\n`);
        return NextResponse.json(
          { error: 'Unexpected response format from AI service' },
          { status: 502 }
        );
      }
    }

    // Read the DOCX file from the response
    const docxBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[Generate Policy V2] DOCX Size: ${docxBuffer.length} bytes`);

    // Save the DOCX as an attachment
    const timestamp = Date.now();
    const generatedFileName = `${policy.name.replace(/[^a-zA-Z0-9]/g, '_')}_AI_Generated_${timestamp}.docx`;
    const uploadDir = join(process.cwd(), 'uploads', 'governance', policyId);
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, generatedFileName);
    await writeFile(filePath, docxBuffer);
    const relativePath = `/uploads/governance/${policyId}/${generatedFileName}`;

    // Create attachment record in database
    const attachment = await prisma.policyAttachment.create({
      data: {
        policyId,
        fileName: generatedFileName,
        fileType: 'docx',
        fileSize: docxBuffer.length,
        filePath: relativePath,
        uploadedById: session.user.id,
      },
    });

    // Update policy status to Draft (since we generated a new document)
    await prisma.policy.update({
      where: { id: policyId },
      data: {
        status: 'Draft',
        aiReviewStatus: 'Advanced Review Completed',
        aiReviewJustification: `AI-generated policy document based on ${policy.policyControls.length} linked control(s) from ${framework?.name || 'framework'}.`,
      },
    });

    console.log(`[Generate Policy V2] Document saved: ${generatedFileName}`);
    console.log(`[Generate Policy V2] Attachment ID: ${attachment.id}`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({
      success: true,
      message: 'Policy document generated successfully',
      attachment: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        filePath: attachment.filePath,
        uploadedAt: attachment.uploadedAt.toISOString(),
      },
      framework: framework?.name,
      controlCode: primaryControl.controlCode,
      controlsUsed: policy.policyControls.length,
      latencyMs,
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const err = error as { message?: string; name?: string };

    if (err.name === 'AbortError') {
      console.error(`[Generate Policy V2] Timeout after ${latencyMs}ms`);
      return NextResponse.json(
        { error: 'Policy generation timed out. Please try again.' },
        { status: 504 }
      );
    }

    console.error(`[Generate Policy V2] Error after ${latencyMs}ms:`, err.message);
    return NextResponse.json(
      { error: 'Failed to generate policy document. Please try again.' },
      { status: 500 }
    );
  }
}
