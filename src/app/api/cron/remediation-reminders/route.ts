import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';
import { startCronRun, finishCronRun } from '@/lib/cron-logger';

/**
 * Remediation Due-Date Reminder Cron Job
 *
 * Runs daily. For each open TPRM issue remediation, checks whether today falls
 * exactly `reminderDays` before the `dueDate` (based on the remediation severity
 * and the customer's TPRMConfiguration). If so, sends a reminder to all involved
 * stakeholders: Account Manager, Assessor, Approver, assigned RM, and BO users.
 *
 * Severity → config key mapping:
 *   Critical → reminderCritical / remediationCritical
 *   High     → reminderHigh    / remediationHigh
 *   Medium   → reminderModerate / remediationModerate
 *   Low      → reminderLow     / remediationLow
 *
 * Security: Protected by CRON_SECRET environment variable (optional for dev).
 */

// Default reminder days — matches DEFAULTS in control-center/route.ts
const DEFAULT_REMINDER: Record<string, number> = {
  Critical: 5,
  High: 5,
  Medium: 5,
  Low: 5,
};

function getReminderDays(config: Record<string, unknown> | null, severity: string): number {
  if (!config) return DEFAULT_REMINDER[severity] ?? 5;
  if (severity === 'Critical') return (config.reminderCritical as number) || 5;
  if (severity === 'High') return (config.reminderHigh as number) || 5;
  if (severity === 'Medium') return (config.reminderModerate as number) || 5;
  if (severity === 'Low') return (config.reminderLow as number) || 5;
  return (config.reminderModerate as number) || 5;
}

export async function GET(req: NextRequest) {
  // Verify cron secret if set
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let reminded = 0;
  let skipped = 0;
  const errors: { remediationId: string; error: string }[] = [];
  const triggeredBy = req.headers.get('x-triggered-by') === 'manual' ? 'manual' : 'schedule';
  const runId = await startCronRun({ taskFunction: 'remediation-reminders', name: 'Remediation Due Reminders', schedule: '0 8 * * *', triggeredBy });

  console.log('[RemediationReminders] Starting remediation reminder check...');
  console.log(`[RemediationReminders] Today: ${today.toISOString()}`);

  try {
    // 1. Get all active customers with TPRM enabled
    const activeCustomers = await prisma.customerAccount.findMany({
      where: { isActive: true, isTprmAdded: true },
      select: { id: true, name: true },
    });

    console.log(`[RemediationReminders] Processing ${activeCustomers.length} active TPRM customers`);

    for (const customer of activeCustomers) {
      try {
        // 2. Load this customer's reminder configuration
        const config = await prisma.tPRMConfiguration.findUnique({
          where: { customerAccountId: customer.id },
        });

        // 3. Load all open remediations with a dueDate set
        const openRemediations = await prisma.tPRMIssueRemediation.findMany({
          where: {
            customerAccountId: customer.id,
            status: { notIn: ['Closed', 'Terminated', 'IT Approved'] },
            dueDate: { not: null },
          },
          include: {
            assessment: {
              select: {
                assessorId: true,
                approverId: true,
                vendor: { select: { name: true, accountManagerEmail: true } },
              },
            },
          },
        });

        for (const rem of openRemediations) {
          try {
            if (!rem.dueDate) { skipped++; continue; }

            const severity = rem.severity || 'Medium';
            const reminderDays = getReminderDays(config as Record<string, unknown> | null, severity);

            // Calculate the reminder date: dueDate - reminderDays
            const reminderDate = new Date(rem.dueDate);
            reminderDate.setDate(reminderDate.getDate() - reminderDays);
            reminderDate.setHours(0, 0, 0, 0);

            // Only send if today IS the reminder date
            if (reminderDate.getTime() !== today.getTime()) {
              skipped++;
              continue;
            }

            const daysUntilDue = reminderDays;

            // 4. Collect all involved stakeholders
            const recipientIds: string[] = [];

            // Account Manager
            const amEmail = rem.assessment?.vendor?.accountManagerEmail?.split(';')[0]?.trim();
            if (amEmail) {
              const amUser = await prisma.user.findFirst({
                where: {
                  customerAccountId: customer.id,
                  email: { equals: amEmail, mode: 'insensitive' },
                  isActive: true,
                },
                select: { id: true },
              });
              if (amUser && !recipientIds.includes(amUser.id)) recipientIds.push(amUser.id);
            }

            // Assessor
            if (rem.assessment?.assessorId && !recipientIds.includes(rem.assessment.assessorId)) {
              recipientIds.push(rem.assessment.assessorId);
            }

            // Approver
            if (rem.assessment?.approverId && !recipientIds.includes(rem.assessment.approverId)) {
              recipientIds.push(rem.assessment.approverId);
            }

            // Assigned RM
            if (rem.assignedToUserId && !recipientIds.includes(rem.assignedToUserId)) {
              recipientIds.push(rem.assignedToUserId);
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

            if (recipientIds.length === 0) { skipped++; continue; }

            // 5. Send reminder
            await notificationService.notifyTPRMRemediationDueReminder({
              customerAccountId: customer.id,
              recipientIds,
              remediationId: rem.id,
              issueCode: rem.issueCode || rem.id.substring(0, 8),
              vendorName: rem.assessment?.vendor?.name || '',
              questionTitle: rem.questionText || '',
              dueDate: rem.dueDate.toISOString().split('T')[0],
              daysUntilDue,
            });

            reminded++;
            console.log(
              `[RemediationReminders] Sent reminder for ${rem.issueCode || rem.id} — due ${rem.dueDate.toISOString().split('T')[0]} (${daysUntilDue}d reminder, severity: ${severity})`
            );
          } catch (remErr) {
            console.error(`[RemediationReminders] Error processing remediation ${rem.id}:`, remErr);
            errors.push({
              remediationId: rem.id,
              error: remErr instanceof Error ? remErr.message : 'Unknown error',
            });
          }
        }
      } catch (customerErr) {
        console.error(`[RemediationReminders] Error processing customer ${customer.id}:`, customerErr);
      }
    }

    console.log(`[RemediationReminders] Done. reminded=${reminded}, skipped=${skipped}, errors=${errors.length}`);

    await finishCronRun(runId, 'Completed', { reminded, skipped, errorCount: errors.length },
      `Sent ${reminded} remediation reminder(s), skipped ${skipped}, errors ${errors.length}`);

    return NextResponse.json({
      success: true,
      message: 'Remediation reminder check complete',
      reminded,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[RemediationReminders] Critical error:', error);
    await finishCronRun(runId, 'Failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process remediation reminders',
        message: error instanceof Error ? error.message : 'Unknown error',
        reminded,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 500 }
    );
  }
}
