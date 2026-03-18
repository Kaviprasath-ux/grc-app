import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { REGULATORY_AI_BASE_URL, REGULATORY_AI_ENDPOINTS } from '@/lib/regulatory-ai-endpoints';

const API_SECRET = process.env.PYTHON_API_SECRET;

/**
 * POST /api/ai/governance/review-policy
 *
 * Performs Advanced AI Policy Compliance Review.
 * Calls the external /api/review-policy endpoint which accepts:
 * - policy_document: The policy file (PDF or DOCX)
 * - internal_controls: JSON array of controls with control_code and control_name
 * - regulations: Array of regulation/framework names
 *
 * Returns a DOCX compliance analysis report which is saved as an attachment.
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

    // Load Policy with attachments and linked controls
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        attachments: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
        vaultDocumentLinks: {
          include: {
            document: true,
          },
          take: 1,
        },
        policyControls: {
          include: {
            control: {
              include: {
                framework: true,
              },
            },
          },
        },
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

    // Get the policy document file
    let fileBuffer: Buffer | null = null;
    let fileName: string = '';
    let fileType: string = '';

    // Try policy attachment first, then vault document
    if (policy.attachments && policy.attachments.length > 0) {
      const attachment = policy.attachments[0];
      fileName = attachment.fileName;
      fileType = attachment.fileType || '';

      const relativePath = attachment.filePath.startsWith('/')
        ? attachment.filePath.slice(1)
        : attachment.filePath;
      const absolutePath = join(process.cwd(), relativePath);

      try {
        fileBuffer = await readFile(absolutePath);
      } catch (err) {
        console.error('[Review Policy] Failed to read attachment file:', err);
      }
    } else if (policy.vaultDocumentLinks && policy.vaultDocumentLinks.length > 0) {
      const vaultDoc = policy.vaultDocumentLinks[0].document;
      fileName = vaultDoc.fileName;
      fileType = vaultDoc.fileType || '';

      const relativePath = vaultDoc.filePath.startsWith('/')
        ? vaultDoc.filePath.slice(1)
        : vaultDoc.filePath;
      const absolutePath = join(process.cwd(), relativePath);

      try {
        fileBuffer = await readFile(absolutePath);
      } catch (err) {
        console.error('[Review Policy] Failed to read vault document file:', err);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'No policy document found. Please upload a policy document first.' },
        { status: 400 }
      );
    }

    // Validate file type (PDF or DOCX)
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'docx'].includes(ext)) {
      return NextResponse.json(
        { error: 'Policy document must be PDF or DOCX format' },
        { status: 400 }
      );
    }

    // Build internal_controls JSON array
    const internalControls = policy.policyControls.map(pc => ({
      control_code: pc.control.controlCode,
      control_name: pc.control.name,
    }));

    if (internalControls.length === 0) {
      return NextResponse.json(
        {
          error: 'Policy has no linked controls',
          details: 'Please link at least one control to this policy before running AI review.',
        },
        { status: 400 }
      );
    }

    // Build regulations array (unique framework names)
    const regulationsSet = new Set<string>();
    policy.policyControls.forEach(pc => {
      if (pc.control.framework?.name) {
        regulationsSet.add(pc.control.framework.name);
      }
    });
    const regulations = Array.from(regulationsSet);

    if (regulations.length === 0) {
      return NextResponse.json(
        {
          error: 'No regulations/frameworks found',
          details: 'Linked controls must have associated frameworks for AI review.',
        },
        { status: 400 }
      );
    }

    // Construct the external API URL
    const baseUrl = REGULATORY_AI_BASE_URL.replace(/\/+$/, '');
    const endpoint = REGULATORY_AI_ENDPOINTS.REVIEW_POLICY;
    const apiUrl = `${baseUrl}${endpoint}`;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Review Policy] REQUEST`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[Review Policy] Policy: ${policy.code} - ${policy.name}`);
    console.log(`[Review Policy] API URL: POST ${apiUrl}`);
    console.log(`[Review Policy] Document: ${fileName} (${ext.toUpperCase()}, ${fileBuffer.length} bytes)`);
    console.log(`[Review Policy] Internal Controls (${internalControls.length}):`);
    console.log(JSON.stringify(internalControls, null, 2));
    console.log(`[Review Policy] Regulations (${regulations.length}): ${regulations.join(', ')}`);
    console.log(`${'='.repeat(80)}\n`);

    // Build multipart form data for the external API
    const formData = new FormData();

    // Add the policy document file
    const mimeType = ext === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const fileData = new Uint8Array(fileBuffer);
    const blob = new Blob([fileData], { type: mimeType });
    formData.append('policy_document', blob, fileName);

    // Add internal_controls as JSON string
    formData.append('internal_controls', JSON.stringify(internalControls));

    // Add regulations as multiple values
    regulations.forEach(reg => {
      formData.append('regulations', reg);
    });

    // Build headers
    const headers: Record<string, string> = {};
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
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Review Policy] RESPONSE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[Review Policy] Status: ${response.status} ${response.statusText}`);
    console.log(`[Review Policy] Latency: ${latencyMs}ms`);
    console.log(`[Review Policy] Response Headers:`);
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    if (!response.ok) {
      let errorMessage = 'AI review failed';
      const errorBody = await response.text();
      console.log(`[Review Policy] Error Body: ${errorBody}`);

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
        errorMessage = `AI review failed with status ${response.status}`;
      }

      console.error(`[Review Policy] Error: ${errorMessage}`);
      console.log(`${'='.repeat(80)}\n`);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Get the response - could be DOCX or JSON
    const contentType = response.headers.get('content-type') || '';
    console.log(`[Review Policy] Content-Type: ${contentType}`);

    const isDocx = contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
                   contentType.includes('application/octet-stream');

    if (isDocx) {
      // Read the DOCX file from the response
      const docxBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`[Review Policy] DOCX Size: ${docxBuffer.length} bytes`);

      // Save the DOCX to a separate ai-reviews folder (NOT as attachment)
      const timestamp = Date.now();
      const reviewFileName = `AI_Compliance_Review_${policy.code}_${timestamp}.docx`;
      const uploadDir = join(process.cwd(), 'uploads', 'ai-reviews', policyId);
      await mkdir(uploadDir, { recursive: true });
      const filePath = join(uploadDir, reviewFileName);
      await writeFile(filePath, docxBuffer);
      const relativePath = `/uploads/ai-reviews/${policyId}/${reviewFileName}`;

      // Update policy AI review status with report path (stored as JSON)
      const reviewData = {
        fileName: reviewFileName,
        filePath: relativePath,
        fileSize: docxBuffer.length,
        createdAt: new Date().toISOString(),
        controlsAnalyzed: internalControls.length,
        regulationsChecked: regulations,
      };

      await prisma.policy.update({
        where: { id: policyId },
        data: {
          aiReviewStatus: 'Advanced Review Completed',
          aiReviewJustification: JSON.stringify(reviewData),
        },
      });

      console.log(`[Review Policy] Report saved: ${reviewFileName}`);
      console.log(`[Review Policy] Report path: ${relativePath}`);
      console.log(`${'='.repeat(80)}\n`);

      return NextResponse.json({
        success: true,
        message: 'AI compliance review completed successfully',
        report: {
          fileName: reviewFileName,
          filePath: relativePath,
          fileSize: docxBuffer.length,
        },
        controlsAnalyzed: internalControls.length,
        regulationsChecked: regulations,
        latencyMs,
      });
    } else {
      // Response is JSON - return the analysis directly
      const jsonResponse = await response.json();
      console.log(`[Review Policy] JSON Response:`, JSON.stringify(jsonResponse, null, 2));
      console.log(`${'='.repeat(80)}\n`);

      // Update policy AI review status
      await prisma.policy.update({
        where: { id: policyId },
        data: {
          aiReviewStatus: 'Advanced Review Completed',
          aiReviewJustification: jsonResponse.summary || `AI compliance review completed for ${internalControls.length} control(s).`,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'AI compliance review completed successfully',
        analysis: jsonResponse,
        controlsAnalyzed: internalControls.length,
        regulationsChecked: regulations,
        latencyMs,
      });
    }
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const err = error as { message?: string; name?: string };

    if (err.name === 'AbortError') {
      console.error(`[Review Policy] Timeout after ${latencyMs}ms`);
      return NextResponse.json(
        { error: 'AI review timed out. Please try again.' },
        { status: 504 }
      );
    }

    console.error(`[Review Policy] Error after ${latencyMs}ms:`, err.message);
    return NextResponse.json(
      { error: 'Failed to perform AI review. Please try again.' },
      { status: 500 }
    );
  }
}
