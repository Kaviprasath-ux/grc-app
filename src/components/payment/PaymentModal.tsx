"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Smartphone, Building2, Wallet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentData: PaymentSuccessData) => void;
  onError: (error: string) => void;
  orderId: string;
  amount: number; // in paise
  currency: string;
  keyId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
}

export interface PaymentSuccessData {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

type PaymentMethod = "upi" | "card" | "netbanking" | "wallet";

interface UPIDetails {
  vpa: string;
}

interface CardDetails {
  number: string;
  expiry: string;
  cvv: string;
  name: string;
}

const POPULAR_BANKS = [
  { code: "HDFC", name: "HDFC Bank" },
  { code: "ICIC", name: "ICICI Bank" },
  { code: "SBIN", name: "State Bank of India" },
  { code: "KKBK", name: "Kotak Mahindra Bank" },
  { code: "UTIB", name: "Axis Bank" },
  { code: "PUNB", name: "Punjab National Bank" },
  { code: "BARB", name: "Bank of Baroda" },
  { code: "CNRB", name: "Canara Bank" },
];

const WALLETS = [
  { code: "paytm", name: "Paytm" },
  { code: "phonepe", name: "PhonePe" },
  { code: "freecharge", name: "Freecharge" },
  { code: "mobikwik", name: "MobiKwik" },
];

// Razorpay types (local to this component)
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    vpa?: string;
  };
  handler: (response: PaymentSuccessData) => void;
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
  };
  config?: {
    display?: {
      blocks?: Record<string, unknown>;
      sequence?: string[];
      preferences?: Record<string, unknown>;
    };
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: { error: { description: string } }) => void) => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  orderId,
  amount,
  currency,
  keyId,
  customerName,
  customerEmail,
  customerPhone,
  description,
}: PaymentModalProps) {
  // Check if Razorpay is available
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);

  useEffect(() => {
    // Check if Razorpay is loaded
    const checkRazorpay = () => {
      if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay) {
        setRazorpayAvailable(true);
        return true;
      }
      return false;
    };

    if (checkRazorpay()) return;

    // Poll for Razorpay to be available
    const interval = setInterval(() => {
      if (checkRazorpay()) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "polling" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UPI state
  const [upiDetails, setUpiDetails] = useState<UPIDetails>({ vpa: "" });

  // Card state
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  });

  // Net Banking state
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  // Wallet state
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMethod("upi");
      setProcessing(false);
      setStatus("idle");
      setErrorMessage(null);
      setUpiDetails({ vpa: "" });
      setCardDetails({ number: "", expiry: "", cvv: "", name: "" });
      setSelectedBank(null);
      setSelectedWallet(null);
    }
  }, [isOpen]);

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  // Format expiry as MM/YY
  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };


  // Helper to get Razorpay constructor
  const getRazorpay = () => {
    if (typeof window === "undefined") return null;
    return (window as unknown as { Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance }).Razorpay || null;
  };

  // Process UPI payment using Razorpay Checkout with UPI filter
  const processUPIPayment = async () => {
    if (!upiDetails.vpa || !upiDetails.vpa.includes("@")) {
      setErrorMessage("Please enter a valid UPI ID (e.g., name@upi)");
      return;
    }

    const RazorpayClass = getRazorpay();
    if (!RazorpayClass) {
      setErrorMessage("Payment system is loading. Please wait a moment and try again.");
      return;
    }

    setProcessing(true);
    setStatus("processing");
    setErrorMessage(null);

    try {
      const options: RazorpayOptions = {
        key: keyId,
        amount,
        currency,
        name: "Verifai GRC",
        description: description || "Subscription Payment",
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
          vpa: upiDetails.vpa,
        },
        handler: (response: PaymentSuccessData) => {
          setStatus("success");
          setTimeout(() => onSuccess(response), 1000);
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setStatus("idle");
          },
        },
        // Don't filter methods - let Razorpay show all available methods
      };

      const razorpay = new RazorpayClass(options);
      razorpay.on("payment.failed", (response: { error: { description: string } }) => {
        setStatus("error");
        setErrorMessage(response.error.description);
        setProcessing(false);
      });
      razorpay.open();
    } catch (e) {
      setStatus("error");
      setErrorMessage((e as Error).message);
      setProcessing(false);
    }
  };

  // Process UPI QR payment - user scans and pays
  const processUPIQRPayment = async () => {
    const RazorpayClass = getRazorpay();
    if (!RazorpayClass) {
      setErrorMessage("Payment system is loading. Please wait a moment and try again.");
      return;
    }

    setProcessing(true);
    setStatus("processing");
    setErrorMessage(null);

    try {
      const options: RazorpayOptions = {
        key: keyId,
        amount,
        currency,
        name: "Verifai GRC",
        description: description || "Subscription Payment",
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        handler: (response: PaymentSuccessData) => {
          setStatus("success");
          setTimeout(() => onSuccess(response), 1000);
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setStatus("idle");
          },
        },
        // Don't filter methods - let Razorpay show all available methods
      };

      const razorpay = new RazorpayClass(options);
      razorpay.on("payment.failed", (response: { error: { description: string } }) => {
        setStatus("error");
        setErrorMessage(response.error.description);
        setProcessing(false);
      });
      razorpay.open();
    } catch (e) {
      setStatus("error");
      setErrorMessage((e as Error).message);
      setProcessing(false);
    }
  };

  // Process Card payment using Razorpay Checkout (for PCI compliance)
  const processCardPayment = async () => {
    // Validate card details
    const cardNum = cardDetails.number.replace(/\s/g, "");
    if (cardNum.length < 13 || cardNum.length > 19) {
      setErrorMessage("Please enter a valid card number");
      return;
    }

    const [month, year] = cardDetails.expiry.split("/");
    if (!month || !year || parseInt(month) < 1 || parseInt(month) > 12) {
      setErrorMessage("Please enter a valid expiry date (MM/YY)");
      return;
    }

    if (cardDetails.cvv.length < 3) {
      setErrorMessage("Please enter a valid CVV");
      return;
    }

    if (!cardDetails.name.trim()) {
      setErrorMessage("Please enter the cardholder name");
      return;
    }

    const RazorpayClass = getRazorpay();
    if (!RazorpayClass) {
      setErrorMessage("Payment system is loading. Please wait a moment and try again.");
      return;
    }

    setProcessing(true);
    setStatus("processing");
    setErrorMessage(null);

    try {
      // Use Razorpay's native checkout for card payments (PCI compliant)
      const options: RazorpayOptions = {
        key: keyId,
        amount,
        currency,
        name: "Verifai GRC",
        description: description || "Subscription Payment",
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        handler: (response: PaymentSuccessData) => {
          setStatus("success");
          setTimeout(() => onSuccess(response), 1000);
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setStatus("idle");
          },
          confirm_close: true,
        },
        // Don't filter methods - let Razorpay show all available methods
      };

      const razorpay = new RazorpayClass(options);
      razorpay.on("payment.failed", (response: { error: { description: string } }) => {
        setStatus("error");
        setErrorMessage(response.error.description);
        setProcessing(false);
      });
      razorpay.open();
    } catch (e) {
      setStatus("error");
      setErrorMessage((e as Error).message);
      setProcessing(false);
    }
  };

  // Process Net Banking payment
  const processNetBankingPayment = async () => {
    if (!selectedBank) {
      setErrorMessage("Please select a bank");
      return;
    }

    const RazorpayClass = getRazorpay();
    if (!RazorpayClass) {
      setErrorMessage("Payment system is loading. Please wait a moment and try again.");
      return;
    }

    setProcessing(true);
    setStatus("processing");
    setErrorMessage(null);

    try {
      const options: RazorpayOptions = {
        key: keyId,
        amount,
        currency,
        name: "Verifai GRC",
        description: description || "Subscription Payment",
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        handler: (response: PaymentSuccessData) => {
          setStatus("success");
          setTimeout(() => onSuccess(response), 1000);
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setStatus("idle");
          },
        },
        // Don't filter methods - let Razorpay show all available methods
      };

      const razorpay = new RazorpayClass(options);
      razorpay.on("payment.failed", (response: { error: { description: string } }) => {
        setStatus("error");
        setErrorMessage(response.error.description);
        setProcessing(false);
      });
      razorpay.open();
    } catch (e) {
      setStatus("error");
      setErrorMessage((e as Error).message);
      setProcessing(false);
    }
  };

  // Process Wallet payment
  const processWalletPayment = async () => {
    if (!selectedWallet) {
      setErrorMessage("Please select a wallet");
      return;
    }

    const RazorpayClass = getRazorpay();
    if (!RazorpayClass) {
      setErrorMessage("Payment system is loading. Please wait a moment and try again.");
      return;
    }

    setProcessing(true);
    setStatus("processing");
    setErrorMessage(null);

    try {
      const options: RazorpayOptions = {
        key: keyId,
        amount,
        currency,
        name: "Verifai GRC",
        description: description || "Subscription Payment",
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        handler: (response: PaymentSuccessData) => {
          setStatus("success");
          setTimeout(() => onSuccess(response), 1000);
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setStatus("idle");
          },
        },
        // Don't filter methods - let Razorpay show all available methods
      };

      const razorpay = new RazorpayClass(options);
      razorpay.on("payment.failed", (response: { error: { description: string } }) => {
        setStatus("error");
        setErrorMessage(response.error.description);
        setProcessing(false);
      });
      razorpay.open();
    } catch (e) {
      setStatus("error");
      setErrorMessage((e as Error).message);
      setProcessing(false);
    }
  };

  const formatAmount = (amountInPaise: number) => {
    return `₹${(amountInPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !processing && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Complete Payment</DialogTitle>
            {!processing && (
              <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded">
                <X className="h-5 w-5 text-stone-500" />
              </button>
            )}
          </div>
          <div className="text-2xl font-bold text-stone-900 mt-2">{formatAmount(amount)}</div>
          <p className="text-sm text-stone-500">{description || "Subscription Payment"}</p>
        </DialogHeader>

        {/* Success State */}
        {status === "success" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900">Payment Successful!</h3>
            <p className="text-stone-600 mt-1">Your subscription is being activated...</p>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-800 font-medium">Payment Failed</p>
                  <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                setStatus("idle");
                setErrorMessage(null);
                setProcessing(false);
              }}
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Payment Methods */}
        {status !== "success" && status !== "error" && (
          <div className="p-4">
            {/* Method Tabs */}
            <div className="flex border-b mb-4">
              {[
                { id: "upi", label: "UPI", icon: Smartphone },
                { id: "card", label: "Card", icon: CreditCard },
                { id: "netbanking", label: "Net Banking", icon: Building2 },
                { id: "wallet", label: "Wallet", icon: Wallet },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => !processing && setMethod(id as PaymentMethod)}
                  disabled={processing}
                  className={cn(
                    "flex-1 py-3 text-sm font-medium flex flex-col items-center gap-1 border-b-2 transition-colors",
                    method === id
                      ? "border-stone-900 text-stone-900"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>

            {/* UPI Payment */}
            {method === "upi" && (
              <div className="space-y-4">
                {/* UPI Options */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={processUPIQRPayment}
                    disabled={processing}
                    className="p-4 border-2 rounded-lg text-center hover:border-stone-400 transition-colors disabled:opacity-50"
                  >
                    <Smartphone className="h-8 w-8 mx-auto mb-2 text-stone-600" />
                    <div className="font-medium text-sm">Scan QR Code</div>
                    <div className="text-xs text-stone-500 mt-1">GPay, PhonePe, Paytm</div>
                  </button>
                  <button
                    onClick={() => document.getElementById("vpa-input")?.focus()}
                    disabled={processing}
                    className="p-4 border-2 rounded-lg text-center hover:border-stone-400 transition-colors disabled:opacity-50"
                  >
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-stone-600" />
                    <div className="font-medium text-sm">Enter UPI ID</div>
                    <div className="text-xs text-stone-500 mt-1">yourname@upi</div>
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-stone-500">OR ENTER UPI ID</span>
                  </div>
                </div>

                {/* VPA Input */}
                <div>
                  <Label htmlFor="vpa-input">UPI ID</Label>
                  <Input
                    id="vpa-input"
                    placeholder="yourname@upi"
                    value={upiDetails.vpa}
                    onChange={(e) => setUpiDetails({ vpa: e.target.value })}
                    disabled={processing}
                    className="mt-1"
                  />
                </div>

                {errorMessage && (
                  <div className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errorMessage}
                  </div>
                )}

                <Button
                  onClick={processUPIPayment}
                  disabled={processing || !upiDetails.vpa}
                  className="w-full"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {processing ? "Processing..." : `Pay ${formatAmount(amount)}`}
                </Button>
              </div>
            )}

            {/* Card Payment */}
            {method === "card" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={cardDetails.number}
                    onChange={(e) => setCardDetails({ ...cardDetails, number: formatCardNumber(e.target.value) })}
                    maxLength={19}
                    disabled={processing}
                    className="mt-1 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      value={cardDetails.expiry}
                      onChange={(e) => setCardDetails({ ...cardDetails, expiry: formatExpiry(e.target.value) })}
                      maxLength={5}
                      disabled={processing}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      type="password"
                      placeholder="•••"
                      value={cardDetails.cvv}
                      onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      maxLength={4}
                      disabled={processing}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cardName">Cardholder Name</Label>
                  <Input
                    id="cardName"
                    placeholder="Name on card"
                    value={cardDetails.name}
                    onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                    disabled={processing}
                    className="mt-1"
                  />
                </div>

                {errorMessage && (
                  <div className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errorMessage}
                  </div>
                )}

                <Button
                  onClick={processCardPayment}
                  disabled={processing}
                  className="w-full"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {processing ? "Processing..." : `Pay ${formatAmount(amount)}`}
                </Button>

                <p className="text-xs text-stone-500 text-center">
                  Your card details are encrypted and secure
                </p>
              </div>
            )}

            {/* Net Banking */}
            {method === "netbanking" && (
              <div className="space-y-4">
                <Label>Select Bank</Label>
                <div className="grid grid-cols-2 gap-2">
                  {POPULAR_BANKS.map((bank) => (
                    <button
                      key={bank.code}
                      onClick={() => setSelectedBank(bank.code)}
                      disabled={processing}
                      className={cn(
                        "p-3 text-left border rounded-lg transition-colors text-sm",
                        selectedBank === bank.code
                          ? "border-stone-900 bg-stone-50"
                          : "border-stone-200 hover:border-stone-400"
                      )}
                    >
                      {bank.name}
                    </button>
                  ))}
                </div>

                {errorMessage && (
                  <div className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errorMessage}
                  </div>
                )}

                <Button
                  onClick={processNetBankingPayment}
                  disabled={processing || !selectedBank}
                  className="w-full"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {processing ? "Redirecting to bank..." : `Pay ${formatAmount(amount)}`}
                </Button>
              </div>
            )}

            {/* Wallet */}
            {method === "wallet" && (
              <div className="space-y-4">
                <Label>Select Wallet</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WALLETS.map((wallet) => (
                    <button
                      key={wallet.code}
                      onClick={() => setSelectedWallet(wallet.code)}
                      disabled={processing}
                      className={cn(
                        "p-3 text-left border rounded-lg transition-colors text-sm",
                        selectedWallet === wallet.code
                          ? "border-stone-900 bg-stone-50"
                          : "border-stone-200 hover:border-stone-400"
                      )}
                    >
                      {wallet.name}
                    </button>
                  ))}
                </div>

                {errorMessage && (
                  <div className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errorMessage}
                  </div>
                )}

                <Button
                  onClick={processWalletPayment}
                  disabled={processing || !selectedWallet}
                  className="w-full"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {processing ? "Processing..." : `Pay ${formatAmount(amount)}`}
                </Button>
              </div>
            )}

            {/* Security Note */}
            <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-xs text-stone-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>256-bit SSL encrypted • Powered by Razorpay</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
