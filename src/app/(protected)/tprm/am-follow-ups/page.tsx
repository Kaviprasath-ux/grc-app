"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Home, Loader2, MessageSquare, AlertTriangle, Plus, Upload, X, FileText, Download, ExternalLink, Trash2,
} from "lucide-react";
import { RemediationComments } from "@/components/tprm/remediation-comments";

interface Clarification {
  id: string;
  questionNo: string | null;
  domainName: string | null;
  rejectComment: string | null;
  amResponse: string | null;
  status: string;
  createdAt: string;
  assessment: { assessmentCode: string; vendor: { name: string } };
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

  // Dialogs
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [respondType, setRespondType] = useState<"clarification" | "remediation">("clarification");
  const [respondId, setRespondId] = useState("");
  const [respondText, setRespondText] = useState("");
  const [respondLoading, setRespondLoading] = useState(false);

  // Remediation detail dialog
  const [remediationDialogOpen, setRemediationDialogOpen] = useState(false);
  const [selectedRemediation, setSelectedRemediation] = useState<IssueRemediation | null>(null);
  const [remediationSubmitting, setRemediationSubmitting] = useState(false);
  const [uploadArtifacts, setUploadArtifacts] = useState(false);
  const [artifactFiles, setArtifactFiles] = useState<File[]>([]);

  // Vendor Issue dialog
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({ vendorId: "", title: "", description: "", severity: "Medium", dueDate: "" });
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);

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
        // Extract unique vendors for issue creation
        const vendorMap = new Map<string, { id: string; name: string }>();
        for (const i of (json.data || []) as VendorIssue[]) {
          if (!vendorMap.has(i.vendor.vendorCode)) {
            vendorMap.set(i.vendor.vendorCode, { id: "", name: i.vendor.name });
          }
        }
        setVendors(Array.from(vendorMap.values()));
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
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: respondId, amResponse: respondText }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Response submitted") });
      setRespondDialogOpen(false);
      setRespondText("");
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

  const handleCreateIssue = async () => {
    if (!newIssue.title.trim()) return;
    try {
      const res = await fetch("/api/tprm/am-follow-ups/vendor-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIssue),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Issue created") });
      setIssueDialogOpen(false);
      setNewIssue({ vendorId: "", title: "", description: "", severity: "Medium", dueDate: "" });
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to create issue"), variant: "destructive" });
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
        <TabsList>
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
              ) : clarifications.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">{t("No clarifications found")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Assessment")}</TableHead>
                      <TableHead>{t("Vendor")}</TableHead>
                      <TableHead>{t("Question No")}</TableHead>
                      <TableHead>{t("Domain")}</TableHead>
                      <TableHead>{t("Reject Comment")}</TableHead>
                      <TableHead>{t("Date")}</TableHead>
                      <TableHead>{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clarifications.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>{c.assessment.assessmentCode}</TableCell>
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
                              setRespondText("");
                              setRespondDialogOpen(true);
                            }}>
                              {t("Respond")}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">{c.amResponse?.substring(0, 50) || "-"}</span>
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
              ) : remediations.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">{t("No issue remediations found")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Issue ID")}</TableHead>
                      <TableHead>{t("Assessment ID")}</TableHead>
                      <TableHead>{t("Domain")}</TableHead>
                      <TableHead>{t("Severity")}</TableHead>
                      <TableHead>{t("Requested Date")}</TableHead>
                      <TableHead>{t("Due Date")}</TableHead>
                      <TableHead>{t("Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remediations.map(r => (
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
          <div className="flex justify-end mb-4">
            {subTab === "Pending" && (
              <Button onClick={() => setIssueDialogOpen(true)}>
                <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("Add Issue")}
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : vendorIssues.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">{t("No vendor issues found")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Title")}</TableHead>
                      <TableHead>{t("Vendor")}</TableHead>
                      <TableHead>{t("Severity")}</TableHead>
                      <TableHead>{t("Description")}</TableHead>
                      <TableHead>{t("Due Date")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead>{t("Created")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorIssues.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.title}</TableCell>
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
          <Textarea
            value={respondText}
            onChange={e => setRespondText(e.target.value)}
            placeholder={t("Enter your response...")}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleRespond} disabled={respondLoading || !respondText.trim()}>
              {respondLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Report Vendor Issue")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Title")} *</Label>
              <Input
                value={newIssue.title}
                onChange={e => setNewIssue(p => ({ ...p, title: e.target.value }))}
                placeholder={t("Issue title")}
              />
            </div>
            <div>
              <Label>{t("Description")}</Label>
              <Textarea
                value={newIssue.description}
                onChange={e => setNewIssue(p => ({ ...p, description: e.target.value }))}
                placeholder={t("Describe the issue...")}
                rows={3}
              />
            </div>
            <div>
              <Label>{t("Severity")}</Label>
              <Select value={newIssue.severity} onValueChange={v => setNewIssue(p => ({ ...p, severity: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">{t("Critical")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Medium">{t("Medium")}</SelectItem>
                  <SelectItem value="Low">{t("Low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Due Date")}</Label>
              <Input
                type="date"
                value={newIssue.dueDate}
                onChange={e => setNewIssue(p => ({ ...p, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleCreateIssue} disabled={!newIssue.title.trim()}>
              {t("Create Issue")}
            </Button>
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
