import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update service - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { title, description, serviceUser, serviceCategory, serviceItem } = body;

      // First, verify the service belongs to the user's customer account
      const existing = await prisma.service.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this service");
      }

      const service = await prisma.service.update({
        where: { id },
        data: {
          title,
          description,
          serviceUser,
          serviceCategory,
          serviceItem,
        },
      });

      return NextResponse.json(service);
    } catch (error: unknown) {
      console.error("Error updating service:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "edit" }
);

// DELETE service - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the service belongs to the user's customer account
      const existing = await prisma.service.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this service");
      }

      await prisma.service.delete({ where: { id } });
      return NextResponse.json({ message: "Service deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting service:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "delete" }
);
