import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
import { startCronRun, finishCronRun } from '@/lib/cron-logger';

/**
 * Cadence-Based Reassessment Cron Job
 *
 * Runs daily. For every Completed TPRM assessment that has not yet triggered a
 * cadence reassessment, checks whether the configured cadence period (based on
 * the vendor's VRR and the customer's TPRMConfiguration) has elapsed since the
 * assessment's completion date. If so, automatically creates a new
 * "Periodic Assessment" for the same vendor, copying the template and assigned
 * roles, and notifies the relevant stakeholders.
 *
 * Only processes active customers with TPRM enabled (isActive + isTprmAdded).
 *
 * Security: Protected by CRON_SECRET environment variable (optional for dev).
 */

// Default cadence values (months) — matches DEFAULTS in control-center/route.ts
const DEFAULT_CADENCE: Record<string, number> = {
  Critical: 1,
  High: 3,
  Moderate: 6,
  Low: 24,
  Nominal: 36,
};

function getCadenceMonths(
  config: Record<string, unknown> | null,
  vrr: string
): number {
  if (!config) return DEFAULT_CADENCE[vrr] ?? 12;
  const key = `cadence${vrr}` as keyof typeof config;
  const val = config[key];
  return typeof val === 'number' && val > 0 ? val : (DEFAULT_CADENCE[vrr] ?? 12);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export async function GET(req: NextRequest) {
  // Verify cron secret if set
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let triggered = 0;
  let skipped = 0;
  const errors: { assessmentId: string; error: string }[] = [];
  const triggeredBy = req.headers.get('x-triggered-by') === 'manual' ? 'manual' : 'schedule';
  const runId = await startCronRun({ taskFunction: 'cadence-reassessment', name: 'Cadence Reassessment', schedule: '0 7 * * *', triggeredBy });

  console.log('[CadenceReassessment] Starting cadence reassessment check...');
  console.log(`[CadenceReassessment] Today: ${today.toISOString()}`);

  try {
    // 1. Get all active customers with TPRM enabled
    const activeCustomers = await prisma.customerAccount.findMany({
      where: { isActive: true, isTprmAdded: true },
      select: { id: true, name: true },
    });

    console.log(`[CadenceReassessment] Processing ${activeCustomers.length} active TPRM customers`);

    for (const customer of activeCustomers) {
      try {
        // 2. Load this customer's cadence configuration
        const config = await prisma.tPRMConfiguration.findUnique({
          where: { customerAccountId: customer.id },
        });

        // 3. Find Completed assessments that haven't triggered a reassessment yet
        const eligibleAssessments = await prisma.tPRMAssessment.findMany({
          where: {
            customerAccountId: customer.id,
            status: 'Completed',
            cadenceReassessmentTriggered: false,
            completionDate: { not: null },
            assessmentType: { not: 'Offboard Assessment' },
          },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                vrr: true,
                accountManagerEmail: true,
                vendorCode: true,
              },
            },
          },
        });

        console.log(
          `[CadenceReassessment] Customer ${customer.name}: ${eligibleAssessments.length} eligible assessments`
        );

        for (const assessment of eligibleAssessments) {
          try {
            const vrr = assessment.vendor?.vrr;
            if (!vrr) {
              // No VRR set — skip
              skipped++;
              continue;
            }

            const cadenceMonths = getCadenceMonths(config as Record<string, unknown> | null, vrr);
            const completionDate = assessment.completionDate!;
            const nextDue = addMonths(completionDate, cadenceMonths);

            if (nextDue > today) {
              // Not yet time
              skipped++;
              continue;
            }

            // 4. Auto-generate assessment code for this customer
            const count = await prisma.tPRMAssessment.count({
              where: { customerAccountId: customer.id },
            });
            const newAssessmentCode = `ASM${String(count + 1).padStart(3, '0')}`;

            // 5. Create new Periodic Assessment
            const newAssessment = await prisma.tPRMAssessment.create({
              data: {
                customerAccountId: customer.id,
                assessmentCode: newAssessmentCode,
                vendorId: assessment.vendorId,
                assessmentType: 'Periodic Assessment',
                status: 'Draft',
                questionnaireTemplate: assessment.questionnaireTemplate,
                assessorId: assessment.assessorId,
                approverId: assessment.approverId,
                initiatedById: assessment.initiatedById,
                // dueDate: based on config dueDateDays if available
                dueDate: config
                  ? (() => {
                      const dueDays =
                        (config as Record<string, unknown>)[`dueDate${vrr}`];
                      if (typeof dueDays === 'number' && dueDays > 0) {
                        const d = new Date(today);
                        d.setDate(d.getDate() + dueDays);
                        return d;
                      }
                      return null;
                    })()
                  : null,
              },
            });

            // 6. Add assessment log
            await prisma.tPRMAssessmentLog.create({
              data: {
                customerAccountId: customer.id,
                assessmentId: newAssessment.id,
                logMessage: `Periodic reassessment auto-created by system based on ${vrr} risk cadence (${cadenceMonths} month${cadenceMonths !== 1 ? 's' : ''}) from assessment ${assessment.assessmentCode} completed on ${completionDate.toISOString().split('T')[0]}.`,
              },
            });

            // 7. Mark original as triggered
            await prisma.tPRMAssessment.update({
              where: { id: assessment.id },
              data: { cadenceReassessmentTriggered: true },
            });

            triggered++;
            console.log(
              `[CadenceReassessment] Created ${newAssessmentCode} for vendor ${assessment.vendor?.name} (VRR: ${vrr}, cadence: ${cadenceMonths}mo, triggered from: ${assessment.assessmentCode})`
            );

            // 8. Notify stakeholders
            try {
              const recipientIds: string[] = [];

              // Account Manager
              const amEmail = assessment.vendor?.accountManagerEmail?.split(';')[0]?.trim();
              if (amEmail) {
                const amUser = await prisma.user.findFirst({
                  where: {
                    customerAccountId: customer.id,
                    email: { equals: amEmail, mode: 'insensitive' },
                    isActive: true,
                  },
                  select: { id: true },
                });
                if (amUser) recipientIds.push(amUser.id);
              }

              // Assessor
              if (newAssessment.assessorId && !recipientIds.includes(newAssessment.assessorId)) {
                recipientIds.push(newAssessment.assessorId);
              }

              // BO users (up to 5)
              const boUsers = await prisma.user.findMany({
                where: {
                  customerAccountId: customer.id,
                  isActive: true,
                  tprmRole: 'Business Owner',
                },
                select: { id: true },
                take: 5,
              });
              for (const u of boUsers) {
                if (!recipientIds.includes(u.id)) recipientIds.push(u.id);
              }

              if (recipientIds.length > 0) {
                await notificationService.notifyTPRMCadenceReassessment({
                  customerAccountId: customer.id,
                  recipientIds,
                  newAssessmentId: newAssessment.id,
                  newAssessmentCode: newAssessment.assessmentCode,
                  vendorName: assessment.vendor?.name ?? '',
                  vrrCategory: vrr,
                  cadenceMonths,
                });
              }
            } catch (notifErr) {
              console.error(
                `[CadenceReassessment] Notification failed for ${newAssessment.assessmentCode}:`,
                notifErr
              );
            }
          } catch (assessmentErr) {
            console.error(
              `[CadenceReassessment] Error processing assessment ${assessment.id}:`,
              assessmentErr
            );
            errors.push({
              assessmentId: assessment.id,
              error: assessmentErr instanceof Error ? assessmentErr.message : 'Unknown error',
            });
          }
        }
      } catch (customerErr) {
        console.error(`[CadenceReassessment] Error processing customer ${customer.id}:`, customerErr);
      }
    }

    console.log(`[CadenceReassessment] Done. triggered=${triggered}, skipped=${skipped}, errors=${errors.length}`);

    await finishCronRun(runId, 'Completed', { triggered, skipped, errorCount: errors.length },
      `Created ${triggered} periodic reassessment(s), skipped ${skipped}, errors ${errors.length}`);

    return NextResponse.json({
      success: true,
      message: 'Cadence reassessment check complete',
      triggered,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CadenceReassessment] Critical error:', error);
    await finishCronRun(runId, 'Failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cadence reassessments',
        message: error instanceof Error ? error.message : 'Unknown error',
        triggered,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 500 }
    );
  }
}
