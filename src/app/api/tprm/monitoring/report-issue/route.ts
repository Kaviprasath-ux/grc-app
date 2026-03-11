import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { translateRecord } from '@/lib/translation-service';

interface Finding {
  findingId: string;
  statement: string;
  kpiName: string;
  severity: string | null;
  score: number | null;
  recommendation: string | null;
}

// POST /api/tprm/monitoring/report-issue — Create remediation issues from monitoring key findings
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { vendorId, findings } = body as { vendorId: string; findings: Finding[] };

      if (!vendorId || !findings?.length) {
        return NextResponse.json({ error: 'Vendor ID and findings are required' }, { status: 400 });
      }

      // Verify vendor belongs to this tenant
      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id: vendorId, customerAccountId },
        select: { id: true, name: true },
      });

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      // Find the latest assessment for this vendor (needed for assessmentId on remediation)
      const latestAssessment = await prisma.tPRMAssessment.findFirst({
        where: { vendorId, customerAccountId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (!latestAssessment) {
        return NextResponse.json({ error: 'No assessment found for this vendor' }, { status: 404 });
      }

      // Get next issue code number
      const lastIssue = await prisma.tPRMIssueRemediation.findFirst({
        where: { customerAccountId, issueCode: { not: null } },
        orderBy: { issueCode: 'desc' },
        select: { issueCode: true },
      });

      let nextNum = 1;
      if (lastIssue?.issueCode) {
        const match = lastIssue.issueCode.match(/ISS-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }

      // Create remediation issues for each selected finding
      const created = [];
      for (const f of findings) {
        const issueCode = `ISS-${String(nextNum).padStart(3, '0')}`;
        nextNum++;

        const remediation = await prisma.tPRMIssueRemediation.create({
          data: {
            issueCode,
            customerAccountId,
            assessmentId: latestAssessment.id,
            domainName: f.kpiName,
            questionText: f.kpiName,
            severity: f.severity || 'Medium',
            issue: f.statement,
            requestedDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: 'Pending',
          },
        });
        created.push(remediation);

        // Trigger dynamic translation for the created remediation
        if (customerAccountId) {
          void translateRecord(customerAccountId, 'TPRMIssueRemediation', remediation.id, {
            issue: f.statement,
            risk: null,
            recommendation: f.recommendation || null,
            description: null,
          });
        }
      }

      return NextResponse.json({ count: created.length, data: created }, { status: 201 });
    } catch (error) {
      console.error('Monitoring report-issue error:', error);
      return NextResponse.json({ error: 'Failed to report issues' }, { status: 500 });
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring", "tprm.asr-monitoring"], action: "create" }
);
