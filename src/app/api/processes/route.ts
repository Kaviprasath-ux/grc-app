import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@/lib/notification-service";
import { translateRecord } from '@/lib/translation-service';

// GET all processes - filtered by tenant
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    // Build tenant filter (strict isolation)
    const tenantFilter = !isGRCAdmin && customerAccountId
      ? { customerAccountId }
      : {};

    const processes = await prisma.process.findMany({
      where: tenantFilter,
      include: {
        department: true,
        owner: true,
      },
      orderBy: { processCode: "asc" },
    });
    return NextResponse.json(processes);
  } catch (error) {
    console.error("Error fetching processes:", error);
    return NextResponse.json(
      { error: "Failed to fetch processes" },
      { status: 500 }
    );
  }
}

// POST create new process - with tenant assignment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const {
      processCode,
      name,
      description,
      processType,
      departmentId,
      ownerId,
      status,
      processFrequency,
      natureOfImplementation,
      riskRating,
      assetDependency,
      externalDependency,
      location,
      kpiMeasurementRequired,
      piiCapture,
      operationalComplexity,
      lastAuditDate,
      responsibleId,
      accountableId,
      consultedId,
      informedId,
    } = body;

    if (!customerAccountId) {
      return NextResponse.json(
        { error: "User must belong to a customer account" },
        { status: 403 }
      );
    }

    // Generate process code if not provided (tenant-scoped)
    let finalProcessCode = processCode;
    if (!finalProcessCode) {
      const allProcesses = await prisma.process.findMany({
        where: { customerAccountId },
        select: { processCode: true },
      });
      const maxNum = allProcesses.reduce((max, p) => {
        const num = parseInt(p.processCode.replace("PRO", "")) || 0;
        return num > max ? num : max;
      }, 0);
      finalProcessCode = `PRO${maxNum + 1}`;
    }

    // Check if process code already exists within the same tenant
    const existingProcess = await prisma.process.findFirst({
      where: {
        processCode: finalProcessCode,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existingProcess) {
      console.log(`Process code ${finalProcessCode} already exists`);
      return NextResponse.json(
        { error: `Process code ${finalProcessCode} already exists` },
        { status: 400 }
      );
    }

    const processData = {
        processCode: finalProcessCode,
        name,
        description,
        processType: processType || "Primary",
        departmentId: departmentId || null,
        ownerId: ownerId || null,
        status: status || "Active",
        processFrequency,
        natureOfImplementation,
        riskRating,
        assetDependency: assetDependency || false,
        externalDependency: externalDependency || false,
        location,
        kpiMeasurementRequired: kpiMeasurementRequired || false,
        piiCapture: piiCapture || false,
        operationalComplexity,
        lastAuditDate: lastAuditDate ? new Date(lastAuditDate) : null,
        responsibleId: responsibleId || null,
        accountableId: accountableId || null,
        consultedId: consultedId || null,
        informedId: informedId || null,
      };

    if (customerAccountId) {
      (processData as Record<string, unknown>).customerAccountId = customerAccountId;
    }

    const process = await prisma.process.create({
      data: processData as Parameters<typeof prisma.process.create>[0]['data'],
      include: {
        department: true,
        owner: true,
      },
    });

    if (customerAccountId) void translateRecord(customerAccountId, 'Process', process.id, { name: process.name, description: process.description });

    // Helper to send process assignment notification
    const notifyProcessAssignment = async (userId: string, role: string) => {
      if (userId && userId !== session?.user?.id && customerAccountId) {
        await notificationService.send({
          customerAccountId: customerAccountId,
          actorId: session?.user?.id || '',
          recipientId: userId,
          event: NOTIFICATION_EVENTS.PROCESS_ASSIGNED,
          title: `Process ${role} Assignment`,
          message: `You have been assigned as ${role} for process "${process.processCode}: ${process.name}"`,
          relatedEntityType: 'process',
          relatedEntityId: process.id,
          link: `/organization/process/${process.id}`,
          metadata: {
            processCode: process.processCode,
            processName: process.name,
            role: role,
            assignedBy: session?.user?.name || 'User',
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }
    };

    // Send PROCESS_CREATED notification to owner (if different from creator)
    if (ownerId && ownerId !== session?.user?.id && customerAccountId) {
      await notificationService.send({
        customerAccountId: customerAccountId,
        actorId: session?.user?.id || '',
        recipientId: ownerId,
        event: NOTIFICATION_EVENTS.PROCESS_CREATED,
        title: 'New Process Created',
        message: `A new process "${process.processCode}: ${process.name}" has been created and assigned to you.`,
        relatedEntityType: 'process',
        relatedEntityId: process.id,
        link: `/organization/process/${process.id}`,
        metadata: {
          processCode: process.processCode,
          processName: process.name,
          createdBy: session?.user?.name || 'User',
        },
        channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
      });
    }

    // Notify all assigned users (RACI)
    if (ownerId) await notifyProcessAssignment(ownerId, 'Owner');
    if (responsibleId) await notifyProcessAssignment(responsibleId, 'Responsible');
    if (accountableId) await notifyProcessAssignment(accountableId, 'Accountable');
    if (consultedId) await notifyProcessAssignment(consultedId, 'Consulted');
    if (informedId) await notifyProcessAssignment(informedId, 'Informed');

    return NextResponse.json(process, { status: 201 });
  } catch (error: any) {
    console.error("Error creating process:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create process" },
      { status: 500 }
    );
  }
}
