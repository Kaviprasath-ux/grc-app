/**
 * GET /api/settings/subscription/invoices/[id]/pdf
 *
 * Streams the invoice PDF for a customer admin's own invoices.
 * Auto-scopes to session.customerAccountId — refuses to serve another
 * customer's invoice even if the [id] is guessed.
 *
 * If the PDF has not been generated yet (Invoice.pdfPath is null), it is
 * generated on first request and persisted under uploads/invoices/.
 */

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { generateAndSaveInvoicePdf } from "@/lib/invoice-pdf";

interface RouteContext { params: Promise<{ id: string }>; }

export const GET = withAuth(
  async (_req, context: RouteContext, session) => {
    const { id } = await context.params;
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        subscription: { select: { gstin: true } },
        customerAccount: { select: { id: true, code: true, name: true } },
      },
    });

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.customerAccountId !== session.customerAccountId) {
      return NextResponse.json({ error: "Not authorised for this invoice" }, { status: 403 });
    }

    // Generate on first access if missing
    let relPath = invoice.pdfPath;
    if (!relPath) {
      relPath = await generateAndSaveInvoicePdf(
        { ...invoice, items: invoice.items },
        {
          code: invoice.customerAccount.code,
          name: invoice.customerAccount.name,
          gstin: invoice.subscription?.gstin ?? null,
        }
      );
      await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath: relPath } });
    }

    const absPath = path.join(process.cwd(), relPath);
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(absPath);
    } catch {
      // File missing on disk — regenerate
      const fresh = await generateAndSaveInvoicePdf(
        { ...invoice, items: invoice.items, pdfPath: null },
        {
          code: invoice.customerAccount.code,
          name: invoice.customerAccount.name,
          gstin: invoice.subscription?.gstin ?? null,
        }
      );
      buffer = await fs.readFile(path.join(process.cwd(), fresh));
      await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath: fresh } });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  },
  { resource: "subscription.customer-portal", action: "view" }
);
