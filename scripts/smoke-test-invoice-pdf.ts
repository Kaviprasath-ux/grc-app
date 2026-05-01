/**
 * Tests the invoice PDF generator + numbering helper.
 * Creates a synthetic invoice, generates a PDF to disk, verifies header bytes.
 *
 * Run: npx tsx scripts/smoke-test-invoice-pdf.ts
 */

import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { generateInvoicePdfBuffer, generateAndSaveInvoicePdf, computeGstSplit } from "@/lib/invoice-pdf";
import { nextInvoiceNumber } from "@/lib/invoice-number";

const prisma = new PrismaClient();
const CODE = "_INVOICE_PDF_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  const c = await prisma.customerAccount.findUnique({ where: { code: CODE } });
  if (c) {
    await prisma.invoiceItem.deleteMany({ where: { invoice: { customerAccountId: c.id } } });
    await prisma.invoice.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
    await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
}

async function main() {
  await cleanup();

  // ── computeGstSplit unit tests ────────────────────────────
  console.log("computeGstSplit");
  const noGstin = computeGstSplit(1800, null);
  assert(noGstin.igst === 1800 && noGstin.cgst === 0, "no buyer GSTIN → IGST 18%");

  process.env.COMPANY_GSTIN = "27AAACS1234A1Z5"; // Maharashtra (state 27)
  const sameState = computeGstSplit(1800, "27ABCDE5678F1Z9");
  assert(sameState.isIntraState === true, "same state code → intra-state");
  assert(sameState.cgst + sameState.sgst === 1800, "CGST+SGST = full tax");
  assert(Math.abs(sameState.cgst - sameState.sgst) <= 0.01, "CGST and SGST equal halves");
  assert(sameState.igst === 0, "IGST = 0 for intra-state");

  const interState = computeGstSplit(1800, "29ABCDE5678F1Z9"); // Karnataka
  assert(!interState.isIntraState, "different state → inter-state");
  assert(interState.igst === 1800, "IGST = full tax for inter-state");

  // ── nextInvoiceNumber ────────────────────────────────────
  console.log("\nnextInvoiceNumber sequencing");
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Invoice Test Co", isGrcAdded: true },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true, gstin: "27ABCDE5678F1Z9" },
  });

  const num1 = await nextInvoiceNumber();
  assert(/^INV-\d{4}-\d{4}$/.test(num1), `format INV-YYYY-NNNN (got ${num1})`);

  await prisma.invoice.create({
    data: {
      invoiceNumber: num1,
      subscriptionId: sub.id,
      customerAccountId: customer.id,
      issueDate: new Date(),
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 365 * 86400000),
      subtotal: 50000, discountAmount: 0, taxAmount: 9000, total: 59000,
      status: "ISSUED",
    },
  });

  const num2 = await nextInvoiceNumber();
  const seq1 = parseInt(num1.split("-")[2]);
  const seq2 = parseInt(num2.split("-")[2]);
  assert(seq2 === seq1 + 1, `sequence increments (${seq1} → ${seq2})`);

  // ── generateInvoicePdfBuffer ──────────────────────────────
  console.log("\nPDF generation");
  const inv = await prisma.invoice.findFirst({
    where: { customerAccountId: customer.id },
    include: { items: true },
  });
  // Add an item
  await prisma.invoiceItem.create({
    data: {
      invoiceId: inv!.id,
      description: "GRC Module — Basic (Yearly, May 2026 – May 2027)",
      moduleCode: "GRC",
      tier: "BASIC",
      quantity: 1,
      unitPrice: 50000,
      amount: 50000,
    },
  });
  const invWithItems = await prisma.invoice.findUnique({
    where: { id: inv!.id },
    include: { items: true },
  });

  const buffer = await generateInvoicePdfBuffer(invWithItems!, {
    code: customer.code,
    name: customer.name,
    gstin: "27ABCDE5678F1Z9",
  });
  assert(buffer.length > 0, "buffer non-empty");
  // PDF magic bytes
  const magic = buffer.slice(0, 4).toString("ascii");
  assert(magic === "%PDF", `starts with %PDF (got "${magic}")`);

  // ── generateAndSaveInvoicePdf writes to disk ──────────────
  console.log("\ngenerateAndSaveInvoicePdf writes to disk");
  const relPath = await generateAndSaveInvoicePdf(invWithItems!, {
    code: customer.code,
    name: customer.name,
    gstin: "27ABCDE5678F1Z9",
  });
  assert(relPath.startsWith("uploads/invoices/"), `path under uploads/invoices/ (got ${relPath})`);
  assert(relPath.endsWith(".pdf"), "ends with .pdf");
  assert(relPath.includes(num1), `path contains invoiceNumber (${num1})`);

  const absPath = path.join(process.cwd(), relPath);
  const stats = await fs.stat(absPath);
  assert(stats.size > 1000, `file size > 1KB (got ${stats.size})`);

  // ── Cleanup files + DB ─────────────────────────────────────
  try { await fs.unlink(absPath); } catch {}
  try {
    const dir = path.dirname(absPath);
    const remaining = await fs.readdir(dir);
    if (remaining.length === 0) await fs.rmdir(dir);
  } catch {}

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());
