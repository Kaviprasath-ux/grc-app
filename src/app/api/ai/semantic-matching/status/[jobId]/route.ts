/**
 * Semantic Matching Job Status API Route
 * 
 * GET /api/ai/semantic-matching/status/[jobId]
 * 
 * Checks the status of a semantic matching job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { checkSemanticMatchingStatus } from '@/services/ai-risk-service';

async function handler(
    req: NextRequest,
    context: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await context.params;

        if (!jobId) {
            return NextResponse.json(
                { error: 'Job ID is required' },
                { status: 400 }
            );
        }

        // Check job status
        const result = await checkSemanticMatchingStatus(jobId);

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('Error checking semantic matching status:', error);

        return NextResponse.json(
            {
                error: error.message || 'Failed to check job status',
                details: process.env.NODE_ENV === 'development' ? error : undefined
            },
            { status: 500 }
        );
    }
}

// Export with authentication wrapper
export const GET = withAuthOnly(handler);
