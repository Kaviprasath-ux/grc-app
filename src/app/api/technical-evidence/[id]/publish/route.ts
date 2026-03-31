import { NextResponse } from "next/server";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { publishTechnicalEvidence } from "@/lib/technical-evidence/publish-evidence";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - Publish collected technical evidence as a compliance Evidence record
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      const result = await publishTechnicalEvidence(id, {
        id: session.id,
        customerAccountId,
      });

      return NextResponse.json({
        data: result,
        message: result.created
          ? `Evidence ${result.evidenceCode} created successfully`
          : `Evidence ${result.evidenceCode} updated with latest data`,
      });
    } catch (error) {
      console.error("Error publishing evidence:", error);
      const message =
        error instanceof Error ? error.message : "Failed to publish evidence";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { resource: "compliance.technical-evidence", action: "create" }
);
