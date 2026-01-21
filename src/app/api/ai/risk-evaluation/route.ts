/**
 * AI Risk Evaluation API Route
 * 
 * POST /api/ai/risk-evaluation
 * 
 * Generates AI-powered risk assessment for a process based on:
 * - Process details (name, description, department)
 * - Asset dependencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { generateProcessRisks } from '@/services/ai-risk-service';
import { RiskGenerationRequest } from '@/types/ai-types';

async function handler(req: NextRequest) {
    try {
        // Parse request body
        const body = await req.json();

        // Validate required fields
        if (!body.Process_Details && !body.Assets_Details) {
            return NextResponse.json(
                { error: 'Either Process_Details or Assets_Details is required' },
                { status: 400 }
            );
        }

        // Prepare request for AI service
        const request: RiskGenerationRequest = {
            Process_Details: body.Process_Details,
            Assets_Details: body.Assets_Details,
        };

        // Call AI service to generate risks
        const result = await generateProcessRisks(request);

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('Error in risk evaluation API:', error);

        return NextResponse.json(
            {
                error: error.message || 'Failed to generate risk evaluation',
                details: process.env.NODE_ENV === 'development' ? error : undefined
            },
            { status: 500 }
        );
    }
}

// Export with authentication wrapper
export const POST = withAuthOnly(handler);
