import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@/lib/notification-service";

export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { name, phone, company, message } = body;

      if (!message?.trim()) {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
      }

      const customerAccountId = getCustomerAccountId(session);

      // Find superadmin users for this customer account
      const superadmins = await prisma.user.findMany({
        where: {
          customerAccountId,
          role: { in: ["GRCAdministrator", "CustomerAdministrator"] },
          isActive: true,
        },
        select: { id: true },
        take: 5,
      });

      // Send notification to each superadmin
      for (const admin of superadmins) {
        if (admin.id === session.id) continue; // Skip self
        await notificationService.send({
          customerAccountId,
          actorId: session.id,
          recipientId: admin.id,
          event: NOTIFICATION_EVENTS.SYSTEM_ANNOUNCEMENT,
          title: "TPRM Support Request",
          message: `Support request from ${name || session.name}${company ? ` (${company})` : ""}${phone ? ` - Phone: ${phone}` : ""}:\n\n${message}`,
          relatedEntityType: "support-request",
          link: "/tprm/bo-support",
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error sending support request:", error);
      return NextResponse.json({ error: "Failed to send support request" }, { status: 500 });
    }
  },
  { resource: ["tprm.bo-support", "tprm.rm-support", "tprm.am-support"], action: "view" }
);
