/**
 * Semantic Matching Job Submission API Route
 * 
 * POST /api/ai/semantic-matching
 * 
 * Submits a semantic matching job to match generated risks
 * against existing risk library.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { submitSemanticMatching } from '@/services/ai-risk-service';
import { ExistingLibrary, GeneratedRiskData } from '@/types/ai-types';

async function handler(req: NextRequest) {
    try {
        // Parse request body
        const body = await req.json();

        // Validate required fields
        if (!body.existing_library || !body.generated_risk) {
            return NextResponse.json(
                { error: 'Both existing_library and generated_risk are required' },
                { status: 400 }
            );
        }

        // Parse the library and risk data
        let existingLibrary: ExistingLibrary;
        let generatedRisk: GeneratedRiskData;

        try {
            existingLibrary = typeof body.existing_library === 'string'
                ? JSON.parse(body.existing_library)
                : body.existing_library;

            generatedRisk = typeof body.generated_risk === 'string'
                ? JSON.parse(body.generated_risk)
                : body.generated_risk;
        } catch (parseError) {
            return NextResponse.json(
                { error: 'Invalid JSON format for existing_library or generated_risk' },
                { status: 400 }
            );
        }

        // Submit semantic matching job
        const result = await submitSemanticMatching(existingLibrary, generatedRisk);

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('Error in semantic matching submission API:', error);

        return NextResponse.json(
            {
                error: error.message || 'Failed to submit semantic matching job',
                details: process.env.NODE_ENV === 'development' ? error : undefined
            },
            { status: 500 }
        );
    }
}

// Export with authentication wrapper
export const POST = withAuthOnly(handler);
