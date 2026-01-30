import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly, AuthenticatedRequest } from '@/lib/api-auth';
import aiApiClient from '@/lib/ai-api-client';
import { aiAuditService } from '@/services/ai-audit-service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/ai/risk-evaluation
 * 
 * Generates AI-powered risk assessment.
 * Standardized with Atomic Audit Hook pattern.
 */
async function handler(
    req: NextRequest,
    _context: any,
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const endpoint = '/api/generate_process_asset_risk_v2';
    let requestPayload: any = {};

    try {
        // Parse request body
        const body = await req.json();
        requestPayload = body;

        // Validate required fields
        if (!body.Process_Details && !body.Assets_Details) {
            return NextResponse.json(
                { error: 'Either Process_Details or Assets_Details is required' },
                { status: 400 }
            );
        }

        // Step 1: Log AIOperation (Request) - Standard Pre-flight Hook
        const operation = await aiAuditService.logOperation({
            endpoint,
            method: 'POST',
            requestBody: requestPayload,
            userId: session.id,
        });

        // Step 2: Call AI service directly via aiApiClient
        const response = await aiApiClient.post(endpoint, {
            Process_Details: body.Process_Details,
            Assets_Details: body.Assets_Details,
        });

        const result = response.data;
        const latencyMs = Date.now() - startTime;

        // Step 3: Log AIOperation (Success Update) - Standard Post-flight Hook
        if (operation) {
            await prisma.aIOperation.update({
                where: { id: operation.id },
                data: {
                    responseBody: JSON.stringify(result),
                    statusCode: 200,
                    latencyMs,
                }
            });
        }

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error('Error in risk evaluation API:', error);

        // Standardized Error Logging
        await aiAuditService.logOperation({
            endpoint,
            method: 'POST',
            requestBody: requestPayload,
            error: error.message || 'Failed to generate risk evaluation',
            statusCode: error.status || 500,
            latencyMs,
            userId: session.id
        });

        return NextResponse.json(
            {
                error: error.message || 'Failed to generate risk evaluation',
                details: error.data || (process.env.NODE_ENV === 'development' ? error : undefined)
            },
            { status: error.status || 500 }
        );
    }
}

// Export with authentication wrapper
export const POST = withAuthOnly(handler);
