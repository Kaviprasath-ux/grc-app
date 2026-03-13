"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslatedRecord } from "@/hooks/useTranslatedData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Home, ChevronRight, ArrowLeft, Download, Loader2, Upload, FileText, Trash2, Plus, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────
interface Assessment {
  id: string;
  assessmentCode: string;
  assessmentType: string;
  status: string;
  createdAt: string;
  initiatedBy?: { id: string; fullName: string } | null;
  assessor?: { id: string; fullName: string } | null;
}

interface VendorDetail {
  id: string;
  vendorCode: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  accountManagerName: string | null;
  accountManagerEmail: string | null;
  serviceCategory: string | null;
  serviceDescription: string | null;
  status: string;
  vrr: string | null;
  engagementId: string | null;
  department: { id: string; name: string } | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  accessToNetwork: boolean;
  cloud: boolean;
  accessToData: boolean;
  pii: boolean;
  businessJustification: string | null;
  vendorCertification: string | null;
  onboardedDate: string | null;
  offboardedDate: string | null;
  contractDocumentName: string | null;
  contractDocumentPath: string | null;
  onboardingAnswers: string | null;
  assessments: Assessment[];
}

interface OnboardingQuestion {
  id: string;
  title: string;
  responseType: string;
  questionType: string;
  isActive: boolean;
  children: OnboardingQuestion[];
}

interface DocFile {
  id: string;
  name: string;
  path: string;
  type: string;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────
const VRR_COLORS: Record<string, string> = {
  Nominal: "#22c55e", Low: "#84cc16", Moderate: "#eab308", High: "#f97316", Critical: "#ef4444",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

// ── Main Component ──────────────────────────────────────
export default function VendorDetailPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>([]);

  const fetchOnboardingQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/tprm/configurations/onboarding-questions");
      if (res.ok) {
        const questions: OnboardingQuestion[] = await res.json();
        setOnboardingQuestions(questions.filter((q) => q.isActive && q.questionType === "Parent"));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchVendor = useCallback(async () => {
    try {
      const res = await fetch(`/api/tprm/vendors/${vendorId}`);
      if (res.ok) {
        const data = await res.json();
        setVendor(data);
      } else {
        toast({ title: t("Error"), description: t("Vendor not found"), variant: "destructive" });
        router.push("/tprm/rm-inventory");
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendor"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [vendorId, toast, t, router]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tprm/vendors/${vendorId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.data || []);
      }
    } catch {
      // Documents endpoint may not exist yet, ignore
    }
  }, [vendorId]);

  useEffect(() => {
    fetchVendor();
    fetchDocuments();
    fetchOnboardingQuestions();
  }, [fetchVendor, fetchDocuments, fetchOnboardingQuestions]);

  const handleDownloadContract = useCallback(async () => {
    if (!vendor) return;
    try {
      const res = await fetch(`/api/tprm/vendors/${vendor.id}/contract`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = vendor.contractDocumentName || "contract";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("Error"), description: t("Failed to download"), variant: "destructive" });
    }
  }, [vendor, toast, t]);

  const handleUploadDocument = useCallback(async (file: File, docType: string) => {
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      const res = await fetch(`/api/tprm/vendors/${vendorId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Document uploaded") });
        fetchDocuments();
        if (docType === "contract") fetchVendor();
      } else {
        toast({ title: t("Error"), description: t("Failed to upload"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to upload"), variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  }, [vendorId, fetchDocuments, fetchVendor, toast, t]);

  const handleDeleteDocument = useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/tprm/vendors/${vendorId}/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Document deleted") });
        fetchDocuments();
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  }, [vendorId, fetchDocuments, toast, t]);

  // ── Add Contract dialog state ─────────────────────
  const [showAddContractDialog, setShowAddContractDialog] = useState(false);
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [savingContract, setSavingContract] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [contractErrors, setContractErrors] = useState<Record<string, string>>({});

  const openAddContractDialog = () => {
    setContractStartDate("");
    setContractEndDate("");
    setContractFile(null);
    setContractErrors({});
    setShowAddContractDialog(true);
  };

  const handleContractFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setContractFile(file);
      setContractErrors((prev) => { const { file: _, ...rest } = prev; return rest; });
    }
  }, []);

  const handleSaveContract = useCallback(async () => {
    if (!vendor) return;
    const errors: Record<string, string> = {};
    if (!contractStartDate) errors.startDate = t("Contract start date is required");
    if (!contractEndDate) errors.endDate = t("Contract end date is required");
    if (!contractFile) errors.file = t("Contract file is required");
    if (contractStartDate && contractEndDate && contractStartDate > contractEndDate) {
      errors.endDate = t("End date must be after start date");
    }
    setContractErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const fileToUpload = contractFile!;
    setSavingContract(true);
    try {
      // 1. Upload contract file
      const formData = new FormData();
      formData.append("file", fileToUpload);
      const uploadRes = await fetch(`/api/tprm/vendors/${vendor.id}/contract`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        toast({ title: t("Error"), description: t("Failed to upload contract"), variant: "destructive" });
        return;
      }

      // 2. Update vendor: contract dates + status → Active
      const patchRes = await fetch(`/api/tprm/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractStartDate,
          contractEndDate,
          status: "Active",
        }),
      });
      if (patchRes.ok) {
        toast({ title: t("Success"), description: t("Contract saved successfully") });
        setShowAddContractDialog(false);
        fetchVendor();
      } else {
        toast({ title: t("Error"), description: t("Failed to update vendor"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to save contract"), variant: "destructive" });
    } finally {
      setSavingContract(false);
    }
  }, [vendor, contractFile, contractStartDate, contractEndDate, fetchVendor, toast, t]);

  const handleDeleteContract = useCallback(async () => {
    if (!vendor) return;
    try {
      const res = await fetch(`/api/tprm/vendors/${vendor.id}/contract`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Contract deleted") });
        fetchVendor();
      } else {
        toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  }, [vendor, fetchVendor, toast, t]);

  // Dynamic data translation for vendor
  const { data: translatedVendor } = useTranslatedRecord(vendor, { modelName: 'TPRMVendor' });

  const handleExport = useCallback(() => {
    if (!vendor) return;
    const lines = [
      `Vendor Details - ${vendor.name}`,
      ``,
      `Code,${vendor.vendorCode}`,
      `Status,${vendor.status}`,
      `SubCode,${vendor.engagementId || vendor.vendorCode}`,
      `Name,${vendor.name}`,
      `Account Manager,${vendor.accountManagerName || ""}`,
      `Account Manager Email,${vendor.accountManagerEmail || ""}`,
      `Contact Number,${vendor.contactPhone || ""}`,
      `Service Category,${vendor.serviceCategory || ""}`,
      `Department,${vendor.department?.name || ""}`,
      `Contract Start,${formatDate(vendor.contractStartDate)}`,
      `Contract End,${formatDate(vendor.contractEndDate)}`,
      `VRR,${vendor.vrr || ""}`,
      ``,
      `Risk Profile`,
      `Access to Network,${vendor.accessToNetwork ? "Yes" : "No"}`,
      `Cloud,${vendor.cloud ? "Yes" : "No"}`,
      `Access to Data,${vendor.accessToData ? "Yes" : "No"}`,
      `PII,${vendor.pii ? "Yes" : "No"}`,
      `Vendor Certification,${vendor.vendorCertification || ""}`,
      `Business Justification,${vendor.businessJustification || ""}`,
    ];
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor-${vendor.vendorCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [vendor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vendor) return null;

  const legalDocs = documents.filter(d => d.type === "legal");
  const reportDocs = documents.filter(d => d.type === "report");
  const generalDocs = documents.filter(d => d.type === "document");

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <button onClick={() => router.push("/tprm/rm-inventory")} className="text-slate-500 hover:text-primary">
          {t("Inventory")}
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Vendor Details")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="default" size="sm" onClick={() => router.push("/tprm/rm-inventory")}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Back")}
          </Button>
          <h1 className="text-2xl font-bold">{t("Vendor Details")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">{t("Vendor Risk Rating")}</span>
          {vendor.vrr ? (
            <Badge className="text-white text-xs" style={{ backgroundColor: VRR_COLORS[vendor.vrr] || "#94a3b8" }}>
              {t(vendor.vrr)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t("Not Rated")}</Badge>
          )}
          <Button variant="default" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Export")}
          </Button>
        </div>
      </div>

      {/* Service Description */}
      {vendor.serviceDescription && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">{t("Service Description")}</h3>
            <p className="text-sm text-slate-600">{vendor.serviceDescription}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Info + Risk Profile */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-1">
            {/* Left: Vendor Info */}
            <div className="space-y-4">
              <InfoRow label={t("Code")} value={vendor.vendorCode.split(".")[0]} />
              <InfoRow label={t("Status")} value={vendor.status} />
              <InfoRow label={t("SubCode")} value={vendor.engagementId || vendor.vendorCode} />
              <InfoRow label={t("Name")} value={translatedVendor?.name || vendor.name} />
              <InfoRow label={t("Account Manager Name")} value={vendor.accountManagerName} />
              <InfoRow label={t("Account Manager Email")} value={vendor.accountManagerEmail} />
              <InfoRow label={t("Contact Number")} value={vendor.contactPhone} />
              <InfoRow label={t("Department")} value={vendor.department?.name} />
              <InfoRow label={t("Service Category")} value={translatedVendor?.serviceCategory || vendor.serviceCategory} />
              <InfoRow label={t("Contract Start Date")} value={formatDate(vendor.contractStartDate)} />
              <InfoRow label={t("Contract End Date")} value={formatDate(vendor.contractEndDate)} />
              <InfoRow label={t("Vendor Certification")} value={vendor.vendorCertification} />
              {vendor.businessJustification && (
                <InfoRow label={t("Business Justification")} value={vendor.businessJustification} />
              )}
            </div>

            {/* Right: Vendor Risk Profile */}
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-4">{t("Vendor Risk Profile")}</h3>
              <div className="space-y-4">
                <ProfileRow label={t("Access to Network")} value={vendor.accessToNetwork} />
                <ProfileRow label={t("Cloud")} value={vendor.cloud} />
                <ProfileRow label={t("Access to Data")} value={vendor.accessToData} />
                <ProfileRow label={t("PII")} value={vendor.pii} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Answers */}
      {vendor.onboardingAnswers && onboardingQuestions.length > 0 && (() => {
        let answers: Record<string, string> = {};
        try { answers = JSON.parse(vendor.onboardingAnswers!); } catch { /* ignore */ }
        if (Object.keys(answers).length === 0) return null;
        const renderQuestion = (q: OnboardingQuestion, indent = false) => {
          const answer = answers[q.id];
          if (!answer) return null;
          return (
            <InfoRow key={q.id} label={indent ? `└ ${q.title}` : q.title} value={answer} />
          );
        };
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("Onboarding Questions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {onboardingQuestions.map((pq) => (
                <div key={pq.id}>
                  {renderQuestion(pq)}
                  {pq.children?.filter((c) => c.isActive).map((child) => renderQuestion(child, true))}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* Legal Contract */}
      <DocumentSection
        title={t("Legal Contract")}
        docs={vendor.contractDocumentName ? [{
          id: "contract",
          name: vendor.contractDocumentName,
          path: "",
          type: "contract",
          createdAt: "",
        }] : legalDocs}
        onUpload={(file) => handleUploadDocument(file, vendor.contractDocumentName ? "legal" : "contract")}
        onDownload={(doc) => {
          if (doc.id === "contract") {
            handleDownloadContract();
          } else {
            window.open(`/api/tprm/vendors/${vendorId}/documents/${doc.id}/download`, "_blank");
          }
        }}
        onDelete={(doc) => {
          if (doc.id === "contract") {
            handleDeleteContract();
          } else {
            handleDeleteDocument(doc.id);
          }
        }}
        uploading={uploadingDoc}
        t={t}
        extraAction={vendor.status === "Inactive" ? (
          <Button size="sm" onClick={openAddContractDialog}>
            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Add Contract")}
          </Button>
        ) : undefined}
      />

      {/* Report Library */}
      <DocumentSection
        title={t("Report Library")}
        docs={reportDocs}
        onUpload={(file) => handleUploadDocument(file, "report")}
        onDownload={(doc) => window.open(`/api/tprm/vendors/${vendorId}/documents/${doc.id}/download`, "_blank")}
        onDelete={(doc) => handleDeleteDocument(doc.id)}
        uploading={uploadingDoc}
        t={t}
      />

      {/* Document Library */}
      <DocumentSection
        title={t("Document Library")}
        docs={generalDocs}
        onUpload={(file) => handleUploadDocument(file, "document")}
        onDownload={(doc) => window.open(`/api/tprm/vendors/${vendorId}/documents/${doc.id}/download`, "_blank")}
        onDelete={(doc) => handleDeleteDocument(doc.id)}
        uploading={uploadingDoc}
        t={t}
      />

      {/* Add Contract Dialog */}
      <Dialog open={showAddContractDialog} onOpenChange={setShowAddContractDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Contract")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Contract Start Date */}
            <div className="space-y-1.5">
              <Label>{t("Contract Start Date")} <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={contractStartDate}
                onChange={(e) => { setContractStartDate(e.target.value); setContractErrors((prev) => { const { startDate, ...rest } = prev; return rest; }); }}
                className={contractErrors.startDate ? "border-red-500" : ""}
              />
              {contractErrors.startDate && <p className="text-xs text-red-500">{contractErrors.startDate}</p>}
            </div>

            {/* Contract End Date */}
            <div className="space-y-1.5">
              <Label>{t("Contract End Date")} <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={contractEndDate}
                onChange={(e) => { setContractEndDate(e.target.value); setContractErrors((prev) => { const { endDate, ...rest } = prev; return rest; }); }}
                className={contractErrors.endDate ? "border-red-500" : ""}
              />
              {contractErrors.endDate && <p className="text-xs text-red-500">{contractErrors.endDate}</p>}
            </div>

            {/* File Drop Zone */}
            {!contractFile ? (
              <div>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  contractErrors.file ? "border-red-400" : dragging ? "border-primary bg-primary/5" : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleContractFileDrop}
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-1">{t("Drag and drop your contract file here")}</p>
                <p className="text-xs text-slate-400 mb-3">{t("or")}</p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setContractFile(file);
                        setContractErrors((prev) => { const { file: _, ...rest } = prev; return rest; });
                      }
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    <Upload className="h-4 w-4" />
                    {t("Browse Files")}
                  </span>
                </label>
              </div>
              {contractErrors.file && <p className="text-xs text-red-500 mt-1.5">{contractErrors.file}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-md bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <span className="text-sm truncate">{contractFile.name}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    ({(contractFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      const url = URL.createObjectURL(contractFile);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = contractFile.name;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-500 hover:text-red-700"
                    onClick={() => setContractFile(null)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContractDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleSaveContract} disabled={savingContract}>
              {savingContract && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm text-slate-400 min-w-[180px] flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800">: {value || "—"}</span>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm text-slate-400 min-w-[180px] flex-shrink-0">{label} :</span>
      <span className={`text-sm font-medium ${value ? "text-green-600" : "text-slate-500"}`}>
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

function DocumentSection({
  title, docs, onUpload, onDownload, onDelete, uploading, t, extraAction,
}: {
  title: string;
  docs: DocFile[];
  onUpload: (file: File) => void;
  onDownload: (doc: DocFile) => void;
  onDelete: (doc: DocFile) => void;
  uploading: boolean;
  t: (s: string) => string;
  extraAction?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {extraAction}
      </CardHeader>
      <CardContent className="pt-0">
        {docs.length > 0 ? (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md bg-slate-50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm">{doc.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onDownload(doc)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => onDelete(doc)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-center pt-3">
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t("Upload Document")}
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
