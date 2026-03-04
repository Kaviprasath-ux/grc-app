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
import {
  Home, Loader2, MessageSquare, AlertTriangle, Plus,
} from "lucide-react";

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
  domainName: string | null;
  severity: string | null;
  description: string | null;
  amResponse: string | null;
  requestedDate: string | null;
  dueDate: string | null;
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
                      <TableHead>{t("Assessment")}</TableHead>
                      <TableHead>{t("Vendor")}</TableHead>
                      <TableHead>{t("Domain")}</TableHead>
                      <TableHead>{t("Severity")}</TableHead>
                      <TableHead>{t("Description")}</TableHead>
                      <TableHead>{t("Due Date")}</TableHead>
                      <TableHead>{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remediations.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{r.assessment.assessmentCode}</TableCell>
                        <TableCell>{r.assessment.vendor.name}</TableCell>
                        <TableCell>{r.domainName || "-"}</TableCell>
                        <TableCell>
                          {r.severity ? (
                            <Badge className={SEVERITY_COLORS[r.severity] || ""}>{t(r.severity)}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{r.description || "-"}</TableCell>
                        <TableCell>{formatDate(r.dueDate)}</TableCell>
                        <TableCell>
                          {r.status === "Pending" ? (
                            <Button size="sm" variant="outline" onClick={() => {
                              setRespondType("remediation");
                              setRespondId(r.id);
                              setRespondText("");
                              setRespondDialogOpen(true);
                            }}>
                              {t("Respond")}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">{r.amResponse?.substring(0, 50) || "-"}</span>
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
    </div>
  );
}
