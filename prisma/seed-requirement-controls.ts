import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding requirement-control links...");

  // Get the ISO 27001:2022 framework
  const framework = await prisma.framework.findFirst({
    where: { name: "ISO 27001:2022" },
  });

  if (!framework) {
    console.log("❌ ISO 27001:2022 framework not found.");
    return;
  }

  // Get all requirements for this framework
  const requirements = await prisma.requirement.findMany({
    where: { frameworkId: framework.id },
    orderBy: { code: "asc" },
  });

  console.log(`✅ Found ${requirements.length} requirements`);

  // Get all controls
  const controls = await prisma.control.findMany({
    include: { domain: true },
  });

  console.log(`✅ Found ${controls.length} controls`);

  if (controls.length === 0) {
    console.log("❌ No controls found. Please run main seed first.");
    return;
  }

  // Clear existing requirement-control links for fresh start
  await prisma.requirementControl.deleteMany({
    where: {
      requirement: { frameworkId: framework.id }
    }
  });
  console.log("✅ Cleared existing requirement-control links");

  // Link controls to requirements with a realistic distribution
  // Each requirement will have 1-5 linked controls
  let linkCount = 0;

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];

    // Determine how many controls to link (1-5 based on requirement)
    const numControls = Math.min(1 + (i % 5), controls.length);

    // Select controls for this requirement (rotating through available controls)
    for (let j = 0; j < numControls; j++) {
      const controlIndex = (i * 3 + j) % controls.length;
      const control = controls[controlIndex];

      try {
        await prisma.requirementControl.create({
          data: {
            requirementId: req.id,
            controlId: control.id,
          },
        });
        linkCount++;
      } catch (e) {
        // Skip if already exists
      }
    }
  }

  console.log(`✅ Created ${linkCount} requirement-control links`);

  // Update control statuses to have variety (Compliant, Non Compliant, Partial Compliant)
  const statuses = ["Compliant", "Non Compliant", "Partial Compliant"];
  for (let i = 0; i < controls.length; i++) {
    const status = statuses[i % 3];
    await prisma.control.update({
      where: { id: controls[i].id },
      data: { status },
    });
  }
  console.log("✅ Updated control statuses with variety");

  // Create RequirementExceptions (these are standalone exceptions linked to requirements)
  const dept = await prisma.department.findFirst();

  // Get specific requirements
  const req53 = requirements.find(r => r.code === "5.3");
  const req74 = requirements.find(r => r.code === "7.4");
  const req63 = requirements.find(r => r.code === "6.3");

  const requirementExceptions = [
    {
      code: "REQ-EXC-001",
      name: "Delayed Implementation - Clause 5.3",
      description: "Organizational roles and responsibilities documentation is pending HR approval. Expected completion by Q2 2026.",
      category: "Compliance",
      status: "Approved",
      endDate: new Date("2026-06-30"),
      requirementId: req53?.id,
      departmentId: dept?.id,
    },
    {
      code: "REQ-EXC-002",
      name: "Resource Constraint - Clause 7.4",
      description: "Communication procedures are being developed. Additional resources allocated for completion.",
      category: "Compliance",
      status: "Pending",
      endDate: new Date("2026-03-31"),
      requirementId: req74?.id,
      departmentId: dept?.id,
    },
    {
      code: "REQ-EXC-003",
      name: "Technical Limitation - Clause 6.3",
      description: "Change management system upgrade required before full implementation. Vendor evaluation in progress.",
      category: "Compliance",
      status: "Authorised",
      endDate: new Date("2026-04-30"),
      requirementId: req63?.id,
      departmentId: dept?.id,
    },
  ];

  for (const exc of requirementExceptions) {
    if (exc.requirementId) {
      await prisma.requirementException.upsert({
        where: { code: exc.code },
        update: {
          name: exc.name,
          description: exc.description,
          status: exc.status,
          endDate: exc.endDate,
        },
        create: {
          code: exc.code,
          name: exc.name,
          description: exc.description,
          category: exc.category,
          status: exc.status,
          endDate: exc.endDate,
          requirementId: exc.requirementId,
          departmentId: exc.departmentId,
        },
      });
    }
  }
  console.log(`✅ Created ${requirementExceptions.filter(e => e.requirementId).length} requirement exceptions`);

  // Print summary
  const finalRequirements = await prisma.requirement.findMany({
    where: { frameworkId: framework.id },
    include: {
      controls: {
        include: { control: true }
      },
      exceptions: true,
    },
    orderBy: { code: "asc" },
  });

  console.log("\n📊 Summary of Requirements with Linked Controls:");
  console.log("─".repeat(80));
  console.log("Code".padEnd(10) + "Requirement Name".padEnd(45) + "Controls".padEnd(10) + "Exceptions");
  console.log("─".repeat(80));

  for (const req of finalRequirements) {
    const controlCount = req.controls.length;
    const exceptionCount = req.exceptions.length;
    const controlStatus = controlCount > 0
      ? `✓ ${controlCount}`
      : "0";
    const exceptionStatus = exceptionCount > 0
      ? `⚠ ${exceptionCount}`
      : "-";
    console.log(
      `${req.code.padEnd(10)}${req.name.substring(0, 43).padEnd(45)}${controlStatus.padEnd(10)}${exceptionStatus}`
    );
  }

  console.log("─".repeat(80));
  console.log(`Total: ${finalRequirements.length} requirements, ${linkCount} control links`);
  console.log("\n🎉 Requirement-control linking completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
