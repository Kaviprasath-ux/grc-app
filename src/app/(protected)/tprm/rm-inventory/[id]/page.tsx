"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home, ChevronRight, ArrowLeft, Download, Loader2, Upload, FileText, Trash2,
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
  assessments: Assessment[];
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
  }, [fetchVendor, fetchDocuments]);

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
              <InfoRow label={t("Name")} value={vendor.name} />
              <InfoRow label={t("Account Manager Name")} value={vendor.accountManagerName} />
              <InfoRow label={t("Account Manager Email")} value={vendor.accountManagerEmail} />
              <InfoRow label={t("Contact Number")} value={vendor.contactPhone} />
              <InfoRow label={t("Department")} value={vendor.department?.name} />
              <InfoRow label={t("Service Category")} value={vendor.serviceCategory} />
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
          if (doc.id !== "contract") handleDeleteDocument(doc.id);
        }}
        uploading={uploadingDoc}
        t={t}
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
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm text-slate-400 min-w-[180px] flex-shrink-0">{label} :</span>
      <span className="text-sm font-medium text-slate-800">{value || "—"}</span>
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
  title, docs, onUpload, onDownload, onDelete, uploading, t,
}: {
  title: string;
  docs: DocFile[];
  onUpload: (file: File) => void;
  onDownload: (doc: DocFile) => void;
  onDelete: (doc: DocFile) => void;
  uploading: boolean;
  t: (s: string) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
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
                  {doc.id !== "contract" && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => onDelete(doc)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
