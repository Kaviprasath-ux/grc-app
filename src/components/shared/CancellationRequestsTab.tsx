"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Check,
  X,
  Building2,
  Calendar,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface CancellationRequest {
  id: string;
  moduleCode: string;
  tier: string;
  billingCycle: string;
  unitPrice: number;
  cycleStart: string;
  cycleEnd: string;
  cancellationRequestedAt: string;
  contractEndDate: string | null;
  planType: string | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    customerCode: string;
  };
  subscriptionId: string;
}

const MODULE_META: Record<string, { label: string; icon: string }> = {
  GRC: { label: "GRC", icon: "🛡️" },
  TPRM: { label: "TPRM", icon: "👥" },
  INTERNAL_AUDIT: { label: "Internal Audit", icon: "🔍" },
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysSince(iso: string): number {
  const days = (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
  return Math.floor(days);
}

export default function CancellationRequestsTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reason, setReason] = useState("");

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/grc/cancellation-requests");
      const json = await res.json();
      if (res.ok && json.data) {
        setRequests(json.data);
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: t("Failed to load cancellation requests"),
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function handleAction(action: "approve" | "reject") {
    if (!selectedRequest || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/grc/cancellation-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `${action} failed`);

      toast({
        title: action === "approve" ? t("Cancellation approved") : t("Request rejected"),
        description: json.message,
      });

      setShowApproveDialog(false);
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setReason("");
      await loadRequests();
    } catch (e) {
      toast({
        variant: "destructive",
        title: t("Action failed"),
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  function openApproveDialog(req: CancellationRequest) {
    setSelectedRequest(req);
    setReason("");
    setShowApproveDialog(true);
  }

  function openRejectDialog(req: CancellationRequest) {
    setSelectedRequest(req);
    setReason("");
    setShowRejectDialog(true);
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      {requests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-stone-900">
                  {requests.length} {t("pending request(s)")}
                </div>
                <div className="text-sm text-stone-600">
                  {t("Customers have requested to cancel their subscriptions.")}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${loading ? "animate-spin" : ""}`} />
                {t("Refresh")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-600">{t("Loading...")}</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-stone-600">
            <Check className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium text-stone-900">{t("No pending requests")}</p>
            <p className="text-sm mt-1">{t("All cancellation requests have been processed.")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Customer")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Module")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Plan")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Price")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Requested On")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Contract Ends")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const meta = MODULE_META[req.moduleCode] || { label: req.moduleCode, icon: "📦" };
                const daysAgo = daysSince(req.cancellationRequestedAt);

                return (
                  <TableRow key={req.id} className="border-b border-slate-100">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-900">{req.customer.name}</div>
                          <div className="text-xs text-slate-500">{req.customer.customerCode}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{meta.icon}</span>
                        <span className="font-medium">{meta.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {req.planType && (
                          <Badge variant="outline" className="text-xs">
                            {req.planType}
                          </Badge>
                        )}
                        <div className="text-xs text-slate-500">
                          {req.tier} · {req.billingCycle}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">₹{formatINR(req.unitPrice)}</span>
                      <span className="text-slate-500 text-xs">
                        /{req.billingCycle === "MONTHLY" ? t("mo") : t("yr")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span className="text-sm">{formatDateTime(req.cancellationRequestedAt)}</span>
                      </div>
                      <div className="text-xs text-amber-600 mt-0.5">
                        {daysAgo === 0
                          ? t("Today")
                          : daysAgo === 1
                          ? t("1 day ago")
                          : `${daysAgo} ${t("days ago")}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      {req.contractEndDate ? (
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3 text-slate-400" />
                          <span>{formatDate(req.contractEndDate)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => openApproveDialog(req)}
                        >
                          <Check className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                          {t("Approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => openRejectDialog(req)}
                        >
                          <X className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                          {t("Reject")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              {t("Approve Cancellation")}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {t("This will immediately cancel the")}{" "}
                  <strong>{MODULE_META[selectedRequest.moduleCode]?.label || selectedRequest.moduleCode}</strong>{" "}
                  {t("module for")}{" "}
                  <strong>{selectedRequest.customer.name}</strong>.
                  {t(" The customer will retain access until their cycle ends on ")}{" "}
                  <strong>{formatDate(selectedRequest.cycleEnd)}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="approve-reason">{t("Reason (optional)")}</Label>
            <Textarea
              id="approve-reason"
              placeholder={t("Add a note for audit records...")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => handleAction("approve")}
              disabled={busy}
              className="bg-green-600 hover:bg-green-700"
            >
              {busy ? t("Processing...") : t("Approve Cancellation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              {t("Reject Cancellation Request")}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {t("This will reject the cancellation request for")}{" "}
                  <strong>{MODULE_META[selectedRequest.moduleCode]?.label || selectedRequest.moduleCode}</strong>{" "}
                  {t("module from")}{" "}
                  <strong>{selectedRequest.customer.name}</strong>.
                  {t(" The subscription will remain active. The customer can submit a new request later.")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">{t("Reason (recommended)")}</Label>
            <Textarea
              id="reject-reason"
              placeholder={t("Explain why the request was rejected...")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => handleAction("reject")}
              disabled={busy}
              variant="destructive"
            >
              {busy ? t("Processing...") : t("Reject Request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
