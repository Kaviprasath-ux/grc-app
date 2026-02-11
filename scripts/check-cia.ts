import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const classifications = await prisma.assetCIAClassification.findMany({
    include: {
      subCategory: true,
      group: true,
      sensitivity: true,
    },
  });

  console.log(`Found ${classifications.length} classifications`);
  classifications.forEach((c) => {
    console.log(`- ${c.subCategory?.name} / ${c.group?.name} / ${c.sensitivity?.name} | C:${c.confidentiality} I:${c.integrity} A:${c.availability}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
