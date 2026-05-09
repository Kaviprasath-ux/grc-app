import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * This seed file is intentionally empty.
 * Customer accounts should be created through the application, not seeded.
 */
async function main() {
  console.log("🏢 Customer seed script - skipped (no customer data to seed)");
  console.log("   Create customer accounts through the superadmin interface.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
