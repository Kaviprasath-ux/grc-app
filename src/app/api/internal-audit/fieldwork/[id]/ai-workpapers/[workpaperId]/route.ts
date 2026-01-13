import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string; workpaperId: string }>;
}

// PATCH /api/internal-audit/fieldwork/[id]/ai-workpapers/[workpaperId] - Update AI workpaper
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, workpaperId } = await context.params;
      const body = await req.json();

      // In production, this would update the database
      // For now, return success response
      return NextResponse.json({
        id: workpaperId,
        ...body,
        message: 'AI workpaper updated successfully',
      });
    } catch (error) {
      console.error('Error updating AI workpaper:', error);
      return NextResponse.json(
        { error: 'Failed to update AI workpaper' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
