/**
 * Payment Verification API
 *
 * Called by frontend after Razorpay Checkout completion to verify the payment
 * and finalize the invoice.
 *
 * Flow:
 * 1. Frontend completes Razorpay Checkout
 * 2. Frontend calls this endpoint with razorpay_order_id, razorpay_payment_id, razorpay_signature
 * 3. We verify the signature
 * 4. We call the internal payment-success endpoint to finalize
 * 5. We return success/failure to frontend
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  verifyPaymentSignature,
  fetchAndVerifyPayment,
  isStubMode,
} from "@/lib/payment-provider";

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  invoiceId?: string; // Optional - can look up by order_id
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: VerifyPaymentRequest = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature" },
        { status: 400 }
      );
    }

    console.log(`[Payment Verify] Verifying payment: ${razorpay_payment_id} for order: ${razorpay_order_id}`);

    // Skip signature verification in stub mode
    if (!isStubMode()) {
      // Verify signature
      const isValid = verifyPaymentSignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      if (!isValid) {
        console.error("[Payment Verify] Invalid signature");
        return NextResponse.json(
          { error: "Invalid payment signature" },
          { status: 400 }
        );
      }

      // Fetch and verify payment status from Razorpay
      const paymentResult = await fetchAndVerifyPayment(razorpay_order_id, razorpay_payment_id);

      if (paymentResult.status !== "CAPTURED") {
        console.error("[Payment Verify] Payment not captured:", paymentResult);
        return NextResponse.json(
          {
            error: "Payment not completed",
            status: paymentResult.status,
            errorCode: paymentResult.errorCode,
            errorDescription: paymentResult.errorDescription,
          },
          { status: 400 }
        );
      }
    }

    // Find invoice by order_id (stored as providerOrderId on Payment)
    let invoice;
    if (invoiceId) {
      invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payment: true },
      });
    } else {
      invoice = await prisma.invoice.findFirst({
        where: {
          payment: {
            providerOrderId: razorpay_order_id,
          },
        },
        include: { payment: true },
      });
    }

    if (!invoice) {
      console.error("[Payment Verify] Invoice not found for order:", razorpay_order_id);
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check if already paid
    if (invoice.status === "PAID") {
      console.log("[Payment Verify] Invoice already paid:", invoice.id);
      return NextResponse.json({
        success: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: "ALREADY_PAID",
        message: "Payment already processed",
      });
    }

    // Call internal payment success endpoint
    const secret = process.env.INTERNAL_PAYMENT_SECRET;
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/payments/internal/payment-success`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret && { Authorization: `Bearer ${secret}` }),
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        providerPaymentId: razorpay_payment_id,
        providerSignature: razorpay_signature,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Payment Verify] Failed to finalize payment:", data);
      return NextResponse.json(
        { error: "Failed to finalize payment", details: data },
        { status: 500 }
      );
    }

    console.log("[Payment Verify] Payment verified and finalized:", data);

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: data.data?.invoiceNumber || invoice.invoiceNumber,
      status: data.data?.status || "PAID",
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("[Payment Verify] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
