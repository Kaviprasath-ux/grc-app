import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single vendor
export const GET = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const vendor = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: { select: { id: true, name: true } },
          assessments: {
            include: {
              initiatedBy: { select: { id: true, fullName: true } },
              assessor: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      return NextResponse.json(vendor);
    } catch (error) {
      console.error("Error fetching TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "view" }
);

// PATCH update vendor
export const PATCH = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const body = await req.json();

      const existing = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      const vendor = await prisma.tPRMVendor.update({
        where: { id },
        data: {
          name: body.name,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          accountManagerName: body.accountManagerName,
          accountManagerEmail: body.accountManagerEmail,
          serviceCategory: body.serviceCategory,
          serviceDescription: body.serviceDescription,
          departmentId: body.departmentId,
          status: body.status,
          vrr: body.vrr,
          engagementId: body.engagementId,
          vendorCertification: body.vendorCertification,
          businessJustification: body.businessJustification,
          accessToNetwork: body.accessToNetwork,
          cloud: body.cloud,
          accessToData: body.accessToData,
          pii: body.pii,
          contractStartDate: body.contractStartDate ? new Date(body.contractStartDate) : undefined,
          contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : undefined,
          onboardedDate: body.onboardedDate ? new Date(body.onboardedDate) : undefined,
          offboardedDate: body.offboardedDate ? new Date(body.offboardedDate) : undefined,
        },
        include: {
          department: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(vendor);
    } catch (error) {
      console.error("Error updating TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to update vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "edit" }
);

// DELETE vendor
export const DELETE = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const existing = await prisma.tPRMVendor.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      await prisma.tPRMVendor.delete({ where: { id } });

      return NextResponse.json({ message: "Vendor deleted" });
    } catch (error) {
      console.error("Error deleting TPRM vendor:", error);
      return NextResponse.json(
        { error: "Failed to delete vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.assessments", "tprm.bo-inventory", "tprm.rm-inventory"], action: "delete" }
);
