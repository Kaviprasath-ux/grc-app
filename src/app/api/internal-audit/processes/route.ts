import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuth,
  getCustomerAccountId,
  getAuditHeadId,
  resolveAuditHeadIdForCreate,
} from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';

// GET /api/internal-audit/processes - list IA processes (tenant + audit-head scoped)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const processes = await prisma.internalAuditProcess.findMany({
        where: {
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        include: {
          department: { select: { id: true, name: true } },
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
              risk: {
                select: { id: true, riskId: true, riskName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(processes);
    } catch (error) {
      console.error('Error fetching internal audit processes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch processes' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.process', action: 'view' }
);

// POST /api/internal-audit/processes - create a new IA process
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        name,
        description,
        departmentId,
        riskIds,
      }: {
        name?: string;
        description?: string | null;
        departmentId?: string | null;
        riskIds?: string[];
      } = body;

      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: 'Process name is required' },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);

      const existing = await prisma.internalAuditProcess.findFirst({
        where: {
          name: name.trim(),
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A process with this name already exists' },
          { status: 400 }
        );
      }

      // Auto-generate processCode (IAP001, IAP002, ...)
      const last = await prisma.internalAuditProcess.findFirst({
        where: {
          ...(customerAccountId ? { customerAccountId } : {}),
          processCode: { not: null },
        },
        orderBy: { processCode: 'desc' },
        select: { processCode: true },
      });
      let nextNum = 1;
      if (last?.processCode) {
        const m = last.processCode.match(/IAP(\d+)/);
        if (m) nextNum = parseInt(m[1], 10) + 1;
      }
      const processCode = `IAP${String(nextNum).padStart(3, '0')}`;

      const cleanRiskIds = Array.isArray(riskIds)
        ? Array.from(new Set(riskIds.filter((id): id is string => typeof id === 'string' && id.length > 0)))
        : [];

      const created = await prisma.internalAuditProcess.create({
        data: {
          processCode,
          name: name.trim(),
          description: description?.toString().trim() || null,
          departmentId: departmentId || null,
          customerAccountId: customerAccountId || null,
          auditHeadId: auditHeadId || null,
          linkedRisks: cleanRiskIds.length
            ? {
                create: cleanRiskIds.map((riskId) => ({ riskId })),
              }
            : undefined,
        },
        include: {
          department: { select: { id: true, name: true } },
          attachments: true,
          linkedRisks: { include: { risk: { select: { id: true, riskId: true, riskName: true } } } },
        },
      });

      if (customerAccountId) {
        void translateRecord(customerAccountId, 'InternalAuditProcess', created.id, {
          name: created.name,
          description: created.description || '',
        });
      }

      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      console.error('Error creating internal audit process:', error);
      return NextResponse.json(
        { error: 'Failed to create process' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.process', action: 'create' }
);
