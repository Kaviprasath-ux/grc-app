/**
 * Invoice PDF generator built on `pdfkit`.
 *
 * Produces a one-page A4 invoice with:
 *   - Header (company name / invoice # / date)
 *   - Bill-to (customer name + GSTIN if present)
 *   - Line items table
 *   - Subtotal, optional bundle discount, GST split (CGST+SGST intra-state OR
 *     IGST inter-state), grand total
 *   - Footer (company GSTIN, payment ID for paid invoices, support contact)
 *
 * Storage convention: `uploads/invoices/{customerAccountId}/{invoiceNumber}.pdf`.
 * Generation should be a one-time event on payment-success — subsequent reads
 * stream from disk via /api/settings/subscription/invoices/[id]/pdf.
 *
 * GST split is computed from `COMPANY_GSTIN` env var:
 *   first 2 digits of GSTIN = state code. If buyer GSTIN starts with the same
 *   state code, intra-state → CGST 9% + SGST 9%. Otherwise IGST 18%. Without a
 *   buyer GSTIN, defaults to IGST.
 */

import PDFDocument from "pdfkit";
import { promises as fs } from "fs";
import path from "path";
import type { Invoice, InvoiceItem } from "@prisma/client";

// Resolved at call-time so env-var changes (especially in tests) take effect.
function companyName() { return process.env.COMPANY_NAME || "Verifai GRC"; }
function companyGstin() { return process.env.COMPANY_GSTIN || ""; } // e.g. "27AAACS1234A1Z5" — Maharashtra
function companyAddress() { return process.env.COMPANY_ADDRESS || ""; }
function supportEmail() { return process.env.SUPPORT_EMAIL || "support@verifai.com"; }

const A4_WIDTH = 595.28;
const MARGIN = 50;

interface InvoiceWithRelations extends Invoice {
  items: InvoiceItem[];
}

interface CustomerSummary {
  code: string;
  name: string;
  gstin?: string | null;
  billingAddress?: string | null;
}

export interface GstSplit {
  cgst: number;
  sgst: number;
  igst: number;
  isIntraState: boolean;
}

export function computeGstSplit(taxAmount: number, buyerGstin: string | null | undefined): GstSplit {
  const ourGstin = companyGstin();
  // Same state if both GSTINs start with same 2-char state code.
  let isIntraState = false;
  if (ourGstin && buyerGstin && buyerGstin.length >= 2) {
    isIntraState = ourGstin.slice(0, 2) === buyerGstin.slice(0, 2);
  }
  if (isIntraState) {
    const half = Math.round((taxAmount / 2) * 100) / 100;
    return { cgst: half, sgst: taxAmount - half, igst: 0, isIntraState: true };
  }
  return { cgst: 0, sgst: 0, igst: taxAmount, isIntraState: false };
}

function inr(n: number): string {
  return `INR ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Generate PDF bytes for the invoice. Doesn't touch disk — caller decides storage.
 */
export function generateInvoicePdfBuffer(
  invoice: InvoiceWithRelations,
  customer: CustomerSummary,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const subtotal = Number(invoice.subtotal);
      const discount = Number(invoice.discountAmount ?? 0);
      const taxableAmount = subtotal - discount;
      const taxAmount = Number(invoice.taxAmount);
      const total = Number(invoice.total);
      const gst = computeGstSplit(taxAmount, customer.gstin);

      // ── Header ─────────────────────────────────────────────────
      const name = companyName();
      const gstin = companyGstin();
      const address = companyAddress();
      doc.fillColor("#3A2D28").fontSize(22).font("Helvetica-Bold").text(name, MARGIN, MARGIN);
      doc.fontSize(9).font("Helvetica").fillColor("#6B5349");
      if (gstin) doc.text(`GSTIN: ${gstin}`, MARGIN, MARGIN + 28);
      if (address) doc.text(address, MARGIN, MARGIN + 42, { width: 250 });

      doc.fontSize(20).fillColor("#A57865").font("Helvetica-Bold")
        .text("TAX INVOICE", MARGIN, MARGIN, { align: "right" });
      doc.fontSize(10).fillColor("#3A2D28").font("Helvetica")
        .text(`Invoice #: ${invoice.invoiceNumber}`, MARGIN, MARGIN + 28, { align: "right" })
        .text(`Issue Date: ${fmtDate(invoice.issueDate)}`, MARGIN, MARGIN + 42, { align: "right" })
        .text(`Period: ${fmtDate(invoice.periodStart)} – ${fmtDate(invoice.periodEnd)}`, MARGIN, MARGIN + 56, { align: "right" });

      // ── Bill-to ────────────────────────────────────────────────
      const billY = MARGIN + 110;
      doc.fontSize(10).fillColor("#6B5349").font("Helvetica-Bold").text("BILL TO", MARGIN, billY);
      doc.font("Helvetica").fillColor("#3A2D28").fontSize(11).text(customer.name, MARGIN, billY + 14);
      doc.fontSize(9).fillColor("#6B5349");
      if (customer.gstin) doc.text(`GSTIN: ${customer.gstin}`, MARGIN, billY + 30);
      doc.text(`Customer Code: ${customer.code}`, MARGIN, billY + (customer.gstin ? 42 : 30));

      // ── Line items table ──────────────────────────────────────
      const tableTop = billY + 80;
      const colDescX = MARGIN;
      const colQtyX = 340;
      const colUnitX = 390;
      const colAmtX = 490;

      doc.rect(MARGIN, tableTop, A4_WIDTH - 2 * MARGIN, 22).fill("#F5E8E1");
      doc.fillColor("#3A2D28").fontSize(9).font("Helvetica-Bold")
        .text("Description", colDescX + 6, tableTop + 7)
        .text("Qty", colQtyX, tableTop + 7, { width: 40 })
        .text("Unit Price", colUnitX, tableTop + 7, { width: 90, align: "right" })
        .text("Amount", colAmtX, tableTop + 7, { width: 60, align: "right" });

      let rowY = tableTop + 22;
      doc.fontSize(9).font("Helvetica").fillColor("#3A2D28");
      for (const item of invoice.items) {
        const descHeight = doc.heightOfString(item.description, { width: colQtyX - colDescX - 12 });
        const rowHeight = Math.max(20, descHeight + 8);
        if (rowY + rowHeight > 720) {
          doc.addPage();
          rowY = MARGIN;
        }
        doc.fillColor("#3A2D28")
          .text(item.description, colDescX + 6, rowY + 4, { width: colQtyX - colDescX - 12 })
          .text(String(item.quantity), colQtyX, rowY + 4, { width: 40 })
          .text(inr(Number(item.unitPrice)), colUnitX, rowY + 4, { width: 90, align: "right" })
          .text(inr(Number(item.amount)), colAmtX, rowY + 4, { width: 60, align: "right" });
        doc.strokeColor("#E8D9CE").lineWidth(0.5)
          .moveTo(MARGIN, rowY + rowHeight).lineTo(A4_WIDTH - MARGIN, rowY + rowHeight).stroke();
        rowY += rowHeight;
      }

      // ── Totals ────────────────────────────────────────────────
      const totalsY = rowY + 16;
      const labelX = 350;
      const valueX = 450;
      doc.fontSize(10).fillColor("#6B5349").font("Helvetica");

      let ty = totalsY;
      doc.text("Subtotal", labelX, ty).text(inr(subtotal), valueX, ty, { width: 95, align: "right" });
      ty += 14;
      if (discount > 0) {
        doc.fillColor("#4A5E3A").text("Discount", labelX, ty).text(`- ${inr(discount)}`, valueX, ty, { width: 95, align: "right" });
        doc.fillColor("#6B5349");
        ty += 14;
        doc.text("Taxable Amount", labelX, ty).text(inr(taxableAmount), valueX, ty, { width: 95, align: "right" });
        ty += 14;
      }
      if (gst.isIntraState) {
        doc.text("CGST (9%)", labelX, ty).text(inr(gst.cgst), valueX, ty, { width: 95, align: "right" });
        ty += 14;
        doc.text("SGST (9%)", labelX, ty).text(inr(gst.sgst), valueX, ty, { width: 95, align: "right" });
        ty += 14;
      } else {
        doc.text("IGST (18%)", labelX, ty).text(inr(gst.igst), valueX, ty, { width: 95, align: "right" });
        ty += 14;
      }

      // Total line
      doc.strokeColor("#A57865").lineWidth(1).moveTo(labelX, ty + 4).lineTo(A4_WIDTH - MARGIN, ty + 4).stroke();
      ty += 10;
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#3A2D28")
        .text("Total", labelX, ty)
        .text(inr(total), valueX, ty, { width: 95, align: "right" });
      ty += 22;

      // ── Footer ────────────────────────────────────────────────
      const footerY = 760;
      doc.fontSize(8).font("Helvetica").fillColor("#8E7065")
        .text(`Status: ${invoice.status}`, MARGIN, footerY)
        .text(`For queries, contact ${supportEmail()}`, MARGIN, footerY + 12)
        .text(`Generated on ${fmtDate(new Date())} by ${name}`, MARGIN, footerY + 24);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convenience: generate the PDF and write to the canonical disk location.
 * Returns the relative path stored on Invoice.pdfPath.
 */
export async function generateAndSaveInvoicePdf(
  invoice: InvoiceWithRelations,
  customer: CustomerSummary,
): Promise<string> {
  const buffer = await generateInvoicePdfBuffer(invoice, customer);
  const relPath = path.posix.join("uploads", "invoices", invoice.customerAccountId, `${invoice.invoiceNumber}.pdf`);
  const absPath = path.join(process.cwd(), relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buffer);
  return relPath;
}
