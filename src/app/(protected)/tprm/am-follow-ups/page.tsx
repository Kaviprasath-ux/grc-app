"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Home, Loader2, MessageSquare, AlertTriangle, Upload, X, FileText, Download, ExternalLink, Trash2, Eye,
} from "lucide-react";
import { RemediationComments } from "@/components/tprm/remediation-comments";

import { FileInput } from "@/components/shared/file-input";
interface Clarification {
  id: string;
  questionNo: string | null;
  domainName: string | null;
  rejectComment: string | null;
  amResponse: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  status: string;
  createdAt: string;
  assessment: { assessmentCode: string; vendor: { name: string } };
  customerAccount?: { name: string };
  requestedBy: { fullName: string } | null;
}

interface IssueRemediation {
  id: string;
  issueCode: string | null;
  questionNo: string | null;
  questionText: string | null;
  questionResponse: string | null;
  domainName: string | null;
  severity: string | null;
  description: string | null;
  issue: string | null;
  risk: string | null;
  recommendation: string | null;
  amResponse: string | null;
  amComment: string | null;
  assessorComment: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  requestedDate: string | null;
  dueDate: string | null;
  responseDate: string | null;
  returnedAt: string | null;
  status: string;
  createdAt: string;
  assessment: { assessmentCode: string; vendor: { name: string } };
  customerAccount?: { name: string };
}

interface VendorIssue {
  id: string;
  title: string;
  description: string | null;
  severity: string | null;
  dueDate: string | null;
  resolution: string | null;
  status: string;
  createdAt: string;
  vendor: { name: string; vendorCode: string };
  customerAccount?: { name: string };
  reportedBy: { fullName: string } | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-green-100 text-green-700",
};

export default function AMFollowUpsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [mainTab, setMainTab] = useState("clarifications");
  const [subTab, setSubTab] = useState("Pending");

  // Data
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [remediations, setRemediations] = useState<IssueRemediation[]>([]);
  const [vendorIssues, setVendorIssues] = useState<VendorIssue[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic data translation
  const { data: translatedClarifications } = useTranslatedData(clarifications, { modelName: 'TPRMClarification' });
  const { data: translatedRemediations } = useTranslatedData(remediations, { modelName: 'TPRMIssueRemediation' });
  const { data: translatedVendorIssues } = useTranslatedData(vendorIssues, { modelName: 'TPRMVendorIssue' });

  const [commentsOnlyId, setCommentsOnlyId] = useState<string | null>(null);

  // Dialogs
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [respondType, setRespondType] = useState<"clarification" | "remediation">("clarification");
  const [respondId, setRespondId] = useState("");
  const [respondText, setRespondText] = useState("");
  const [respondFiles, setRespondFiles] = useState<File[]>([]);
  const [respondDragOver, setRespondDragOver] = useState(false);
  const respondFileInputRef = useRef<HTMLInputElement>(null);
  // Artifacts already persisted on the clarification (prior rounds, or files the
  // vendor attached and saved in this dialog via Submit). Loaded fresh from the
  // row when the Respond dialog opens.
  const [respondExistingArtifacts, setRespondExistingArtifacts] = useState<Array<{ name: string; url: string }>>([]);
  const [respondLoading, setRespondLoading] = useState(false);
  // Read-only dialog for inspecting a Submitted/Closed clarification (vendor
  // needs to download their own attachments back; cannot edit/delete anymore).
  const [viewClar, setViewClar] = useState<Clarification | null>(null);

  // Remediation detail dialog
  const [remediationDialogOpen, setRemediationDialogOpen] = useState(false);
  const [selectedRemediation, setSelectedRemediation] = useState<IssueRemediation | null>(null);
  const [remediationSubmitting, setRemediationSubmitting] = useState(false);
  const [uploadArtifacts, setUploadArtifacts] = useState(false);
  const [artifactFiles, setArtifactFiles] = useState<File[]>([]);

  // Vendor Issue view/respond dialog
  const [viewIssue, setViewIssue] = useState<VendorIssue | null>(null);
  const [issueResponse, setIssueResponse] = useState("");
  const [issueResponding, setIssueResponding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mainTab === "clarifications") {
        const res = await fetch(`/api/tprm/am-follow-ups/clarifications?status=${subTab}`);
        const json = await res.json();
        setClarifications(json.data || []);
      } else if (mainTab === "remediations") {
        const res = await fetch(`/api/tprm/am-follow-ups/issue-remediations?status=${subTab}`);
        const json = await res.json();
        setRemediations(json.data || []);
      } else if (mainTab === "vendor-issues") {
        const statusMap: Record<string, string> = { Pending: "Open", Submitted: "Submitted", Closed: "Closed" };
        const res = await fetch(`/api/tprm/am-follow-ups/vendor-issues?status=${statusMap[subTab] || "Open"}`);
        const json = await res.json();
        setVendorIssues(json.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load data"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [mainTab, subTab, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset sub-tab when main tab changes
  useEffect(() => {
    setSubTab("Pending");
  }, [mainTab]);

  const handleRespond = async () => {
    if (!respondText.trim()) return;
    setRespondLoading(true);
    try {
      const endpoint = respondType === "clarification"
        ? "/api/tprm/am-follow-ups/clarifications"
        : "/api/tprm/am-follow-ups/issue-remediations";

      // Use FormData so we can attach files alongside the response text.
      const formData = new FormData();
      formData.append("id", respondId);
      formData.append("amResponse", respondText);
      for (const file of respondFiles) {
        formData.append("files", file);
      }
      const res = await fetch(endpoint, { method: "PATCH", body: formData });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      if (respondType === "clarification") {
        triggerTranslation('TPRMClarification', result.id || respondId, { amResponse: respondText });
      } else {
        triggerTranslation('TPRMIssueRemediation', result.id || respondId, { amResponse: respondText });
      }
      toast({ title: t("Success"), description: t("Response submitted") });
      setRespondDialogOpen(false);
      setRespondText("");
      setRespondFiles([]);
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to submit response"), variant: "destructive" });
    } finally {
      setRespondLoading(false);
    }
  };

  const handleRemediationSubmit = async () => {
    if (!selectedRemediation) return;
    setRemediationSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("id", selectedRemediation.id);
      formData.append("amResponse", "Evidence submitted");
      if (uploadArtifacts && artifactFiles.length > 0) {
        for (const file of artifactFiles) {
          formData.append("files", file);
        }
      }
      const res = await fetch("/api/tprm/am-follow-ups/issue-remediations", {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Evidence submitted successfully") });
      setRemediationDialogOpen(false);
      setSelectedRemediation(null);
      setUploadArtifacts(false);
      setArtifactFiles([]);
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to submit evidence"), variant: "destructive" });
    } finally {
      setRemediationSubmitting(false);
    }
  };

  const openRemediationDialog = (r: IssueRemediation) => {
    setSelectedRemediation(r);
    setUploadArtifacts(!!r.artifactName);
    setArtifactFiles([]);
    setRemediationDialogOpen(true);
  };

  // Delete a single artifact from a still-open clarification. Server enforces
  // that status === "Pending" — surface any rejection back to the user so they
  // know why the delete failed.
  const handleDeleteClarificationArtifact = async (idx: number) => {
    try {
      const res = await fetch(
        `/api/tprm/am-follow-ups/clarifications?id=${respondId}&artifactIndex=${idx}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed");
      }
      setRespondExistingArtifacts(prev => prev.filter((_, i) => i !== idx));
      toast({ title: t("Success"), description: t("Artifact deleted") });
      fetchData();
    } catch (err) {
      toast({
        title: t("Error"),
        description: err instanceof Error ? err.message : t("Failed to delete artifact"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteArtifact = async (remediationId: string, artifactIndex: number) => {
    try {
      const res = await fetch(`/api/tprm/am-follow-ups/issue-remediations?id=${remediationId}&artifactIndex=${artifactIndex}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Artifact deleted") });
      // Update the selected remediation in place
      const updated = await res.json();
      setSelectedRemediation(prev => prev ? { ...prev, artifactName: updated.artifactName, artifactUrl: updated.artifactUrl } : null);
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete artifact"), variant: "destructive" });
    }
  };

  const openViewIssue = (i: VendorIssue) => {
    setViewIssue(i);
    setIssueResponse(i.resolution || "");
  };

  const closeViewIssue = () => {
    setViewIssue(null);
    setIssueResponse("");
  };

  const handleSubmitIssueResponse = async () => {
    if (!viewIssue || !issueResponse.trim()) return;
    setIssueResponding(true);
    try {
      const res = await fetch("/api/tprm/am-follow-ups/vendor-issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: viewIssue.id, resolution: issueResponse.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      triggerTranslation('TPRMVendorIssue', viewIssue.id, { resolution: issueResponse.trim() });
      toast({ title: t("Success"), description: t("Response submitted") });
      closeViewIssue();
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to submit response"), variant: "destructive" });
    } finally {
      setIssueResponding(false);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "-";

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>/</span>
        <span>{t("TPRM")}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{t("Follow-Ups")}</span>
      </div>

      <h1 className="text-2xl font-semibold">{t("Follow-Ups")}</h1>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="ltr:justify-start rtl:justify-end">
          <TabsTrigger value="clarifications">
            <MessageSquare className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Clarifications")}
          </TabsTrigger>
          <TabsTrigger value="remediations">
            <AlertTriangle className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Issue Remediation")}
          </TabsTrigger>
          <TabsTrigger value="vendor-issues">
            <AlertTriangle className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Vendor Issues")}
          </TabsTrigger>
        </TabsList>

        {/* Sub-tabs */}
        <div className="mt-4 flex gap-2">
          {["Pending", "Submitted", "Closed"].map(s => (
            <Button
              key={s}
              variant={subTab === s ? "default" : "outline"}
              size="sm"
              onClick={() => setSubTab(s)}
            >
              {t(s)}
            </Button>
          ))}
        </div>

        {/* Clarifications Tab */}
        <TabsContent value="clarifications">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : translatedClarifications.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">{t("No clarifications found")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Assessment")}</TableHead>
                      <TableHead>{t("Customer")}</TableHead>
                      <TableHead>{t("Vendor")}</TableHead>
                      <TableHead>{t("Question No")}</TableHead>
                      <TableHead>{t("Domain")}</TableHead>
                      <TableHead>{t("Comment")}</TableHead>
                      <TableHead>{t("Date")}</TableHead>
                      <TableHead>{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {translatedClarifications.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>{c.assessment.assessmentCode}</TableCell>
                        <TableCell>{c.customerAccount?.name || "-"}</TableCell>
                        <TableCell>{c.assessment.vendor.name}</TableCell>
                        <TableCell>{c.questionNo || "-"}</TableCell>
                        <TableCell>{c.domainName || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{c.rejectComment || "-"}</TableCell>
                        <TableCell>{formatDate(c.createdAt)}</TableCell>
                        <TableCell>
                          {c.status === "Pending" ? (
                            <Button size="sm" variant="outline" onClick={() => {
                              setRespondType("clarification");
                              setRespondId(c.id);
                              setRespondText(c.amResponse || "");
                              setRespondFiles([]);
                              // Hydrate prior attachments so the vendor can
                              // see/download/delete them before re-submitting.
                              const names = c.artifactName?.split(", ").filter(Boolean) || [];
                              const urls = c.artifactUrl?.split(", ").filter(Boolean) || [];
                              setRespondExistingArtifacts(
                                names.map((name, idx) => ({ name, url: urls[idx] || "" })),
                              );
                              setRespondDialogOpen(true);
                            }}>
                              {t("Respond")}
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setViewClar(c)}>
                              {t("View")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remediations Tab */}
        <TabsContent value="remediations">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : translatedRemediations.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">{t("No issue remediations found")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Issue ID")}</TableHead>
                      <TableHead>{t("Customer")}</TableHead>
                      <TableHead>{t("Assessment ID")}</TableHead>
                      <TableHead>{t("Domain")}</TableHead>
                      <TableHead>{t("Severity")}</TableHead>
                      <TableHead>{t("Requested Date")}</TableHead>
                      <TableHead>{t("Due Date")}</TableHead>
                      <TableHead>{t("Comments")}</TableHead>
                      <TableHead>{t("Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {translatedRemediations.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{r.issueCode || "-"}</span>
                            {r.returnedAt && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                {t("Returned")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{r.customerAccount?.name || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{r.assessment.assessmentCode}</TableCell>
                        <TableCell>{r.domainName || "-"}</TableCell>
                        <TableCell>
                          {r.severity ? (
                            <Badge className={SEVERITY_COLORS[r.severity] || ""}>{t(r.severity)}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{formatDate(r.requestedDate)}</TableCell>
                        <TableCell>{formatDate(r.dueDate)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setCommentsOnlyId(r.id)}>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          {r.status === "Pending" ? (
                            <Button size="sm" variant="outline" onClick={() => openRemediationDialog(r)}>
                              {t("Submit Evidence")}
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => openRemediationDialog(r)}>
                              {t("View")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendor Issues Tab */}
        <TabsContent value="vendor-issues">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : translatedVendorIssues.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">{t("No vendor issues found")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Title")}</TableHead>
                      <TableHead>{t("Customer")}</TableHead>
                      <TableHead>{t("Vendor")}</TableHead>
                      <TableHead>{t("Severity")}</TableHead>
                      <TableHead>{t("Description")}</TableHead>
                      <TableHead>{t("Due Date")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead>{t("Created")}</TableHead>
                      <TableHead className="ltr:text-right rtl:text-left">{t("Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {translatedVendorIssues.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.title}</TableCell>
                        <TableCell>{i.customerAccount?.name || "-"}</TableCell>
                        <TableCell>{i.vendor.name}</TableCell>
                        <TableCell>
                          {i.severity ? (
                            <Badge className={SEVERITY_COLORS[i.severity] || ""}>{t(i.severity)}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{i.description || "-"}</TableCell>
                        <TableCell>{formatDate(i.dueDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t(i.status)}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(i.createdAt)}</TableCell>
                        <TableCell className="ltr:text-right rtl:text-left">
                          <Button size="sm" variant="outline" onClick={() => openViewIssue(i)}>
                            <Eye className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                            {t("View")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Respond Dialog */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Submit Response")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={respondText}
              onChange={e => setRespondText(e.target.value)}
              placeholder={t("Enter your response...")}
              rows={5}
            />

            {respondExistingArtifacts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("Previously Uploaded")}</Label>
                <ul className="space-y-1 text-sm">
                  {respondExistingArtifacts.map((a, idx) => (
                    <li
                      key={`${a.name}-${idx}`}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span className="truncate flex-1">{a.name}</span>
                      {a.url && (
                        <a
                          href={a.url}
                          download={a.name}
                          className="text-slate-600 hover:text-slate-900"
                          title={t("Download")}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteClarificationArtifact(idx)}
                        className="text-red-600 hover:text-red-800"
                        title={t("Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("Attachments (optional)")}</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  respondDragOver
                    ? "border-primary bg-primary/5"
                    : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setRespondDragOver(true); }}
                onDragLeave={() => setRespondDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setRespondDragOver(false);
                  const dropped = Array.from(e.dataTransfer.files);
                  if (dropped.length) setRespondFiles(prev => [...prev, ...dropped]);
                }}
                onClick={() => respondFileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("Drop files here or click to browse")}
                </p>
              </div>
              <FileInput
                ref={respondFileInputRef}
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  if (picked.length) setRespondFiles(prev => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
              {respondFiles.length > 0 && (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {respondFiles.map((f, idx) => (
                    <li key={`${f.name}-${idx}`} className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setRespondFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-red-600 hover:underline"
                      >
                        {t("Remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleRespond} disabled={respondLoading || !respondText.trim()}>
              {respondLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-only View Dialog (Submitted / Closed clarifications) */}
      <Dialog open={!!viewClar} onOpenChange={(open) => { if (!open) setViewClar(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Clarification Response")}</DialogTitle>
          </DialogHeader>
          {viewClar && (
            <div className="space-y-4 text-sm">
              {viewClar.rejectComment && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-500">{t("Clarification Request")}</Label>
                  <p className="mt-1 whitespace-pre-wrap">{viewClar.rejectComment}</p>
                </div>
              )}
              {viewClar.amResponse && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-500">{t("Your Response")}</Label>
                  <p className="mt-1 whitespace-pre-wrap">{viewClar.amResponse}</p>
                </div>
              )}
              {viewClar.artifactName && viewClar.artifactUrl && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-500">{t("Attachments")}</Label>
                  <ul className="mt-2 space-y-1">
                    {viewClar.artifactName.split(", ").map((name, idx) => {
                      const url = viewClar.artifactUrl?.split(", ")[idx];
                      return (
                        <li
                          key={`${name}-${idx}`}
                          className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                          <span className="truncate flex-1">{name}</span>
                          {url && (
                            <>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-600 hover:text-slate-900"
                                title={t("View")}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <a
                                href={url}
                                download={name}
                                className="text-slate-600 hover:text-slate-900"
                                title={t("Download")}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewClar(null)}>{t("Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Issue View / Respond Dialog */}
      <Dialog open={!!viewIssue} onOpenChange={(open) => { if (!open) closeViewIssue(); }}>
        <DialogContent className="!max-w-2xl w-[92vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Vendor Issue")}</DialogTitle>
          </DialogHeader>
          {viewIssue && (() => {
            const translated = translatedVendorIssues.find(v => v.id === viewIssue.id) || viewIssue;
            const responded = !!viewIssue.resolution || viewIssue.status !== 'Open' && viewIssue.status !== 'Awaiting Response';
            return (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Title")}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{translated.title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Vendor")}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{translated.vendor.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Severity")}</dt>
                    <dd className="mt-0.5">
                      {translated.severity ? (
                        <Badge className={SEVERITY_COLORS[translated.severity] || ""}>{t(translated.severity)}</Badge>
                      ) : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Status")}</dt>
                    <dd className="mt-0.5"><Badge variant="outline">{t(translated.status)}</Badge></dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Due Date")}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{formatDate(translated.dueDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Reported")}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {translated.reportedBy?.fullName || "-"}{translated.createdAt ? ` · ${formatDate(translated.createdAt)}` : ""}
                    </dd>
                  </div>
                </dl>

                {translated.description && (
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("Description")}</Label>
                    <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-foreground">
                      {translated.description}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">{t("Response")}{!responded && " *"}</Label>
                  <Textarea
                    value={issueResponse}
                    onChange={(e) => setIssueResponse(e.target.value)}
                    placeholder={t("Enter your response to this issue...")}
                    rows={6}
                    disabled={responded || issueResponding}
                    className="mt-1"
                  />
                  {responded && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {t("This issue has already been responded to.")}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={closeViewIssue}>{t("Close")}</Button>
            {viewIssue && !viewIssue.resolution && (viewIssue.status === 'Open' || viewIssue.status === 'Awaiting Response') && (
              <Button onClick={handleSubmitIssueResponse} disabled={!issueResponse.trim() || issueResponding}>
                {issueResponding && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
                {t("Submit Response")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== COMMENTS ONLY DIALOG ==================== */}
      <Dialog open={!!commentsOnlyId} onOpenChange={(open) => { if (!open) setCommentsOnlyId(null); }}>
        <DialogContent className="!max-w-lg w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Comments")}</DialogTitle>
          </DialogHeader>
          {commentsOnlyId && <RemediationComments remediationId={commentsOnlyId} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentsOnlyId(null)}>{t("Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remediation Detail Dialog (Mendix-style) */}
      <Dialog open={remediationDialogOpen} onOpenChange={setRemediationDialogOpen}>
        <DialogContent className="!max-w-7xl w-[98vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Remediation")}</DialogTitle>
          </DialogHeader>
          {selectedRemediation && (
            <div className="space-y-5">
              {/* Question info */}
              <div>
                <h5 className="font-semibold text-sm">{t("Question")} {selectedRemediation.questionNo} —</h5>
                <p className="text-sm text-muted-foreground mt-1">{selectedRemediation.questionText || "-"}</p>
              </div>

              {/* Selected Response (Yes/No/NA) */}
              {selectedRemediation.questionResponse && (
                <div>
                  <Label className="text-xs font-semibold">{t("Selected Response")}</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={`text-sm ${
                      selectedRemediation.questionResponse === "Yes" ? "bg-green-50 text-green-700 border-green-300" :
                      selectedRemediation.questionResponse === "No" ? "bg-red-50 text-red-700 border-red-300" :
                      "bg-gray-50 text-gray-700 border-gray-300"
                    }`}>{selectedRemediation.questionResponse}</Badge>
                  </div>
                </div>
              )}

              {/* Assessor comment (shown when returned) */}
              {selectedRemediation.assessorComment && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      {t("Returned")}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("Assessor marked this as unsatisfactory")}</span>
                  </div>
                  <p className="text-sm text-orange-900">{selectedRemediation.assessorComment}</p>
                </div>
              )}

              {/* VerifAI Summary */}
              <h5 className="font-semibold text-sm border-b pb-1">{t("VerifAI Summary")}</h5>
              {!selectedRemediation.risk && !selectedRemediation.recommendation ? (
                /* Monitoring-reported issue: compact 2-col layout */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedRemediation.issue && (
                    <div>
                      <Label className="text-xs font-semibold">{t("Issue")}</Label>
                      <Textarea value={selectedRemediation.issue} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                  )}
                  <div>
                    <RemediationComments
                      remediationId={selectedRemediation.id}
                      readOnly={selectedRemediation.status !== "Pending"}
                    />
                  </div>
                </div>
              ) : (
                /* Normal assessment remediation: original layout */
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">{t("Issue")}</Label>
                      <Textarea value={selectedRemediation.issue || ""} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">{t("Risk")}</Label>
                      <Textarea value={selectedRemediation.risk || ""} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">{t("Recommendation")}</Label>
                      <Textarea value={selectedRemediation.recommendation || ""} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                    <div>
                      <RemediationComments
                        remediationId={selectedRemediation.id}
                        readOnly={selectedRemediation.status !== "Pending"}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold">{t("Severity")}</Label>
                  <div className="mt-1">
                    {selectedRemediation.severity ? (
                      <Badge className={SEVERITY_COLORS[selectedRemediation.severity] || ""}>{t(selectedRemediation.severity)}</Badge>
                    ) : "-"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">{t("Due Date")}</Label>
                  <p className="text-sm mt-1">{formatDate(selectedRemediation.dueDate)}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">{t("Requested Date")}</Label>
                  <p className="text-sm mt-1">{formatDate(selectedRemediation.requestedDate)}</p>
                </div>
              </div>

              {/* Upload Supporting Artifacts */}
              {selectedRemediation.status === "Pending" && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="upload-artifacts"
                      checked={uploadArtifacts}
                      onCheckedChange={(checked) => {
                        setUploadArtifacts(!!checked);
                        if (!checked) setArtifactFiles([]);
                      }}
                    />
                    <label htmlFor="upload-artifacts" className="text-sm font-medium cursor-pointer">
                      {t("Upload Supporting Artifacts")}
                    </label>
                  </div>
                  {uploadArtifacts && (
                    <div className="space-y-3">
                      <div
                        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          const droppedFiles = Array.from(e.dataTransfer.files);
                          setArtifactFiles(prev => [...prev, ...droppedFiles]);
                        }}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.multiple = true;
                          input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.bmp,.webp,.txt,.rtf,.zip,.rar";
                          input.onchange = (ev) => {
                            const files = Array.from((ev.target as HTMLInputElement).files || []);
                            setArtifactFiles(prev => [...prev, ...files]);
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">{t("Drag & drop files here or click to browse")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("Supports PDF, Excel, CSV, Word, PowerPoint, Images, and more")}</p>
                      </div>
                      {artifactFiles.length > 0 && (
                        <div className="space-y-2">
                          {artifactFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate flex-1">{file.name}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                              <button
                                type="button"
                                onClick={() => setArtifactFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="text-muted-foreground hover:text-destructive flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Show existing uploaded artifacts for all statuses */}
              {selectedRemediation.artifactName && (
                <div className="border-t pt-4">
                  <Label className="text-xs font-semibold">{t("Uploaded Artifacts")}</Label>
                  <div className="mt-2 space-y-1">
                    {selectedRemediation.artifactName.split(", ").map((name, idx) => {
                      const urls = selectedRemediation.artifactUrl?.split(", ") || [];
                      const rawUrl = urls[idx];
                      const url = rawUrl ? (rawUrl.startsWith("/uploads/") ? `/api${rawUrl}` : rawUrl) : null;
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1">{name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {url && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t("View")} onClick={() => window.open(url, "_blank")}>
                                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                </Button>
                                <a href={url} download={name} title={t("Download")} className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                                  <Download className="h-3.5 w-3.5 text-primary" />
                                </a>
                              </>
                            )}
                            {selectedRemediation.status === "Pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title={t("Delete")}
                                onClick={() => handleDeleteArtifact(selectedRemediation.id, idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedRemediation?.status === "Pending" && (
              <Button onClick={handleRemediationSubmit} disabled={remediationSubmitting}>
                {remediationSubmitting && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                {t("Submit")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setRemediationDialogOpen(false)}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
