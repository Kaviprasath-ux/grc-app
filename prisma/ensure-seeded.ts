
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking database seed status...");

    try {
        // Check for the superadmin user (defined in bootstrap-grc-admin.ts)
        const superAdmin = await prisma.user.findUnique({
            where: { userName: "superadmin" },
        });

        if (superAdmin) {
            console.log("✅ Database is already seeded (Admin found: superadmin).");
        } else {
            console.log("⚠️ Admin user not found. Running bootstrap script...");
            try {
                // Run the robust bootstrap script instead of the potentially broken seed.ts
                execSync("npx ts-node prisma/bootstrap-grc-admin.ts", { stdio: "inherit" });
                console.log("✅ Admin bootstrapping completed successfully.");
            } catch (error) {
                console.error("❌ Failed to run bootstrap script:", error);
                process.exit(1);
            }
        }
    } catch (error) {
        console.error("❌ Error checking database status:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
