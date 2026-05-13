import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/users/check-existing?userName=foo[&email=foo@bar.com][&moduleCode=GRC]
 *
 * Smart "Add User" pre-check. Returns one of three states:
 *
 *   { exists: false }
 *       — no match anywhere; safe to create.
 *
 *   { exists: true, sameCustomer: true, user, roleModules, alreadyInModule }
 *       — matched within the requester's customer. Cross-module flow can
 *         attach the new role to this existing user (Phase 8/9 UX).
 *
 *   { exists: true, sameCustomer: false }
 *       — matched, but in a DIFFERENT customer. Phase 10 enforces globally
 *         unique userName/email, so this collision blocks the create. We
 *         deliberately do NOT expose the other tenant's data (security:
 *         leaking customer names across tenants would let an attacker probe).
 *
 * Authorization: any authenticated user. GRCAdministrator gets the same
 * response shape as regular admins.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const customerAccountId = session.user.customerAccountId;
    if (!customerAccountId) {
      return NextResponse.json({ error: "No customer context" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userName = searchParams.get("userName")?.trim();
    const email = searchParams.get("email")?.trim();
    const moduleCodeParam = searchParams.get("moduleCode");

    if (!userName && !email) {
      return NextResponse.json(
        { error: "userName or email query parameter is required" },
        { status: 400 },
      );
    }

    const moduleCode =
      moduleCodeParam === "GRC" ||
      moduleCodeParam === "TPRM" ||
      moduleCodeParam === "INTERNAL_AUDIT"
        ? moduleCodeParam
        : null;

    // Match GLOBALLY by userName OR email. Phase 10 enforces global uniqueness;
    // a cross-customer hit must block the create just like a within-customer
    // hit, just with a different UX (no cross-module attach path).
    const orClauses: { userName?: { equals: string; mode: "insensitive" }; email?: { equals: string; mode: "insensitive" } }[] = [];
    if (userName) orClauses.push({ userName: { equals: userName, mode: "insensitive" } });
    if (email) orClauses.push({ email: { equals: email, mode: "insensitive" } });

    const existing = await prisma.user.findFirst({
      where: { OR: orClauses },
      include: {
        department: { select: { id: true, name: true } },
        userRoles: { select: { moduleCode: true, role: { select: { name: true } } } },
      },
    });

    if (!existing) {
      return NextResponse.json({ exists: false });
    }

    // Cross-customer match — block. Do not include user data in the response
    // (would leak which tenant the user belongs to).
    if (existing.customerAccountId !== customerAccountId) {
      return NextResponse.json({
        exists: true,
        sameCustomer: false,
      });
    }

    const roleModules = Array.from(
      new Set(
        existing.userRoles
          .map((r) => r.moduleCode)
          .filter((m): m is "GRC" | "TPRM" | "INTERNAL_AUDIT" =>
            m === "GRC" || m === "TPRM" || m === "INTERNAL_AUDIT",
          ),
      ),
    );
    const alreadyInModule = moduleCode ? roleModules.includes(moduleCode) : false;

    return NextResponse.json({
      exists: true,
      sameCustomer: true,
      user: {
        id: existing.id,
        userId: existing.userId,
        userName: existing.userName,
        email: existing.email,
        firstName: existing.firstName,
        lastName: existing.lastName,
        fullName: existing.fullName,
        designation: existing.designation,
        departmentId: existing.departmentId,
        departmentName: existing.department?.name ?? null,
      },
      roleModules,
      alreadyInModule,
    });
  } catch (error) {
    console.error("Error checking existing user:", error);
    return NextResponse.json({ error: "Failed to check user" }, { status: 500 });
  }
}
