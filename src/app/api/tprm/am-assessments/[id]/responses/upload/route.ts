import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/am-assessments/[id]/responses/upload — Upload artifact file
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const questionId = formData.get('questionId') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'File is required' }, { status: 400 });
      }

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', 'tprm', 'assessments', assessmentId);
      await mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${timestamp}_${safeName}`;
      const filePath = path.join(uploadDir, fileName);

      // Write file
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const artifactUrl = `/uploads/tprm/assessments/${assessmentId}/${fileName}`;

      // If questionId provided, update the response record
      if (questionId) {
        await prisma.tPRMAssessmentResponse.upsert({
          where: {
            assessmentId_questionId: { assessmentId, questionId },
          },
          create: {
            customerAccountId,
            assessmentId,
            questionId,
            artifactUrl,
            artifactName: file.name,
            respondedById: session.id,
          },
          update: {
            artifactUrl,
            artifactName: file.name,
          },
        });
      }

      return NextResponse.json({
        url: artifactUrl,
        name: file.name,
        size: file.size,
      }, { status: 201 });
    } catch (error) {
      console.error('AM Upload error:', error);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);
