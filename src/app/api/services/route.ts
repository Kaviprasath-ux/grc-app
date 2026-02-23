import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all services - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const services = await prisma.service.findMany({
        where: tenantFilter,
        orderBy: { title: "asc" },
      });
      return NextResponse.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "view" }
);

// POST create new service - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { title, description, serviceUser, serviceCategory, serviceItem } = body;

      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      const service = await prisma.service.create({
        data: {
          customerAccountId,
          title,
          description,
          serviceUser,
          serviceCategory,
          serviceItem,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'Service', service.id, { title: service.title, description: service.description });

      return NextResponse.json(service, { status: 201 });
    } catch (error) {
      console.error("Error creating service:", error);
      return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
    }
  },
  { resource: "organization.context", action: "create" }
);
