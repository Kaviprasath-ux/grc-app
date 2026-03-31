import prisma from "@/lib/prisma";

/**
 * Generate the next evidence code (EVD-001, EVD-002, etc.) for a customer account.
 * Extracted as a shared utility so both manual and auto evidence creation can use it.
 */
export async function generateEvidenceCode(
  customerAccountId: string
): Promise<string> {
  const lastEvidence = await prisma.evidence.findFirst({
    where: { customerAccountId },
    orderBy: { createdAt: "desc" },
    select: { evidenceCode: true },
  });

  if (!lastEvidence) {
    return "EVD-001";
  }

  const match = lastEvidence.evidenceCode.match(/EVD-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `EVD-${String(nextNum).padStart(3, "0")}`;
  }

  // Fallback: count-based
  const count = await prisma.evidence.count({ where: { customerAccountId } });
  return `EVD-${String(count + 1).padStart(3, "0")}`;
}
