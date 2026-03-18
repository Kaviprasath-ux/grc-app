import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

// POST — Validate vendor name and AM email for cross-tenant usage
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { vendorName, amEmails } = (await req.json()) as {
        vendorName?: string;
        amEmails?: string[];
      };

      const result: {
        vendorName?: { existsElsewhere: boolean; customerCount: number; customerNames: string[] };
        amEmails?: Record<string, { existsElsewhere: boolean; vendorCount: number; customerCount: number; details: string[] }>;
      } = {};

      // Check vendor name across other customers
      if (vendorName?.trim()) {
        const otherVendors = await prisma.tPRMVendor.findMany({
          where: {
            name: { equals: vendorName.trim(), mode: "insensitive" },
            customerAccountId: { not: customerAccountId },
          },
          select: {
            customerAccount: { select: { name: true } },
          },
        });

        const uniqueCustomers = [...new Set(otherVendors.map((v) => v.customerAccount.name))];
        result.vendorName = {
          existsElsewhere: uniqueCustomers.length > 0,
          customerCount: uniqueCustomers.length,
          customerNames: uniqueCustomers,
        };
      }

      // Check AM emails across other customers and vendors
      if (amEmails && amEmails.length > 0) {
        result.amEmails = {};

        for (const email of amEmails) {
          if (!email?.trim()) continue;
          const trimmedEmail = email.trim().toLowerCase();

          // Check if this email is used as AM in other vendors (same or different customer)
          const otherVendorsWithAM = await prisma.tPRMVendor.findMany({
            where: {
              accountManagerEmail: { contains: trimmedEmail, mode: "insensitive" },
              customerAccountId: { not: customerAccountId },
            },
            select: {
              name: true,
              customerAccount: { select: { name: true } },
            },
          });

          // Check same customer, different vendors
          const sameCustomerVendors = await prisma.tPRMVendor.findMany({
            where: {
              accountManagerEmail: { contains: trimmedEmail, mode: "insensitive" },
              customerAccountId,
            },
            select: { name: true },
          });

          const details: string[] = [];
          if (sameCustomerVendors.length > 0) {
            details.push(`Used as AM for ${sameCustomerVendors.length} vendor(s) in your account: ${sameCustomerVendors.map((v) => v.name).join(", ")}`);
          }

          const uniqueOtherCustomers = [...new Set(otherVendorsWithAM.map((v) => v.customerAccount.name))];
          if (uniqueOtherCustomers.length > 0) {
            details.push(`Used as AM in ${uniqueOtherCustomers.length} other customer account(s)`);
          }

          result.amEmails[email] = {
            existsElsewhere: otherVendorsWithAM.length > 0 || sameCustomerVendors.length > 0,
            vendorCount: otherVendorsWithAM.length + sameCustomerVendors.length,
            customerCount: uniqueOtherCustomers.length,
            details,
          };
        }
      }

      return NextResponse.json(result);
    } catch (error) {
      console.error("Error validating vendor:", error);
      return NextResponse.json({ error: "Validation failed" }, { status: 500 });
    }
  },
  { resource: ["tprm.bo-inventory", "tprm.rm-inventory"], action: "create" }
);
