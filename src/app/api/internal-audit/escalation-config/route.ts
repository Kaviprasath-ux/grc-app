import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET escalation config
// NOTE: AuditEscalationConfig doesn't have customerAccountId or auditHeadId - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      let config = await prisma.auditEscalationConfig.findFirst();

      // Create default config if none exists
      if (!config) {
        config = await prisma.auditEscalationConfig.create({
          data: {
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
  { resource: "audit.settings", action: "view" }
);

// PUT update escalation config
// NOTE: AuditEscalationConfig doesn't have customerAccountId or auditHeadId - tenant filtering disabled
export const PUT = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { responseSubmission, acknowledgement, clarification, issueResolution } = body;

      let config = await prisma.auditEscalationConfig.findFirst();

      if (!config) {
        // Create if doesn't exist
        config = await prisma.auditEscalationConfig.create({
          data: {
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
