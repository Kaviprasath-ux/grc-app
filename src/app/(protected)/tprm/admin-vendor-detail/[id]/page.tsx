"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Home, ChevronRight, ArrowLeft, Download, FileText, Trash2, Loader2, Archive, Eye,
} from "lucide-react";

interface DocFile {
  id: string;
  fileName: string;
  filePath: string;
  docType: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  deletedByUser: { id: string; fullName: string } | null;
  deletionReason: string | null;
  createdAt: string;
}

interface VendorDetail {
  id: string;
  vendorCode: string;
  name: string;
  contactPhone: string | null;
  accountManagerName: string | null;
  accountManagerEmail: string | null;
  serviceCategory: string | null;
  serviceDescription: string | null;
  status: string;
  vrr: string | null;
  engagementId: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  accessToNetwork: boolean;
  cloud: boolean;
  accessToData: boolean;
  pii: boolean;
  vendorCertification: string | null;
  businessJustification: string | null;
  onboardingAnswers: string | null;
  customerAccount: { id: string; name: string };
  department: { id: string; name: string } | null;
  vendorDocuments: DocFile[];
  onboardingQuestions?: OnboardingQuestion[];
}

interface OnboardingQuestion {
  id: string;
  title: string;
  isActive: boolean;
  children?: OnboardingQuestion[];
}

const VRR_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Moderate: "bg-yellow-100 text-yellow-800",
  Low: "bg-green-100 text-green-800",
  Nominal: "bg-blue-100 text-blue-800",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function AdminVendorDetailPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Delete dialog
  const [deleteDoc, setDeleteDoc] = useState<DocFile | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchVendor = useCallback(async () => {
    try {
      const res = await fetch(`/api/tprm/admin/vendors/${vendorId}`);
      if (res.ok) setVendor(await res.json());
      else {
        toast({ title: t("Error"), description: t("Vendor not found"), variant: "destructive" });
        router.push("/tprm/vendor-management");
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendor"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [vendorId, toast, t, router]);

  useEffect(() => { fetchVendor(); }, [fetchVendor]);

  const handleDeleteContract = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tprm/admin/vendors/${vendorId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: deleteDoc.id, reason: deleteReason.trim() }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Contract archived successfully") });
        setDeleteDoc(null);
        setDeleteReason("");
        fetchVendor();
      } else {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete contract"), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!vendor) return null;

  const activeDocs = vendor.vendorDocuments.filter((d) => !d.isDeleted);
  const deletedDocs = vendor.vendorDocuments.filter((d) => d.isDeleted);

  const handleDownloadDoc = async (doc: DocFile) => {
    try {
      const res = await fetch(`/api/tprm/admin/vendors/${vendorId}/download?docId=${doc.id}`);
      if (!res.ok) { toast({ title: t("Error"), description: t("Failed to download"), variant: "destructive" }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("Error"), description: t("Failed to download"), variant: "destructive" });
    }
  };

  const handleViewDoc = async (doc: DocFile) => {
    try {
      const res = await fetch(`/api/tprm/admin/vendors/${vendorId}/download?docId=${doc.id}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="cursor-pointer hover:text-primary" onClick={() => router.push("/tprm/vendor-management")}>{t("Vendor Management")}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-primary-700 font-medium">{vendor.name}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/tprm/vendor-management")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-slate-800">{vendor.name}</h1>
        <Badge className={VRR_COLORS[vendor.vrr || ""] || "bg-slate-100"}>{vendor.vrr || "—"}</Badge>
        <Badge variant="outline">{vendor.status}</Badge>
      </div>

      {/* Vendor Info */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-1">
            <div className="space-y-3">
              <InfoRow label={t("Customer")} value={vendor.customerAccount.name} />
              <InfoRow label={t("Code")} value={vendor.vendorCode.split(".")[0]} />
              <InfoRow label={t("Engagement ID")} value={vendor.engagementId || vendor.vendorCode} />
              <InfoRow label={t("Status")} value={vendor.status} />
              <InfoRow label={t("Account Manager")} value={vendor.accountManagerName} />
              <InfoRow label={t("AM Email")} value={vendor.accountManagerEmail} />
              <InfoRow label={t("Contact")} value={vendor.contactPhone} />
              <InfoRow label={t("Department")} value={vendor.department?.name} />
              <InfoRow label={t("Service Category")} value={vendor.serviceCategory} />
            </div>
            <div className="space-y-3">
              <InfoRow label={t("Contract Start")} value={formatDate(vendor.contractStartDate)} />
              <InfoRow label={t("Contract End")} value={formatDate(vendor.contractEndDate)} />
              <InfoRow label={t("Certification")} value={vendor.vendorCertification} />
              <OnboardingAnswerRows vendor={vendor} t={t} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Contracts and Documents")}</CardTitle>
        </CardHeader>
        <CardContent>
          {activeDocs.length > 0 ? (
            <div className="space-y-2">
              {activeDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md bg-slate-50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium">{doc.fileName}</span>
                    <Badge variant="outline" className="text-xs">{doc.docType}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleViewDoc(doc)} title={t("View")}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleDownloadDoc(doc)} title={t("Download")}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-500 hover:text-red-700"
                      onClick={() => { setDeleteDoc(doc); setDeleteReason(""); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                      {t("Delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("No active documents")}</p>
          )}
        </CardContent>
      </Card>

      {/* Deleted/Archived Documents */}
      {deletedDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="h-4 w-4" />
              {t("Archived Documents")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deletedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md bg-red-50/50 border-red-100">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-400" />
                    <div>
                      <span className="text-sm font-medium text-slate-600 line-through">{doc.fileName}</span>
                      <div className="text-xs text-slate-400">
                        {t("Deleted by")} {doc.deletedByUser?.fullName || "Unknown"} {t("on")} {formatDate(doc.deletedAt)}
                        {doc.deletionReason && <> — {doc.deletionReason}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleViewDoc(doc)} title={t("View")}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleDownloadDoc(doc)} title={t("Download")}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Badge variant="outline" className="text-xs border-red-200 text-red-600">{t("Archived")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Contract Dialog */}
      <Dialog open={!!deleteDoc} onOpenChange={(open) => { if (!open) setDeleteDoc(null); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t("Delete Contract")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">
              {t("File")}: <span className="font-medium">{deleteDoc?.fileName}</span>
            </p>
            <p className="text-sm text-amber-600">
              {t("This will archive the document. It will no longer be visible to users but remains in the system.")}
            </p>
            <div>
              <Label>{t("Reason")}</Label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder={t("Reason for deletion")}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteContract} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm text-slate-400 min-w-[160px] flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800">: {value || "—"}</span>
    </div>
  );
}

// Renders the vendor's onboarding answers (Access to Network, Cloud, PII,
// any tenant-custom questions, etc.) by joining the tenant's
// TPRMOnboardingQuestion catalogue with vendor.onboardingAnswers (JSON
// map of questionId → "Yes"/"No"/text). Falls back to the four legacy
// boolean columns only if the vendor has no onboarding answers — those
// columns are written by the legacy CustomerAdmin form path and stay
// at `false` for vendors created through BO/RM onboarding.
function OnboardingAnswerRows({ vendor, t }: { vendor: VendorDetail; t: (s: string) => string }) {
  let answers: Record<string, string> = {};
  try {
    if (vendor.onboardingAnswers) answers = JSON.parse(vendor.onboardingAnswers);
  } catch { /* ignore */ }

  const rows: { id: string; label: string; value: string; indent: boolean }[] = [];
  for (const pq of vendor.onboardingQuestions || []) {
    const pAns = answers[pq.id];
    if (pAns) rows.push({ id: pq.id, label: pq.title, value: pAns, indent: false });
    for (const child of pq.children || []) {
      const cAns = answers[child.id];
      if (cAns) rows.push({ id: child.id, label: child.title, value: cAns, indent: true });
    }
  }

  if (rows.length === 0) {
    return (
      <>
        <InfoRow label={t("Access to Network")} value={vendor.accessToNetwork ? "Yes" : "No"} />
        <InfoRow label={t("Cloud")} value={vendor.cloud ? "Yes" : "No"} />
        <InfoRow label={t("Access to Data")} value={vendor.accessToData ? "Yes" : "No"} />
        <InfoRow label={t("PII")} value={vendor.pii ? "Yes" : "No"} />
      </>
    );
  }

  return (
    <>
      {rows.map((r) => (
        <div key={r.id} className={r.indent ? "ltr:pl-4 rtl:pr-4" : ""}>
          <InfoRow label={r.label} value={r.value} />
        </div>
      ))}
    </>
  );
}
