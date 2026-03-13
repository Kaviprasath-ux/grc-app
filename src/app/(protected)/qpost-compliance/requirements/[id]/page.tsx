"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Edit2,
  Link2,
  Unlink,
  FileText,
  Shield,
  AlertTriangle,
  Loader2,
  Home,
  ChevronRight,
  Upload,
  Download,
} from "lucide-react";
import Link from "next/link";
import { triggerTranslation, useTranslatedRecord, useTranslatedData } from "@/hooks/useTranslatedData";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Department {
  id: string;
  name: string;
}

interface Assignee {
  id: string;
  fullName: string;
}

interface EvidenceItem {
  id: string;
  evidenceCode: string;
  name: string;
  status: string;
  department?: Department | null;
  assignee?: Assignee | null;
}

interface PolicyItem {
  id: string;
  code: string;
  name: string;
  documentType?: string;
  status: string;
  department?: Department | null;
  assignee?: Assignee | null;
}

interface ExceptionItem {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  expiryDate?: string;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requirementType: string;
  chapterType: string;
  sortOrder: number;
  level: number;
  applicability: string | null;
  justification: string | null;
  implementationStatus: string | null;
  controlCompliance: string | null;
  framework?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  parent?: { id: string; code: string; name: string } | null;
  children?: Array<{ id: string; code: string; name: string }>;
  evidences: Array<{ evidence: EvidenceItem }>;
  policies: Array<{ policy: PolicyItem }>;
  exceptions: ExceptionItem[];
  complianceExceptions: ExceptionItem[];
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "secondary";
  const s = status.toLowerCase();
  if (["implemented", "compliant", "approved", "validated", "applicable"].includes(s)) return "default";
  if (["not_implemented", "non_compliant", "rejected", "not_applicable"].includes(s)) return "destructive";
  return "secondary";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QPostRequirementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canEdit } = usePermissions("qpost-compliance.controls");
  const id = params.id as string;

  // Data state
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("evidences");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    code: "",
    name: "",
    description: "",
    requirementType: "",
    chapterType: "",
    applicability: "",
    justification: "",
    implementationStatus: "",
    controlCompliance: "",
  });
  const [saving, setSaving] = useState(false);

  // Link evidence dialog
  const [linkEvidenceOpen, setLinkEvidenceOpen] = useState(false);
  const [availableEvidences, setAvailableEvidences] = useState<EvidenceItem[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [linkingEvidence, setLinkingEvidence] = useState(false);

  // Link policy dialog
  const [linkPolicyOpen, setLinkPolicyOpen] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState<PolicyItem[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [linkingPolicy, setLinkingPolicy] = useState(false);

  // Unlink confirmation
  const [unlinkDialog, setUnlinkDialog] = useState<{ type: "evidence" | "policy"; id: string; name: string } | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Import evidences dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Import policies dialog
  const [importPolicyOpen, setImportPolicyOpen] = useState(false);
  const [importPolicyFile, setImportPolicyFile] = useState<File | null>(null);
  const [importingPolicy, setImportingPolicy] = useState(false);
  const [importPolicyErrors, setImportPolicyErrors] = useState<string[]>([]);
  const [downloadingPolicyTemplate, setDownloadingPolicyTemplate] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch requirement
  // ---------------------------------------------------------------------------

  const fetchRequirement = useCallback(async () => {
    try {
      const res = await fetch(`/api/qpost-compliance/requirements/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setRequirement(data);
    } catch {
      setRequirement(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequirement();
  }, [fetchRequirement]);

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  const openEditDialog = () => {
    if (!requirement) return;
    setEditForm({
      code: requirement.code || "",
      name: requirement.name || "",
      description: requirement.description || "",
      requirementType: requirement.requirementType || "",
      chapterType: requirement.chapterType || "",
      applicability: requirement.applicability || "",
      justification: requirement.justification || "",
      implementationStatus: requirement.implementationStatus || "",
      controlCompliance: requirement.controlCompliance || "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/qpost-compliance/requirements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      toast({ title: t("Requirement updated successfully") });
      triggerTranslation("QPostRequirement", updated.id, {
        name: updated.name,
        description: updated.description,
      });
      setEditOpen(false);
      fetchRequirement();
    } catch {
      toast({ title: t("Failed to update requirement"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Evidence link / unlink
  // ---------------------------------------------------------------------------

  const openLinkEvidence = async () => {
    setSelectedEvidenceId("");
    setLinkEvidenceOpen(true);
    try {
      const res = await fetch("/api/qpost-compliance/evidences?limit=200");
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.data || data.items || data.evidences || [];
        // Filter out already-linked evidences
        const linkedIds = new Set(requirement?.evidences.map((e) => e.evidence.id) || []);
        setAvailableEvidences(items.filter((e: EvidenceItem) => !linkedIds.has(e.id)));
      }
    } catch {
      setAvailableEvidences([]);
    }
  };

  const handleLinkEvidence = async () => {
    if (!selectedEvidenceId) return;
    setLinkingEvidence(true);
    try {
      const res = await fetch(`/api/qpost-compliance/requirements/${id}/evidences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId: selectedEvidenceId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast({ title: t("Evidence linked successfully") });
      setLinkEvidenceOpen(false);
      fetchRequirement();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to link evidence";
      toast({ title: t(msg), variant: "destructive" });
    } finally {
      setLinkingEvidence(false);
    }
  };

  const openLinkPolicy = async () => {
    setSelectedPolicyId("");
    setLinkPolicyOpen(true);
    try {
      const res = await fetch("/api/qpost-compliance/policies?limit=200");
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.data || data.items || data.policies || [];
        const linkedIds = new Set(requirement?.policies.map((p) => p.policy.id) || []);
        setAvailablePolicies(items.filter((p: PolicyItem) => !linkedIds.has(p.id)));
      }
    } catch {
      setAvailablePolicies([]);
    }
  };

  const handleLinkPolicy = async () => {
    if (!selectedPolicyId) return;
    setLinkingPolicy(true);
    try {
      const res = await fetch(`/api/qpost-compliance/requirements/${id}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: selectedPolicyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast({ title: t("Policy linked successfully") });
      setLinkPolicyOpen(false);
      fetchRequirement();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to link policy";
      toast({ title: t(msg), variant: "destructive" });
    } finally {
      setLinkingPolicy(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkDialog) return;
    setUnlinking(true);
    try {
      const endpoint =
        unlinkDialog.type === "evidence"
          ? `/api/qpost-compliance/requirements/${id}/evidences?evidenceId=${unlinkDialog.id}`
          : `/api/qpost-compliance/requirements/${id}/policies?policyId=${unlinkDialog.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t(unlinkDialog.type === "evidence" ? "Evidence unlinked" : "Policy unlinked") });
      setUnlinkDialog(null);
      fetchRequirement();
    } catch {
      toast({ title: t("Failed to unlink"), variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Import evidences
  // ---------------------------------------------------------------------------

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`/api/qpost-compliance/requirements/${id}/import-evidences`);
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "evidence-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("Failed to download template"), variant: "destructive" });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportEvidences = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch(`/api/qpost-compliance/requirements/${id}/import-evidences`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: t("Import Successful"), description: data.message });
        setImportOpen(false);
        setImportFile(null);
        setImportErrors([]);
        fetchRequirement();
      } else {
        const errs: string[] = [];
        if (data.details) {
          for (const d of data.details) {
            errs.push(`Row ${d.row}: ${d.column ? `[${d.column}] ` : ""}${d.message}`);
          }
        }
        if (data.errors) {
          errs.push(...data.errors);
        }
        if (errs.length === 0) errs.push(data.error || "Import failed");
        setImportErrors(errs);
        toast({ title: t("Import Failed"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to import evidences"), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Import policies
  // ---------------------------------------------------------------------------

  const handleDownloadPolicyTemplate = async () => {
    setDownloadingPolicyTemplate(true);
    try {
      const res = await fetch(`/api/qpost-compliance/requirements/${id}/import-policies`);
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "governance-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("Failed to download template"), variant: "destructive" });
    } finally {
      setDownloadingPolicyTemplate(false);
    }
  };

  const handleImportPolicies = async () => {
    if (!importPolicyFile) return;
    setImportingPolicy(true);
    setImportPolicyErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", importPolicyFile);

      const res = await fetch(`/api/qpost-compliance/requirements/${id}/import-policies`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: t("Import Successful"), description: data.message });
        setImportPolicyOpen(false);
        setImportPolicyFile(null);
        setImportPolicyErrors([]);
        fetchRequirement();
      } else {
        const errs: string[] = [];
        if (data.details) {
          for (const d of data.details) {
            errs.push(`Row ${d.row}: ${d.column ? `[${d.column}] ` : ""}${d.message}`);
          }
        }
        if (data.errors) {
          errs.push(...data.errors);
        }
        if (errs.length === 0) errs.push(data.error || "Import failed");
        setImportPolicyErrors(errs);
        toast({ title: t("Import Failed"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to import policies"), variant: "destructive" });
    } finally {
      setImportingPolicy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Translation hooks (must be called before any early returns)
  // ---------------------------------------------------------------------------

  const rawEvidences = requirement ? requirement.evidences.map((e) => e.evidence) : [];
  const rawPolicies = requirement ? requirement.policies.map((p) => p.policy) : [];
  const rawExceptions = requirement ? [...(requirement.exceptions || []), ...(requirement.complianceExceptions || [])] : [];

  const { data: trReq } = useTranslatedRecord(requirement, { modelName: "QPostRequirement" });
  const req = (trReq || requirement) as Requirement;
  const { data: evidences } = useTranslatedData(rawEvidences, { modelName: "QPostEvidence" });
  const { data: policies } = useTranslatedData(rawPolicies, { modelName: "QPostPolicy" });
  const { data: exceptions } = useTranslatedData(rawExceptions, { modelName: "QPostException" });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.push("/qpost-compliance/requirements")}>
          <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Back")}
        </Button>
        <p className="text-muted-foreground">{t("Requirement not found")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-muted-foreground gap-1">
        <Link href="/" className="hover:text-foreground">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/qpost-compliance/requirements" className="hover:text-foreground">
          {t("Requirements")}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{req.code}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/qpost-compliance/requirements")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{req.code} - {req.name}</h1>
            <p className="text-sm text-muted-foreground">
              {requirement.framework?.name || t("No Framework")}
              {requirement.category ? ` / ${requirement.category.name}` : ""}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={openEditDialog}>
            <Edit2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Edit")}
          </Button>
        )}
      </div>

      {/* Detail Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Requirement Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailField label={t("Code")} value={req.code} />
            <DetailField label={t("Name")} value={req.name} />
            <DetailField label={t("Framework")} value={requirement.framework?.name} />
            <DetailField label={t("Category")} value={requirement.category?.name} />
            <DetailField label={t("Requirement Type")} value={requirement.requirementType} />
            <DetailField label={t("Chapter Type")} value={requirement.chapterType} />
            <DetailField label={t("Level")} value={String(requirement.level)} />
            <DetailField label={t("Sort Order")} value={String(requirement.sortOrder)} />
            <div>
              <span className="text-xs text-muted-foreground">{t("Applicability")}</span>
              <div className="mt-1">
                <Badge variant={statusVariant(requirement.applicability)}>
                  {requirement.applicability || t("Not Set")}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{t("Implementation Status")}</span>
              <div className="mt-1">
                <Badge variant={statusVariant(requirement.implementationStatus)}>
                  {requirement.implementationStatus || t("Not Set")}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{t("Control Compliance")}</span>
              <div className="mt-1">
                <Badge variant={statusVariant(requirement.controlCompliance)}>
                  {requirement.controlCompliance || t("Not Set")}
                </Badge>
              </div>
            </div>
            {requirement.parent && (
              <DetailField label={t("Parent Requirement")} value={`${requirement.parent.code} - ${requirement.parent.name}`} />
            )}
          </div>
          {req.description && (
            <div className="mt-4">
              <span className="text-xs text-muted-foreground">{t("Description")}</span>
              <p className="mt-1 text-sm whitespace-pre-wrap">{req.description}</p>
            </div>
          )}
          {requirement.justification && (
            <div className="mt-4">
              <span className="text-xs text-muted-foreground">{t("Justification")}</span>
              <p className="mt-1 text-sm whitespace-pre-wrap">{requirement.justification}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-requirements */}
      {requirement.children && requirement.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Sub-Requirements")} ({requirement.children.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Code")}</TableHead>
                  <TableHead>{t("Name")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirement.children.map((child) => (
                  <TableRow key={child.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/qpost-compliance/requirements/${child.id}`)}>
                    <TableCell className="font-medium">{child.code}</TableCell>
                    <TableCell>{child.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Evidences, Governance, Exceptions */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="evidences">
            <FileText className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Evidences")} ({evidences.length})
          </TabsTrigger>
          <TabsTrigger value="governance">
            <Shield className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Governance")} ({policies.length})
          </TabsTrigger>
          <TabsTrigger value="exceptions">
            <AlertTriangle className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Exceptions")} ({exceptions.length})
          </TabsTrigger>
        </TabsList>

        {/* Evidences Tab */}
        <TabsContent value="evidences">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("Linked Evidences")}</CardTitle>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setImportFile(null); setImportErrors([]); setImportOpen(true); }}>
                    <Upload className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Import")}
                  </Button>
                  <Button size="sm" onClick={openLinkEvidence}>
                    <Link2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Link Evidence")}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {evidences.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("No evidences linked")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Code")}</TableHead>
                      <TableHead>{t("Name")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead>{t("Department")}</TableHead>
                      <TableHead>{t("Assignee")}</TableHead>
                      {canEdit && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidences.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{ev.evidenceCode}</TableCell>
                        <TableCell>{ev.name}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(ev.status)}>{ev.status}</Badge>
                        </TableCell>
                        <TableCell>{ev.department?.name || "-"}</TableCell>
                        <TableCell>{ev.assignee?.fullName || "-"}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setUnlinkDialog({ type: "evidence", id: ev.id, name: ev.name })}
                            >
                              <Unlink className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Governance Tab */}
        <TabsContent value="governance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("Linked Policies")}</CardTitle>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setImportPolicyFile(null); setImportPolicyErrors([]); setImportPolicyOpen(true); }}>
                    <Upload className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Import")}
                  </Button>
                  <Button size="sm" onClick={openLinkPolicy}>
                    <Link2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Link Policy")}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("No policies linked")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Code")}</TableHead>
                      <TableHead>{t("Name")}</TableHead>
                      <TableHead>{t("Type")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead>{t("Department")}</TableHead>
                      {canEdit && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((pol) => (
                      <TableRow key={pol.id}>
                        <TableCell className="font-medium">{pol.code}</TableCell>
                        <TableCell>{pol.name}</TableCell>
                        <TableCell>{pol.documentType || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(pol.status)}>{pol.status}</Badge>
                        </TableCell>
                        <TableCell>{pol.department?.name || "-"}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setUnlinkDialog({ type: "policy", id: pol.id, name: pol.name })}
                            >
                              <Unlink className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions">
          <Card>
            <CardHeader>
              <CardTitle>{t("Exceptions")}</CardTitle>
            </CardHeader>
            <CardContent>
              {exceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("No exceptions")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Title")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead>{t("Expiry Date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell>{ex.title || ex.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(ex.status)}>{ex.status || "-"}</Badge>
                        </TableCell>
                        <TableCell>{ex.expiryDate ? new Date(ex.expiryDate).toLocaleDateString() : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------- */}
      {/* Edit Dialog                                                          */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Edit Requirement")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>{t("Code")}</Label>
              <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("Name")}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("Requirement Type")}</Label>
              <Select value={editForm.requirementType} onValueChange={(v) => setEditForm({ ...editForm, requirementType: v })}>
                <SelectTrigger><SelectValue placeholder={t("Select type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="requirement">{t("Requirement")}</SelectItem>
                  <SelectItem value="chapter">{t("Chapter")}</SelectItem>
                  <SelectItem value="section">{t("Section")}</SelectItem>
                  <SelectItem value="clause">{t("Clause")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Chapter Type")}</Label>
              <Select value={editForm.chapterType} onValueChange={(v) => setEditForm({ ...editForm, chapterType: v })}>
                <SelectTrigger><SelectValue placeholder={t("Select chapter type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">{t("Main")}</SelectItem>
                  <SelectItem value="sub">{t("Sub")}</SelectItem>
                  <SelectItem value="annex">{t("Annex")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Applicability")}</Label>
              <Select value={editForm.applicability} onValueChange={(v) => setEditForm({ ...editForm, applicability: v })}>
                <SelectTrigger><SelectValue placeholder={t("Select applicability")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Applicable">{t("Applicable")}</SelectItem>
                  <SelectItem value="Not Applicable">{t("Not Applicable")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Implementation Status")}</Label>
              <Select value={editForm.implementationStatus} onValueChange={(v) => setEditForm({ ...editForm, implementationStatus: v })}>
                <SelectTrigger><SelectValue placeholder={t("Select status")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Implemented">{t("Implemented")}</SelectItem>
                  <SelectItem value="Partially Implemented">{t("Partially Implemented")}</SelectItem>
                  <SelectItem value="Not Implemented">{t("Not Implemented")}</SelectItem>
                  <SelectItem value="Planned">{t("Planned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Control Compliance")}</Label>
              <Select value={editForm.controlCompliance} onValueChange={(v) => setEditForm({ ...editForm, controlCompliance: v })}>
                <SelectTrigger><SelectValue placeholder={t("Select compliance")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                  <SelectItem value="Partially Compliant">{t("Partially Compliant")}</SelectItem>
                  <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>{t("Description")}</Label>
              <Textarea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>{t("Justification")}</Label>
              <Textarea rows={2} value={editForm.justification} onChange={(e) => setEditForm({ ...editForm, justification: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Link Evidence Dialog                                                 */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={linkEvidenceOpen} onOpenChange={setLinkEvidenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Link Evidence")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("Select Evidence")}</Label>
              <Select value={selectedEvidenceId} onValueChange={setSelectedEvidenceId}>
                <SelectTrigger><SelectValue placeholder={t("Choose an evidence")} /></SelectTrigger>
                <SelectContent>
                  {availableEvidences.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.evidenceCode} - {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableEvidences.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("No available evidences to link")}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLinkEvidenceOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleLinkEvidence} disabled={!selectedEvidenceId || linkingEvidence}>
              {linkingEvidence && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Link")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Link Policy Dialog                                                   */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={linkPolicyOpen} onOpenChange={setLinkPolicyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Link Policy")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("Select Policy")}</Label>
              <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                <SelectTrigger><SelectValue placeholder={t("Choose a policy")} /></SelectTrigger>
                <SelectContent>
                  {availablePolicies.map((pol) => (
                    <SelectItem key={pol.id} value={pol.id}>
                      {pol.code} - {pol.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availablePolicies.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("No available policies to link")}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLinkPolicyOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleLinkPolicy} disabled={!selectedPolicyId || linkingPolicy}>
              {linkingPolicy && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Link")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Unlink Confirmation                                                  */}
      {/* ------------------------------------------------------------------- */}
      <AlertDialog open={!!unlinkDialog} onOpenChange={(open) => !open && setUnlinkDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirm Unlink")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to unlink")} &quot;{unlinkDialog?.name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink} disabled={unlinking}>
              {unlinking && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Unlink")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------------------------- */}
      {/* Import Evidences Dialog                                              */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Import Evidences")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t("Upload an Excel file (.xlsx) to import evidences and automatically link them to this requirement.")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Note: Evidence Code and Status will be auto-generated. For Recurrence column, only these values are accepted:")}{" "}
              <span className="font-medium">Yearly, Half-yearly, Quarterly, Monthly</span>.{" "}
              {t("Any other value will be ignored.")}
            </p>

            {/* File input */}
            <div className="space-y-2">
              <Label>{t("Excel File")}</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportErrors([]);
                }}
              />
              {importFile && (
                <p className="text-xs text-muted-foreground">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>

            {/* Download template */}
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-sm font-medium mb-1">{t("Need a template?")}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {t("Download the sample template with all column headers for your reference.")}
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
                {downloadingTemplate ? (
                  <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />
                ) : (
                  <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                )}
                {t("Download Template")}
              </Button>
            </div>

            {/* Import errors */}
            {importErrors.length > 0 && (
              <div className="border border-destructive/50 rounded-md p-3 bg-destructive/5 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-destructive mb-1">{t("Import Errors")}</p>
                <ul className="text-xs text-destructive space-y-1">
                  {importErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleImportEvidences} disabled={!importFile || importing}>
              {importing && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Import Policies Dialog                                               */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={importPolicyOpen} onOpenChange={setImportPolicyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Import Governance")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t("Upload an Excel file (.xlsx) to import governance documents and automatically link them to this requirement.")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Note: Code and Status will be auto-generated. For Document Type, accepted values are:")}{" "}
              <span className="font-medium">Policy, Standard, Procedure</span>.{" "}
              {t("For Recurrence:")}{" "}
              <span className="font-medium">Yearly, Half-yearly, Quarterly, Monthly</span>.{" "}
              {t("Any other value will be ignored.")}
            </p>

            {/* File input */}
            <div className="space-y-2">
              <Label>{t("Excel File")}</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setImportPolicyFile(e.target.files?.[0] || null);
                  setImportPolicyErrors([]);
                }}
              />
              {importPolicyFile && (
                <p className="text-xs text-muted-foreground">{importPolicyFile.name} ({(importPolicyFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>

            {/* Download template */}
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-sm font-medium mb-1">{t("Need a template?")}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {t("Download the sample template with all column headers for your reference.")}
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadPolicyTemplate} disabled={downloadingPolicyTemplate}>
                {downloadingPolicyTemplate ? (
                  <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />
                ) : (
                  <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                )}
                {t("Download Template")}
              </Button>
            </div>

            {/* Import errors */}
            {importPolicyErrors.length > 0 && (
              <div className="border border-destructive/50 rounded-md p-3 bg-destructive/5 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-destructive mb-1">{t("Import Errors")}</p>
                <ul className="text-xs text-destructive space-y-1">
                  {importPolicyErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportPolicyOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleImportPolicies} disabled={!importPolicyFile || importingPolicy}>
              {importingPolicy && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper component
// ---------------------------------------------------------------------------

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium mt-1">{value || "-"}</p>
    </div>
  );
}
