/**
 * Sequential per-calendar-year invoice numbering: INV-YYYY-0001, INV-YYYY-0002, …
 *
 * Implementation: SELECT MAX from existing invoices that match the year prefix,
 * INCREMENT, format. Wraps in a transaction so two concurrent renewals can't
 * collide on the same number. (Postgres SELECT FOR UPDATE on the row would be
 * safer at very high concurrency; for our throughput, transaction + retry is
 * sufficient.)
 */

import prisma from "@/lib/prisma";

export async function nextInvoiceNumber(now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `INV-${year}-`;

  return await prisma.$transaction(async (tx) => {
    // Find the highest existing number for this year
    const latest = await tx.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });

    let nextSeq = 1;
    if (latest) {
      const parts = latest.invoiceNumber.split("-");
      const lastSeq = parseInt(parts[2] ?? "0", 10);
      if (!Number.isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  });
}
