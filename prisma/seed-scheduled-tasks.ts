import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding scheduled tasks...");

  const tasks = [
    {
      name: "System.ScheduledEvent",
      taskFunction: "Cron.DueReminders",
      description: "Sends notifications for items due within 24 hours (evidence, CAPA, policies, contracts, assessments)",
      schedule: "0 8 * * *",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Cron.Escalation",
      description: "Escalates overdue fieldwork responses, clarifications, and report acknowledgments",
      schedule: "0 9 * * *",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Assessment.CadenceScheduler",
      description: "Triggers periodic assessments based on VRR cadence configuration for each vendor",
      schedule: "0 0 * * *",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Vendor.ContractExpiryNotifier",
      description: "Notifies stakeholders of vendor contracts expiring within 30 days",
      schedule: "0 7 * * *",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "EmailTemplate.Scheduler",
      description: "Processes queued email notifications and template-based messages",
      schedule: "*/15 * * * *",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Vendor.SecurityScanScheduler",
      description: "Triggers automated security monitoring scans for vendors based on configured schedule",
      schedule: "0 2 * * 1",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "System.CleanupExpiredSessions",
      description: "Removes expired user sessions and temporary authentication tokens",
      schedule: "0 3 * * *",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "DeepLink.ClearOldLinks",
      description: "Cleans up expired deep links and temporary URL tokens older than 30 days",
      schedule: "0 4 * * 0",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Translation.BatchProcessor",
      description: "Processes pending dynamic translation requests for multi-language data entries",
      schedule: "*/30 * * * *",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Audit.FindingReminder",
      description: "Sends reminders for audit findings and CAPA items approaching their due dates",
      schedule: "0 8 * * 1-5",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Compliance.EvidenceReminder",
      description: "Notifies evidence owners of upcoming evidence collection deadlines",
      schedule: "0 9 * * 1-5",
      status: "Idle",
      isActive: true,
    },
    {
      name: "System.ScheduledEvent",
      taskFunction: "Risk.ReassessmentTrigger",
      description: "Triggers risk reassessment notifications based on configured review cycles",
      schedule: "0 6 1 * *",
      status: "Idle",
      isActive: true,
    },
  ];

  for (const task of tasks) {
    await prisma.scheduledTask.upsert({
      where: { queueId: task.taskFunction },
      update: { ...task },
      create: { ...task, queueId: task.taskFunction },
    });
  }

  console.log(`Seeded ${tasks.length} scheduled tasks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
