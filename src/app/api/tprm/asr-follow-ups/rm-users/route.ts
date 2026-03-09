import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

// GET /api/tprm/asr-follow-ups/rm-users — List RM users in assessor's tenant
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const rmUsers = await prisma.user.findMany({
        where: {
          customerAccountId,
          tprmRole: "Relationship Manager",
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
        orderBy: { fullName: "asc" },
      });

      return NextResponse.json({ data: rmUsers });
    } catch (error) {
      console.error("RM users fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch RM users" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-follow-ups", action: "view" }
);
