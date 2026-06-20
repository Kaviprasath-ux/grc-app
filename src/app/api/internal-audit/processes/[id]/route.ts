import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuth,
  getCustomerAccountId,
  getAuditHeadId,
} from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single IA process
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const process = await prisma.internalAuditProcess.findFirst({
        where: {
          id,
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        include: {
          department: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              fileSize: true,
              uploadedAt: true,
            },
          },
          linkedRisks: {
            include: {
              risk: { select: { id: true, riskId: true, riskName: true } },
            },
          },
        },
      });

      if (!process) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }

      return NextResponse.json(process);
    } catch (error) {
      console.error('Error fetching internal audit process:', error);
      return NextResponse.json({ error: 'Failed to fetch process' }, { status: 500 });
    }
  },
  { resource: 'audit.process', action: 'view' }
);

// PATCH update IA process
export const PATCH = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.internalAuditProcess.findFirst({
        where: {
          id,
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }

      const body = await req.json();
      const {
        name,
        description,
        processOwner,
        departmentId,
        riskIds,
        categoryId,
      }: {
        name?: string;
        description?: string | null;
        processOwner?: string | null;
        departmentId?: string | null;
        riskIds?: string[];
        categoryId?: string | null;
      } = body;

      if (name !== undefined && (!name || !name.trim())) {
        return NextResponse.json(
          { error: 'Process name cannot be empty' },
          { status: 400 }
        );
      }

      if (name && name.trim() !== existing.name) {
        const dup = await prisma.internalAuditProcess.findFirst({
          where: {
            name: name.trim(),
            id: { not: id },
            ...(customerAccountId ? { customerAccountId } : {}),
            ...(auditHeadId ? { auditHeadId } : {}),
          },
        });
        if (dup) {
          return NextResponse.json(
            { error: 'A process with this name already exists' },
            { status: 400 }
          );
        }
      }

      // Handle linkedRisks replacement when riskIds is supplied
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name.trim();
      if (description !== undefined)
        data.description = description?.toString().trim() || null;
      if (processOwner !== undefined)
        data.processOwner = processOwner?.toString().trim() || null;
      if (departmentId !== undefined) data.departmentId = departmentId || null;
      if (categoryId !== undefined) data.categoryId = categoryId || null;

      const updated = await prisma.$transaction(async (tx) => {
        if (Array.isArray(riskIds)) {
          const cleanRiskIds = Array.from(
            new Set(riskIds.filter((rid): rid is string => typeof rid === 'string' && rid.length > 0))
          );
          await tx.internalAuditProcessRisk.deleteMany({ where: { processId: id } });
          if (cleanRiskIds.length) {
            await tx.internalAuditProcessRisk.createMany({
              data: cleanRiskIds.map((riskId) => ({ processId: id, riskId })),
              skipDuplicates: true,
            });
          }
        }

        return tx.internalAuditProcess.update({
          where: { id },
          data,
          include: {
            department: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            attachments: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                fileSize: true,
                uploadedAt: true,
              },
            },
            linkedRisks: {
              include: {
                risk: { select: { id: true, riskId: true, riskName: true } },
              },
            },
          },
        });
      });

      if (customerAccountId) {
        void translateRecord(customerAccountId, 'InternalAuditProcess', updated.id, {
          name: updated.name,
          description: updated.description || '',
        });
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('Error updating internal audit process:', error);
      return NextResponse.json({ error: 'Failed to update process' }, { status: 500 });
    }
  },
  { resource: 'audit.process', action: 'edit' }
);

// DELETE IA process (and cascade attachments + risk links)
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const existing = await prisma.internalAuditProcess.findFirst({
        where: {
          id,
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }

      await prisma.internalAuditProcess.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting internal audit process:', error);
      return NextResponse.json({ error: 'Failed to delete process' }, { status: 500 });
    }
  },
  { resource: 'audit.process', action: 'delete' }
);
