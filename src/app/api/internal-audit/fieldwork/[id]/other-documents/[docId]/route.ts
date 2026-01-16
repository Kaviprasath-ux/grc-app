import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string; docId: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/other-documents/[docId] - Get a specific document
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, docId } = await context.params;

      const attachment = await prisma.fieldworkEvidenceAttachment.findUnique({
        where: { id: docId },
        include: {
          evidenceRequest: {
            select: {
              engagementId: true,
              title: true,
              documentType: true,
              description: true,
              category: true,
            },
          },
        },
      });

      if (!attachment || attachment.evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: attachment.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        filePath: attachment.filePath,
        uploadedAt: attachment.uploadedAt.toISOString(),
        title: attachment.evidenceRequest.title,
        documentType: attachment.evidenceRequest.documentType,
        description: attachment.evidenceRequest.description,
        category: attachment.evidenceRequest.category,
      });
    } catch (error) {
      console.error('Error fetching document:', error);
      return NextResponse.json(
        { error: 'Failed to fetch document' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// DELETE /api/internal-audit/fieldwork/[id]/other-documents/[docId] - Delete a document
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, docId } = await context.params;

      // Find the attachment with its evidence request
      const attachment = await prisma.fieldworkEvidenceAttachment.findUnique({
        where: { id: docId },
        include: {
          evidenceRequest: {
            select: {
              id: true,
              engagementId: true,
              category: true,
            },
          },
        },
      });

      if (!attachment || attachment.evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Only allow deleting 'other' category documents from this endpoint
      if (attachment.evidenceRequest.category !== 'other') {
        return NextResponse.json(
          { error: 'Cannot delete this document type from this endpoint' },
          { status: 400 }
        );
      }

      // Try to delete the physical file
      try {
        const filePath = path.join(process.cwd(), attachment.filePath);
        await unlink(filePath);
      } catch (fileError) {
        // Log but continue - file might already be deleted
        console.warn('Could not delete physical file:', fileError);
      }

      // Delete the attachment record
      await prisma.fieldworkEvidenceAttachment.delete({
        where: { id: docId },
      });

      // Check if the evidence request has any other attachments
      const remainingAttachments = await prisma.fieldworkEvidenceAttachment.count({
        where: { evidenceRequestId: attachment.evidenceRequest.id },
      });

      // If no more attachments, delete the evidence request as well
      if (remainingAttachments === 0) {
        await prisma.fieldworkEvidenceRequest.delete({
          where: { id: attachment.evidenceRequest.id },
        });
      }

      return NextResponse.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

// PATCH /api/internal-audit/fieldwork/[id]/other-documents/[docId] - Update a document
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, docId } = await context.params;
      const body = await req.json();

      // Find the attachment with its evidence request
      const attachment = await prisma.fieldworkEvidenceAttachment.findUnique({
        where: { id: docId },
        include: {
          evidenceRequest: {
            select: {
              id: true,
              engagementId: true,
              category: true,
            },
          },
        },
      });

      if (!attachment || attachment.evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Only allow updating 'other' category documents from this endpoint
      if (attachment.evidenceRequest.category !== 'other') {
        return NextResponse.json(
          { error: 'Cannot update this document type from this endpoint' },
          { status: 400 }
        );
      }

      // Update the evidence request with the new metadata
      const updatedRequest = await prisma.fieldworkEvidenceRequest.update({
        where: { id: attachment.evidenceRequest.id },
        data: {
          title: body.title !== undefined ? body.title : undefined,
          documentType: body.documentType !== undefined ? body.documentType : undefined,
          description: body.description !== undefined ? body.description : undefined,
        },
      });

      return NextResponse.json({
        id: attachment.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        filePath: attachment.filePath,
        uploadedAt: attachment.uploadedAt.toISOString(),
        title: updatedRequest.title,
        documentType: updatedRequest.documentType,
        description: updatedRequest.description,
        category: updatedRequest.category,
      });
    } catch (error) {
      console.error('Error updating document:', error);
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
