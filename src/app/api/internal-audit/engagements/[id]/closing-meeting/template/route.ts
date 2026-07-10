import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { buildClosingMeetingTemplate } from "@/lib/closing-meeting-template";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Download the Closing Meeting Excel template (header pre-filled from the engagement).
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { auditId: true, engagementTitle: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const bytes = buildClosingMeetingTemplate({
        auditTaskNumber: engagement.auditId || "",
        assignmentTitle: engagement.engagementTitle || "",
      });

      const safeName = `Closing-Meeting-Template-${engagement.auditId || id}.xlsx`;
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${safeName}"`,
        },
      });
    } catch (error) {
      console.error("Error generating closing meeting template:", error);
      return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);
