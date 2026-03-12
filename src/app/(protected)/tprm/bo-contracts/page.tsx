"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Home, ChevronRight, Loader2, Search, Eye, LogOut, RefreshCw, Upload, Download, FileText } from "lucide-react";
import { useTranslatedData } from "@/hooks/useTranslatedData";

// ── Types ──────────────────────────────────────────────
interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
  serviceCategory: string | null;
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  accountManagerName: string | null;
  assessments?: { id: string; status: string }[];
  contractDocumentName?: string | null;
  contractDocumentPath?: string | null;
}

// ── Helpers ──────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function isExpiringSoon(dateStr: string | null, daysAhead = 90): boolean {
  if (!dateStr) return false;
  const end = new Date(dateStr);
  const now = new Date();
  const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= daysAhead;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// Assessment statuses where "Renew Contract" button is visible
const RENEW_STATUSES = [
  "Approved", "Initiated", "In_Progress", "In Progress", "In-Progress",
  "Awaiting_Response", "Awaiting Response", "Submitted",
  "Completed", "Reviewed",
  "In_Progress_approver", "In-Progress(approver)",
  "Under Review", "Draft", "Returned",
];

// Assessment statuses where "Offboard Request Submitted" text is shown
const OFFBOARD_STATUSES = [
  "Offboard_In_Progress", "Offboard_Completed", "Offboard_Awaiting_Response",
  "Offboard_Awaiting_Respose",
  "Offboard_Approve_Assessor", "Offboard_Approve_RM", "Offboard_Approve_BO",
  "Offboarding", "Offboarded",
];

function getLatestAssessmentStatus(vendor: Vendor): string | null {
  return vendor.assessments?.[0]?.status || null;
}

function isOffboardStatus(status: string | null): boolean {
  if (!status) return false;
  return OFFBOARD_STATUSES.includes(status);
}

function isRenewStatus(status: string | null): boolean {
  if (!status) return true;
  return RENEW_STATUSES.includes(status);
}

// ── Main Component ──────────────────────────────────────
export default function BOContractsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"expiring" | "all">("expiring");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewVendor, setRenewVendor] = useState<Vendor | null>(null);
  const [renewStart, setRenewStart] = useState("");
  const [renewEnd, setRenewEnd] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) {
        const json = await res.json();
        setVendors(json.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendors"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const { data: translatedVendors } = useTranslatedData(vendors, { modelName: 'TPRMVendor' });

  const handleStartOffboarding = useCallback(async (vendor: Vendor) => {
    setActionLoading(vendor.id);
    try {
      const res = await fetch(`/api/tprm/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Offboarding" }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Offboarding initiated for") + " " + vendor.name });
        fetchVendors();
      } else {
        toast({ title: t("Error"), description: t("Failed to start offboarding"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to start offboarding"), variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [fetchVendors, toast, t]);

  const handleRenewContract = useCallback(async () => {
    if (!renewVendor || !renewStart || !renewEnd) return;
    setActionLoading(renewVendor.id);
    try {
      const res = await fetch(`/api/tprm/vendors/${renewVendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractStartDate: renewStart,
          contractEndDate: renewEnd,
          status: "Active",
        }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Contract renewed for") + " " + renewVendor.name });
        setRenewDialogOpen(false);
        setRenewVendor(null);
        setRenewStart("");
        setRenewEnd("");
        fetchVendors();
      } else {
        toast({ title: t("Error"), description: t("Failed to renew contract"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to renew contract"), variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [renewVendor, renewStart, renewEnd, fetchVendors, toast, t]);

  const handleUploadContract = useCallback(async (vendorId: string, file: File) => {
    setUploadingId(vendorId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tprm/vendors/${vendorId}/contract`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Contract document uploaded") });
        fetchVendors();
      } else {
        toast({ title: t("Error"), description: t("Failed to upload document"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to upload document"), variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  }, [fetchVendors, toast, t]);

  const handleDownloadContract = useCallback(async (vendor: Vendor) => {
    try {
      const res = await fetch(`/api/tprm/vendors/${vendor.id}/contract`);
      if (!res.ok) {
        toast({ title: t("Error"), description: t("Failed to download document"), variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = vendor.contractDocumentName || "contract";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("Error"), description: t("Failed to download document"), variant: "destructive" });
    }
  }, [toast, t]);

  const filtered = useMemo(() => {
    let data = translatedVendors;

    if (tab === "expiring") {
      data = data.filter((v) => isExpiringSoon(v.contractEndDate) || isExpired(v.contractEndDate));
    }

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (v) =>
          v.vendorCode.toLowerCase().includes(s) ||
          v.name.toLowerCase().includes(s)
      );
    }

    return data;
  }, [translatedVendors, tab, search]);

  const tabs = [
    { key: "expiring" as const, label: t("Expiring Contracts") },
    { key: "all" as const, label: t("All Vendor Contracts") },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Contracts")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Contracts")}</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t_) => (
          <button
            key={t_.key}
            onClick={() => { setTab(t_.key); setSearch(""); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t_.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t_.label}
          </button>
        ))}
      </div>

      {/* Search & Table */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Filter") + "..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ltr:pl-9 rtl:pr-9"
              />
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Vendor Code")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Vendor Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Contract Start")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Expiring On")}</TableHead>
                  {tab === "expiring" ? (
                    <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Action")}</TableHead>
                  ) : (
                    <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Contract")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("No contracts found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-sm">{v.vendorCode}</TableCell>
                      <TableCell>{v.name}</TableCell>
                      <TableCell>{formatDate(v.contractStartDate)}</TableCell>
                      <TableCell>
                        <span className={isExpired(v.contractEndDate) ? "text-red-600 font-medium" : isExpiringSoon(v.contractEndDate) ? "text-amber-600 font-medium" : ""}>
                          {formatDate(v.contractEndDate)}
                        </span>
                      </TableCell>
                      {tab === "expiring" ? (
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const aStatus = getLatestAssessmentStatus(v);
                              if (isOffboardStatus(aStatus) || v.status === "Offboarding" || v.status === "Offboarded") {
                                return (
                                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs whitespace-nowrap">
                                    {t("Offboard Request Submitted")}
                                  </Badge>
                                );
                              }
                              return (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    disabled={actionLoading === v.id}
                                    onClick={() => handleStartOffboarding(v)}
                                  >
                                    <LogOut className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                                    {t("Start Offboarding")}
                                  </Button>
                                  {isRenewStatus(aStatus) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7 px-2 border-green-300 text-green-700 hover:bg-green-50"
                                      disabled={actionLoading === v.id}
                                      onClick={() => {
                                        setRenewVendor(v);
                                        setRenewStart("");
                                        setRenewEnd("");
                                        setRenewDialogOpen(true);
                                      }}
                                    >
                                      <RefreshCw className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                                      {t("Renew Contract")}
                                    </Button>
                                  )}
                                </>
                              );
                            })()}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => { setSelectedVendor(v); setDialogOpen(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {v.contractDocumentName ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 px-2"
                                  onClick={() => handleDownloadContract(v)}
                                >
                                  <Download className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                                  <FileText className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                                  <span className="max-w-[150px] truncate">{v.contractDocumentName}</span>
                                </Button>
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadContract(v.id, file);
                                      e.target.value = "";
                                    }}
                                  />
                                  <span className="inline-flex items-center justify-center h-7 px-2 rounded-md border text-xs text-muted-foreground hover:bg-muted transition-colors">
                                    <Upload className="h-3.5 w-3.5" />
                                  </span>
                                </label>
                              </>
                            ) : (
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadContract(v.id, file);
                                    e.target.value = "";
                                  }}
                                />
                                <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md border text-xs text-muted-foreground hover:bg-muted transition-colors">
                                  {uploadingId === v.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                  {t("Upload")}
                                </span>
                              </label>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Contract Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Contract Details")} - {selectedVendor?.name}</DialogTitle>
          </DialogHeader>
          {selectedVendor && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor Code")}</label>
                <p className="font-mono">{selectedVendor.vendorCode}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor Name")}</label>
                <p>{selectedVendor.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Service Category")}</label>
                <p>{selectedVendor.serviceCategory || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Status")}</label>
                <p>{t(selectedVendor.status)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Contract Start")}</label>
                <p>{formatDate(selectedVendor.contractStartDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Contract End")}</label>
                <p className={isExpired(selectedVendor.contractEndDate) ? "text-red-600 font-medium" : ""}>
                  {formatDate(selectedVendor.contractEndDate)}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Contact Email")}</label>
                <p>{selectedVendor.contactEmail || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Account Manager")}</label>
                <p>{selectedVendor.accountManagerName || "-"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Renew Contract Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Renew Contract")} - {renewVendor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">{t("New Contract Start Date")}</label>
              <Input
                type="date"
                value={renewStart}
                onChange={(e) => setRenewStart(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("New Contract End Date")}</label>
              <Input
                type="date"
                value={renewEnd}
                onChange={(e) => setRenewEnd(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>{t("Cancel")}</Button>
              <Button
                onClick={handleRenewContract}
                disabled={!renewStart || !renewEnd || actionLoading !== null}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" /> : <RefreshCw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />}
                {t("Renew Contract")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
