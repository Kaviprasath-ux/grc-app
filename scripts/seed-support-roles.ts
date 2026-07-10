import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  { name: "SupportAgentL1", description: "Level 1 support agent — handles assigned tickets, escalates to L2", isSystem: true },
  { name: "SupportSpecialistL2", description: "Level 2 functional/domain specialist", isSystem: true },
  { name: "SupportEngineerL3", description: "Level 3 engineering support", isSystem: true },
  { name: "SupportManager", description: "Support manager — full ticket access and routing settings", isSystem: true },
];

async function main() {
  for (const r of roles) {
    await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
    console.log("upserted role", r.name);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
