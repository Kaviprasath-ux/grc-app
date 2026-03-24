/**
 * Cron Job Run Logger
 * Creates and updates ScheduledTask records to track individual cron executions.
 */

import prisma from '@/lib/prisma';

export interface CronResult {
  [key: string]: unknown;
}

/**
 * Start a cron run log. Call at the beginning of a cron handler.
 * Returns the run ID to pass to finishCronRun().
 */
export async function startCronRun(params: {
  taskFunction: string;
  name: string;
  schedule: string;
  triggeredBy?: 'schedule' | 'manual';
}): Promise<string> {
  const run = await prisma.scheduledTask.create({
    data: {
      name: params.name,
      taskFunction: params.taskFunction,
      schedule: params.schedule,
      status: 'Running',
      triggeredBy: params.triggeredBy ?? 'schedule',
      startedAt: new Date(),
    },
  });
  return run.id;
}

/**
 * Finish a cron run log. Call at the end of a cron handler.
 */
export async function finishCronRun(
  runId: string,
  status: 'Completed' | 'Failed',
  result: CronResult,
  description?: string,
): Promise<void> {
  await prisma.scheduledTask.update({
    where: { id: runId },
    data: {
      status,
      completedAt: new Date(),
      contextData: JSON.stringify(result),
      description: description ?? null,
    },
  });
}
