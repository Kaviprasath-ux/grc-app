import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET escalation config - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      let config = await prisma.auditEscalationConfig.findFirst({
        where: { ...tenantFilter, ...auditHeadFilter },
      });

      // Create default config if none exists for this audit head
      if (!config) {
        const customerAccountId = getCustomerAccountId(session);
        const auditHeadId = getAuditHeadId(session);
        config = await prisma.auditEscalationConfig.create({
          data: {
            customerAccountId,
            auditHeadId,
            responseSubmission: 5,
            acknowledgement: 1,
            clarification: 2,
            issueResolution: 3,
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error fetching escalation config:", error);
      return NextResponse.json(
        { error: "Failed to fetch escalation config" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// PUT update escalation config - for current audit head
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { responseSubmission, acknowledgement, clarification, issueResolution } = body;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      let config = await prisma.auditEscalationConfig.findFirst({
        where: { ...tenantFilter, ...auditHeadFilter },
      });

      if (!config) {
        // Create if doesn't exist for this audit head
        const customerAccountId = getCustomerAccountId(session);
        const auditHeadId = getAuditHeadId(session);
        config = await prisma.auditEscalationConfig.create({
          data: {
            customerAccountId,
            auditHeadId,
            responseSubmission: responseSubmission ?? 5,
            acknowledgement: acknowledgement ?? 1,
            clarification: clarification ?? 2,
            issueResolution: issueResolution ?? 3,
          },
        });
      } else {
        // Update existing
        config = await prisma.auditEscalationConfig.update({
          where: { id: config.id },
          data: {
            ...(responseSubmission !== undefined && { responseSubmission }),
            ...(acknowledgement !== undefined && { acknowledgement }),
            ...(clarification !== undefined && { clarification }),
            ...(issueResolution !== undefined && { issueResolution }),
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error updating escalation config:", error);
      return NextResponse.json(
        { error: "Failed to update escalation config" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);
