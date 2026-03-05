import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";

// GET factory reports for assessor
export const GET = withAuth(
  async () => {
    try {
      // Factory reports are generated on-demand from Assessment Factory
      // Currently returns empty list - reports will be populated when factory assessments are generated
      return NextResponse.json({ data: [], total: 0 });
    } catch (error) {
      console.error("Error fetching factory reports:", error);
      return NextResponse.json({ error: "Failed to fetch factory reports" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-factory-reports", action: "view" }
);
