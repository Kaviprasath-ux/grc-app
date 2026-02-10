import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

// GET email notifications setting for the customer account
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 404 }
        );
      }

      const customerAccount = await prisma.customerAccount.findUnique({
        where: { id: customerAccountId },
        select: { emailNotificationsEnabled: true },
      });

      if (!customerAccount) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        emailNotificationsEnabled: customerAccount.emailNotificationsEnabled,
      });
    } catch (error) {
      console.error("Error fetching email notifications setting:", error);
      return NextResponse.json(
        { error: "Failed to fetch email notifications setting" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "view" }
);

// PUT update email notifications setting for the customer account
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { emailNotificationsEnabled } = body;

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 404 }
        );
      }

      if (typeof emailNotificationsEnabled !== "boolean") {
        return NextResponse.json(
          { error: "emailNotificationsEnabled must be a boolean" },
          { status: 400 }
        );
      }

      const updatedAccount = await prisma.customerAccount.update({
        where: { id: customerAccountId },
        data: { emailNotificationsEnabled },
        select: { emailNotificationsEnabled: true },
      });

      return NextResponse.json({
        emailNotificationsEnabled: updatedAccount.emailNotificationsEnabled,
      });
    } catch (error) {
      console.error("Error updating email notifications setting:", error);
      return NextResponse.json(
        { error: "Failed to update email notifications setting" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "edit" }
);
