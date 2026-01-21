/**
 * Semantic Matching Job Result API Route
 * 
 * GET /api/ai/semantic-matching/result/[jobId]
 * 
 * Retrieves the results of a completed semantic matching job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { getSemanticMatchingResult } from '@/services/ai-risk-service';

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

        // Get job result
        const result = await getSemanticMatchingResult(jobId);

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('Error getting semantic matching result:', error);

        return NextResponse.json(
            {
                error: error.message || 'Failed to get job result',
                details: process.env.NODE_ENV === 'development' ? error : undefined
            },
            { status: 500 }
        );
    }
}

// Export with authentication wrapper
export const GET = withAuthOnly(handler);
