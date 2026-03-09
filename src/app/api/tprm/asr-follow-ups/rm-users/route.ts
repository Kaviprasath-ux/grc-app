import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

// GET /api/tprm/asr-follow-ups/rm-users — List RM or IT users in assessor's tenant
// Pass ?role=it to get Internal IT Team users instead of Relationship Managers
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const roleParam = searchParams.get("role");

      const tprmRole = roleParam === "it" ? "Internal IT Team" : "Relationship Manager";

      const rmUsers = await prisma.user.findMany({
        where: {
          customerAccountId,
          tprmRole,
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
