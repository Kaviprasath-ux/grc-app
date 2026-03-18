import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getAuditHeadId, resolveAuditHeadIdForCreate } from '@/lib/api-auth';

// GET /api/internal-audit/processes - Get all internal audit processes for the audit head
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
        orderBy: { name: 'asc' },
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
  { resource: 'audit.settings', action: 'view' }
);

// POST /api/internal-audit/processes - Create a new internal audit process
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { name, description } = body;

      if (!name) {
        return NextResponse.json(
          { error: 'Process name is required' },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);

      // Check if process with same name exists for this audit head
      const existing = await prisma.internalAuditProcess.findFirst({
        where: {
          name,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A process with this name already exists' },
          { status: 400 }
        );
      }

      const process = await prisma.internalAuditProcess.create({
        data: {
          name,
          description: description || null,
          customerAccountId: customerAccountId || null,
          auditHeadId: auditHeadId || null,
        },
      });

      return NextResponse.json(process, { status: 201 });
    } catch (error) {
      console.error('Error creating internal audit process:', error);
      return NextResponse.json(
        { error: 'Failed to create process' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.settings', action: 'create' }
);
