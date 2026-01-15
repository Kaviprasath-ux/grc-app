import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedBIASettings() {
  console.log("Seeding BIA settings...");

  // Seed BIA Categories
  const categories = [
    { name: "Financial", description: "Financial impact on the organization", sortOrder: 0 },
    { name: "Reputational impact", description: "Impact on organization reputation", sortOrder: 1 },
    { name: "Regulatory", description: "Regulatory compliance impact", sortOrder: 2 },
    { name: "Safety", description: "Safety impact on personnel and assets", sortOrder: 3 },
    { name: "Operational", description: "Operational impact on business processes", sortOrder: 4 },
  ];

  for (const category of categories) {
    await prisma.bIACategory.upsert({
      where: { name: category.name },
      update: category,
      create: { ...category, isActive: true },
    });
  }
  console.log(`  Created ${categories.length} BIA categories`);

  // Seed BIA Ratings
  const ratings = [
    { label: "High", score: 100, description: "Severe impact requiring immediate attention", sortOrder: 0 },
    { label: "Medium", score: 80, description: "Moderate impact requiring attention", sortOrder: 1 },
    { label: "Low", score: 10, description: "Minimal impact with low priority", sortOrder: 2 },
  ];

  for (const rating of ratings) {
    await prisma.bIARating.upsert({
      where: { label: rating.label },
      update: rating,
      create: { ...rating, isActive: true },
    });
  }
  console.log(`  Created ${ratings.length} BIA ratings`);

  // Seed BIA Scoring Config
  const existingConfig = await prisma.bIAScoringConfig.findFirst();
  if (!existingConfig) {
    await prisma.bIAScoringConfig.create({
      data: {
        calculationType: "High of all",
        isActive: true,
      },
    });
    console.log("  Created BIA scoring config");
  }

  // Seed BIA Scoring Ranges for "Addition of all" calculation type
  const additionRanges = [
    { label: "Critical", lowValue: 400, highValue: null, calculationType: "Addition of all", sortOrder: 0 },
    { label: "High", lowValue: 250, highValue: 399, calculationType: "Addition of all", sortOrder: 1 },
    { label: "Medium", lowValue: 100, highValue: 249, calculationType: "Addition of all", sortOrder: 2 },
    { label: "Low", lowValue: 0, highValue: 99, calculationType: "Addition of all", sortOrder: 3 },
  ];

  for (const range of additionRanges) {
    const existing = await prisma.bIAScoringRange.findUnique({
      where: { label_calculationType: { label: range.label, calculationType: range.calculationType } },
    });
    if (!existing) {
      await prisma.bIAScoringRange.create({ data: range });
    }
  }
  console.log(`  Created BIA scoring ranges for Addition of all`);

  // Seed BIA Scoring Ranges for "Product of all" calculation type
  const productRanges = [
    { label: "Critical", lowValue: 100000000, highValue: null, calculationType: "Product of all", sortOrder: 0 },
    { label: "High", lowValue: 10000000, highValue: 99999999, calculationType: "Product of all", sortOrder: 1 },
    { label: "Medium", lowValue: 1000000, highValue: 9999999, calculationType: "Product of all", sortOrder: 2 },
    { label: "Low", lowValue: 0, highValue: 999999, calculationType: "Product of all", sortOrder: 3 },
  ];

  for (const range of productRanges) {
    const existing = await prisma.bIAScoringRange.findUnique({
      where: { label_calculationType: { label: range.label, calculationType: range.calculationType } },
    });
    if (!existing) {
      await prisma.bIAScoringRange.create({ data: range });
    }
  }
  console.log(`  Created BIA scoring ranges for Product of all`);

  // Seed BCP Labels
  const bcpLabels = [
    { name: "Critical", type: "Criticality", hours: 0, sortOrder: 0 },
    { name: "High", type: "Criticality", hours: 0, sortOrder: 1 },
    { name: "Medium", type: "Criticality", hours: 0, sortOrder: 2 },
    { name: "Low", type: "Criticality", hours: 0, sortOrder: 3 },
    { name: "RTO 4 Hours", type: "RTO", hours: 4, sortOrder: 4 },
    { name: "RTO 8 Hours", type: "RTO", hours: 8, sortOrder: 5 },
    { name: "RTO 24 Hours", type: "RTO", hours: 24, sortOrder: 6 },
    { name: "RTO 48 Hours", type: "RTO", hours: 48, sortOrder: 7 },
    { name: "RTO 72 Hours", type: "RTO", hours: 72, sortOrder: 8 },
    { name: "RPO 1 Hour", type: "RPO", hours: 1, sortOrder: 9 },
    { name: "RPO 4 Hours", type: "RPO", hours: 4, sortOrder: 10 },
    { name: "RPO 8 Hours", type: "RPO", hours: 8, sortOrder: 11 },
    { name: "RPO 24 Hours", type: "RPO", hours: 24, sortOrder: 12 },
  ];

  for (const label of bcpLabels) {
    await prisma.bCPLabel.upsert({
      where: { name: label.name },
      update: label,
      create: { ...label, isActive: true },
    });
  }
  console.log(`  Created ${bcpLabels.length} BCP labels`);

  console.log("BIA settings seeding completed!");
}

seedBIASettings()
  .catch((e) => {
    console.error("Error seeding BIA settings:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
