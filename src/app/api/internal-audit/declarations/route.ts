import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuth,
  getTenantFilter,
  getAuditHeadFilter,
  getCustomerAccountId,
  getAuditHeadId,
} from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';

const TYPES = ['Independence', 'Objectivity'];

// Auto-generate declaration code (DEC-NNNN), tenant-scoped.
async function generateDeclarationCode(customerAccountId: string): Promise<string> {
  const rows = await prisma.auditDeclaration.findMany({
    where: { customerAccountId },
    select: { declarationCode: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.declarationCode?.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DEC-${(max + 1).toString().padStart(4, '0')}`;
}

// GET /api/internal-audit/declarations - list declarations (tenant + audit-head scoped)
export const GET = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);
      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type');

      const where: Record<string, unknown> = { ...tenantFilter, ...auditHeadFilter };
      if (type && TYPES.includes(type)) where.type = type;

      const declarations = await prisma.auditDeclaration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(declarations);
    } catch (error) {
      console.error('Error fetching declarations:', error);
      return NextResponse.json({ error: 'Failed to fetch declarations' }, { status: 500 });
    }
  },
  { resource: 'audit.independence', action: 'view' },
);

// POST /api/internal-audit/declarations - create a declaration
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const body = await req.json();
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const type = TYPES.includes(body.type) ? body.type : 'Independence';
      const declarationCode = await generateDeclarationCode(customerAccountId);

      const declaration = await prisma.auditDeclaration.create({
        data: {
          customerAccountId,
          auditHeadId,
          declarationCode,
          type,
          declarantId: body.declarantId || session.id || null,
          declarantName: body.declarantName || null,
          position: body.position || null,
          department: body.department || null,
          engagement: body.engagement || null,
          declarationDate: body.declarationDate ? new Date(body.declarationDate) : new Date(),
          result: body.result || null,
          explanation: body.explanation || null,
          employeeSignature: body.employeeSignature || null,
          status: body.status === 'Submitted' ? 'Submitted' : 'Draft',
        },
      });
      void translateRecord(customerAccountId, 'AuditDeclaration', declaration.id, {
        declarantName: declaration.declarantName || '',
        position: declaration.position || '',
        engagement: declaration.engagement || '',
      });
      return NextResponse.json(declaration, { status: 201 });
    } catch (error) {
      console.error('Error creating declaration:', error);
      return NextResponse.json({ error: 'Failed to create declaration' }, { status: 500 });
    }
  },
  { resource: 'audit.independence', action: 'create' },
);
