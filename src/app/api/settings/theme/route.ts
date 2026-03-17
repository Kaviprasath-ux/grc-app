import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// GET /api/settings/theme — get current customer's theme
export const GET = withAuthOnly(async (req: NextRequest, context, session) => {
  const customerAccountId = session.customerAccountId;
  if (!customerAccountId) {
    return NextResponse.json({ theme: "terracotta" });
  }

  const account = await prisma.customerAccount.findUnique({
    where: { id: customerAccountId },
    select: { theme: true },
  });

  return NextResponse.json({ theme: account?.theme || "terracotta" });
});

// POST /api/settings/theme — set theme (Customer Administrator only)
export const POST = withAuthOnly(async (req: NextRequest, context, session) => {
  const roles = (session.roles as string[]) || [];
  if (!roles.includes("CustomerAdministrator")) {
    return NextResponse.json({ error: "Only Customer Administrator can change the theme" }, { status: 403 });
  }

  const customerAccountId = session.customerAccountId;
  if (!customerAccountId) {
    return NextResponse.json({ error: "No customer account" }, { status: 400 });
  }

  const { theme } = await req.json();
  const validThemes = ["terracotta", "ocean", "forest", "royal", "slate", "crimson", "teal", "amber", "indigo", "rose", "orange", "emerald", "coffee", "sky"];
  if (!validThemes.includes(theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  await prisma.customerAccount.update({
    where: { id: customerAccountId },
    data: { theme },
  });

  return NextResponse.json({ theme });
});
