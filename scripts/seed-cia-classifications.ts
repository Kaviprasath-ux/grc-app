import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding CIA Classifications...");

  // Get existing sub-categories, groups, and sensitivities
  const subCategories = await prisma.assetSubCategory.findMany();
  const groups = await prisma.assetGroup.findMany();
  const sensitivities = await prisma.assetSensitivity.findMany();

  const subCategoryMap: { [key: string]: string } = {};
  subCategories.forEach((sc) => {
    subCategoryMap[sc.name] = sc.id;
  });

  const groupMap: { [key: string]: string } = {};
  groups.forEach((g) => {
    groupMap[g.name] = g.id;
  });

  const sensitivityMap: { [key: string]: string } = {};
  sensitivities.forEach((s) => {
    sensitivityMap[s.name] = s.id;
  });

  const ciaClassifications = [
    {
      subCategory: "Server",
      group: "Infrastructure",
      sensitivity: "Restricted",
      c: "high",
      cScore: 10,
      i: "high",
      iScore: 10,
      a: "high",
      aScore: 10,
    },
    {
      subCategory: "Server",
      group: "Core Banking",
      sensitivity: "Restricted",
      c: "high",
      cScore: 10,
      i: "high",
      iScore: 10,
      a: "high",
      aScore: 10,
    },
    {
      subCategory: "Firewall",
      group: "Security Tools",
      sensitivity: "Restricted",
      c: "high",
      cScore: 10,
      i: "high",
      iScore: 10,
      a: "high",
      aScore: 10,
    },
    {
      subCategory: "Database",
      group: "Core Banking",
      sensitivity: "Restricted",
      c: "high",
      cScore: 10,
      i: "high",
      iScore: 10,
      a: "medium",
      aScore: 5,
    },
    {
      subCategory: "Customer Data",
      group: "Customer Facing",
      sensitivity: "Restricted",
      c: "high",
      cScore: 10,
      i: "high",
      iScore: 10,
      a: "medium",
      aScore: 5,
    },
    {
      subCategory: "Workstation",
      group: "Internal Operations",
      sensitivity: "Internal",
      c: "medium",
      cScore: 5,
      i: "medium",
      iScore: 5,
      a: "low",
      aScore: 0,
    },
    {
      subCategory: "Enterprise Application",
      group: "Internal Operations",
      sensitivity: "Confidential",
      c: "medium",
      cScore: 5,
      i: "high",
      iScore: 10,
      a: "medium",
      aScore: 5,
    },
  ];

  for (const cia of ciaClassifications) {
    const subCategoryId = subCategoryMap[cia.subCategory];
    const groupId = groupMap[cia.group];
    const sensitivityId = sensitivityMap[cia.sensitivity];

    if (!subCategoryId || !groupId || !sensitivityId) {
      console.log(
        `⚠️  Skipping ${cia.subCategory} - ${cia.group}: missing references`
      );
      continue;
    }

    const maxScore = Math.max(cia.cScore, cia.iScore, cia.aScore);
    const criticality =
      maxScore >= 10 ? "high" : maxScore >= 5 ? "medium" : "low";

    const existing = await prisma.assetCIAClassification.findFirst({
      where: {
        subCategoryId,
        groupId,
      },
    });

    if (!existing) {
      await prisma.assetCIAClassification.create({
        data: {
          subCategoryId,
          groupId,
          sensitivityId,
          confidentiality: cia.c,
          confidentialityScore: cia.cScore,
          integrity: cia.i,
          integrityScore: cia.iScore,
          availability: cia.a,
          availabilityScore: cia.aScore,
          assetCriticality: criticality,
          assetCriticalityScore: maxScore,
        },
      });
      console.log(`✅ Created: ${cia.subCategory} - ${cia.group}`);
    } else {
      console.log(`⏭️  Already exists: ${cia.subCategory} - ${cia.group}`);
    }
  }

  console.log("✅ CIA Classifications seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
