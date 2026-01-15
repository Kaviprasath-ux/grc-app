import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Risk Settings demo data...");

  // Vulnerability Categories
  const vulnerabilityCategories = [
    { name: "Technical Vulnerabilities" },
    { name: "Process Vulnerabilities" },
    { name: "People Vulnerabilities" },
    { name: "Physical Vulnerabilities" },
    { name: "Environmental Vulnerabilities" },
  ];

  for (const cat of vulnerabilityCategories) {
    await prisma.vulnerabilityCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log("  ✓ Vulnerability Categories");

  // Threat Categories
  const threatCategories = [
    { name: "Cyber Threats" },
    { name: "Operational Threats" },
    { name: "External Threats" },
    { name: "Internal Threats" },
    { name: "Environmental Threats" },
  ];

  for (const cat of threatCategories) {
    await prisma.threatCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log("  ✓ Threat Categories");

  // Control Strengths
  const controlStrengths = [
    { name: "Ineffective", score: 0 },
    { name: "Weak", score: 25 },
    { name: "Moderate", score: 50 },
    { name: "Strong", score: 75 },
    { name: "Very Strong", score: 100 },
  ];

  for (const strength of controlStrengths) {
    await prisma.controlStrength.upsert({
      where: { name: strength.name },
      update: { score: strength.score },
      create: strength,
    });
  }
  console.log("  ✓ Control Strengths");

  // Risk Likelihoods
  const likelihoods = [
    { title: "Rare", score: 1, timeFrame: "May occur in exceptional circumstances", probability: "<5%" },
    { title: "Unlikely", score: 2, timeFrame: "Could occur within 5 years", probability: "5-20%" },
    { title: "Possible", score: 3, timeFrame: "Could occur within 3 years", probability: "20-50%" },
    { title: "Likely", score: 4, timeFrame: "Could occur within 1 year", probability: "50-80%" },
    { title: "Almost Certain", score: 5, timeFrame: "Expected to occur within 6 months", probability: ">80%" },
  ];

  for (const likelihood of likelihoods) {
    await prisma.riskLikelihood.upsert({
      where: { title: likelihood.title },
      update: { score: likelihood.score, timeFrame: likelihood.timeFrame, probability: likelihood.probability },
      create: likelihood,
    });
  }
  console.log("  ✓ Risk Likelihoods");

  // Impact Categories
  const impactCategories = [
    { name: "Financial Impact" },
    { name: "Operational Impact" },
    { name: "Reputational Impact" },
    { name: "Legal/Regulatory Impact" },
    { name: "Safety Impact" },
    { name: "Strategic Impact" },
  ];

  for (const cat of impactCategories) {
    await prisma.impactCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log("  ✓ Impact Categories");

  // Impact Ratings
  const impactRatings = [
    { name: "Insignificant", score: 1, description: "Minimal impact, easily recoverable with minimal effort" },
    { name: "Minor", score: 2, description: "Minor impact, recoverable with some effort and resources" },
    { name: "Moderate", score: 3, description: "Noticeable impact, requires significant effort to recover" },
    { name: "Major", score: 4, description: "Substantial impact, may cause significant disruption" },
    { name: "Catastrophic", score: 5, description: "Severe impact, may threaten organization viability" },
  ];

  for (const rating of impactRatings) {
    await prisma.impactRating.upsert({
      where: { name: rating.name },
      update: { score: rating.score, description: rating.description },
      create: rating,
    });
  }
  console.log("  ✓ Impact Ratings");

  // Vulnerability Ratings
  const vulnerabilityRatings = [
    { label: "Low", score: 1 },
    { label: "Medium-Low", score: 2 },
    { label: "Medium", score: 3 },
    { label: "Medium-High", score: 4 },
    { label: "High", score: 5 },
  ];

  for (const rating of vulnerabilityRatings) {
    await prisma.vulnerabilityRating.upsert({
      where: { label: rating.label },
      update: { score: rating.score },
      create: rating,
    });
  }
  console.log("  ✓ Vulnerability Ratings");

  // Risk Sub Categories
  const riskSubCategories = [
    { type: "Cyber Security" },
    { type: "Data Privacy" },
    { type: "Business Continuity" },
    { type: "Supply Chain" },
    { type: "Regulatory Compliance" },
    { type: "Financial Fraud" },
    { type: "Workplace Safety" },
    { type: "Environmental" },
  ];

  for (const cat of riskSubCategories) {
    await prisma.riskSubCategory.upsert({
      where: { type: cat.type },
      update: {},
      create: cat,
    });
  }
  console.log("  ✓ Risk Sub Categories");

  // Risk Ranges (rating thresholds)
  const riskRanges = [
    { title: "Low Risk", color: "#22c55e", lowRange: 1, highRange: 5, timelineDays: 90, description: "Acceptable risk level, monitor periodically" },
    { title: "Medium Risk", color: "#eab308", lowRange: 6, highRange: 10, timelineDays: 60, description: "Requires attention and monitoring" },
    { title: "High Risk", color: "#f97316", lowRange: 11, highRange: 15, timelineDays: 30, description: "Requires prompt action and mitigation" },
    { title: "Very High Risk", color: "#ef4444", lowRange: 16, highRange: 20, timelineDays: 14, description: "Requires immediate action" },
    { title: "Critical Risk", color: "#dc2626", lowRange: 21, highRange: 25, timelineDays: 7, description: "Escalate immediately to senior management" },
  ];

  for (const range of riskRanges) {
    await prisma.riskRange.upsert({
      where: { title: range.title },
      update: { color: range.color, lowRange: range.lowRange, highRange: range.highRange, timelineDays: range.timelineDays, description: range.description },
      create: range,
    });
  }
  console.log("  ✓ Risk Ranges");

  // Risk Score Configuration
  const existingConfig = await prisma.riskScoreConfig.findFirst();
  if (!existingConfig) {
    await prisma.riskScoreConfig.create({
      data: {
        useLikelihood: true,
        useImpact: true,
        useAssetScore: false,
        useVulnerabilityScore: false,
        riskTolerance: 10,
      },
    });
  }
  console.log("  ✓ Risk Score Configuration");

  // Risk Categories (update existing with status)
  const riskCategories = [
    { name: "Strategic Risk", description: "Risks affecting long-term organizational objectives", color: "#8b5cf6", status: "Active" },
    { name: "Operational Risk", description: "Risks from internal processes, people, or systems", color: "#3b82f6", status: "Active" },
    { name: "Financial Risk", description: "Risks affecting financial health and stability", color: "#10b981", status: "Active" },
    { name: "Compliance Risk", description: "Risks from regulatory or legal requirements", color: "#f59e0b", status: "Active" },
    { name: "IT/Cyber Risk", description: "Risks related to information technology and cyber security", color: "#ef4444", status: "Active" },
    { name: "Reputational Risk", description: "Risks affecting organizational reputation", color: "#ec4899", status: "Active" },
  ];

  for (const cat of riskCategories) {
    await prisma.riskCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, color: cat.color, status: cat.status },
      create: cat,
    });
  }
  console.log("  ✓ Risk Categories");

  console.log("\n✅ Risk Settings demo data seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding risk settings:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
