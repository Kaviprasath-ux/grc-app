"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Home, ChevronRight, Loader2, Eye, Search } from "lucide-react";
import { useSession } from "next-auth/react";

// ── Types ──────────────────────────────────────────────
interface Assessment {
  id: string;
  assessmentCode: string;
  assessmentType: string;
  status: string;
  assessmentResult: string | null;
  vendorSubmissionDate: string | null;
  assessorCompletionDate: string | null;
  approvalDate: string | null;
  completionDate: string | null;
  questionnaireTemplate: string | null;
  approverComment: string | null;
  rejectedById: string | null;
  createdAt: string;
  vendor: { id: string; name: string; vendorCode: string; serviceCategory: string | null };
  initiatedBy: { id: string; fullName: string } | null;
  assessor: { id: string; fullName: string } | null;
  approver: { id: string; fullName: string } | null;
}

// ── Helpers ──────────────────────────────────────────────
function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Completed": case "Approved": case "Offboard_Completed": return "default";
    case "Offboard_Approve_BO": return "destructive";
    case "In-Progress": case "In-Progress(approver)": case "Offboard_In_Progress": return "secondary";
    case "Awaiting_Response": case "Offboard_Awaiting_Respose": case "Initiated": return "outline";
    default: return "outline";
  }
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    Approved: "Approved",
    Initiated: "Initiated",
    "In-Progress": "In-Progress",
    Awaiting_Response: "Awaiting Response",
    Completed: "Completed",
    "In-Progress(approver)": "In-Progress(approver)",
    Offboard_In_Progress: "Offboard In-Progress",
    Offboard_Completed: "Offboard Completed",
    Offboard_Awaiting_Respose: "Offboard Awaiting Response",
    Offboard_Approve_Assessor: "Offboard Approved (Assessor)",
    Offboard_Approve_RM: "Offboard Approved (RM)",
    Offboard_Approve_BO: "Terminated",
  };
  return labels[status] || status;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

const ONGOING_STATUSES = ["Initiated", "Awaiting_Response", "In-Progress", "In-Progress(approver)"];
const COMPLETED_STATUSES = ["Completed", "Approved"];
const AWAITING_STATUSES = ["Awaiting_Response"];
const PENDING_ASSESSOR_STATUSES = ["In-Progress", "In-Progress(approver)"];
const OFFBOARD_STATUSES = ["Offboard_In_Progress", "Offboard_Completed", "Offboard_Awaiting_Respose", "Offboard_Approve_Assessor", "Offboard_Approve_RM", "Offboard_Approve_BO"];

// ── Main Component ──────────────────────────────────────
export default function BOAssessmentsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [topTab, setTopTab] = useState<"ongoing" | "completed" | "offboard">("ongoing");
  const [subTab, setSubTab] = useState<"awaiting" | "pending">("awaiting");
  const [offboardSubTab, setOffboardSubTab] = useState<"approval" | "terminated">("approval");
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/assessments?limit=500");
      if (res.ok) {
        const json = await res.json();
        setAssessments(json.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load assessments"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  const filtered = useMemo(() => {
    let data = assessments;

    if (topTab === "ongoing") {
      data = data.filter((a) => ONGOING_STATUSES.includes(a.status));
      if (subTab === "awaiting") {
        data = data.filter((a) => AWAITING_STATUSES.includes(a.status));
      } else {
        data = data.filter((a) => PENDING_ASSESSOR_STATUSES.includes(a.status));
      }
    } else if (topTab === "completed") {
      data = data.filter((a) => COMPLETED_STATUSES.includes(a.status));
    } else {
      data = data.filter((a) => OFFBOARD_STATUSES.includes(a.status));
      if (offboardSubTab === "approval") {
        data = data.filter((a) => a.status === "Offboard_Approve_RM");
      } else {
        data = data.filter((a) => a.status === "Offboard_Approve_BO");
      }
    }

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (a) =>
          a.assessmentCode.toLowerCase().includes(s) ||
          a.vendor.name.toLowerCase().includes(s) ||
          (a.initiatedBy?.fullName || "").toLowerCase().includes(s)
      );
    }

    return data;
  }, [assessments, topTab, subTab, offboardSubTab, search, session]);

  const topTabs = [
    { key: "ongoing" as const, label: t("Ongoing Assessments") },
    { key: "completed" as const, label: t("Completed Assessments") },
    { key: "offboard" as const, label: t("Offboard Assessments") },
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
        <span className="text-primary-700 font-medium">{t("Assessments")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Assessments")}</h1>

      {/* Top Tabs */}
      <div className="flex gap-2">
        {topTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setTopTab(tab.key); setSearch(""); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              topTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub Tabs for Ongoing */}
      {topTab === "ongoing" && (
        <div className="flex gap-0">
          <button
            onClick={() => setSubTab("awaiting")}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              subTab === "awaiting"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t("Awaiting Response")}
          </button>
          <button
            onClick={() => setSubTab("pending")}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              subTab === "pending"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t("Pending with Assessor")}
          </button>
        </div>
      )}

      {/* Sub Tabs for Offboard */}
      {topTab === "offboard" && (
        <div className="flex gap-0">
          <button
            onClick={() => setOffboardSubTab("approval")}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              offboardSubTab === "approval"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t("Offboard Approval")}
          </button>
          <button
            onClick={() => setOffboardSubTab("terminated")}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              offboardSubTab === "terminated"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t("Terminated Vendors")}
          </button>
        </div>
      )}

      {/* Search & Table */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Filter") + "..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Assessment ID")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Vendor")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Type")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Status")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Initiated")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Due Date")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("No assessments found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">{a.assessmentCode}</TableCell>
                      <TableCell>{a.vendor.name}</TableCell>
                      <TableCell>{t(a.assessmentType)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(a.status)}>{t(formatStatusLabel(a.status))}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(a.createdAt)}</TableCell>
                      <TableCell>{formatDate(a.completionDate || a.vendorSubmissionDate)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedAssessment(a); setDialogOpen(true); }}
                        >
                          <Eye className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                          {t("View")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("Assessment Detail")} - {selectedAssessment?.assessmentCode}
            </DialogTitle>
          </DialogHeader>
          {selectedAssessment && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessment ID")}</label>
                <p className="font-mono">{selectedAssessment.assessmentCode}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessment Type")}</label>
                <p>{t(selectedAssessment.assessmentType)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor")}</label>
                <p>{selectedAssessment.vendor.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Status")}</label>
                <div><Badge variant={getStatusVariant(selectedAssessment.status)}>{t(selectedAssessment.status)}</Badge></div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessment Result")}</label>
                <p>{selectedAssessment.assessmentResult ? t(selectedAssessment.assessmentResult) : "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Questionnaire Template")}</label>
                <p>{selectedAssessment.questionnaireTemplate || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor Submission Date")}</label>
                <p>{formatDate(selectedAssessment.vendorSubmissionDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessor Completion Date")}</label>
                <p>{formatDate(selectedAssessment.assessorCompletionDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Approval Date")}</label>
                <p>{formatDate(selectedAssessment.approvalDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Completion Date")}</label>
                <p>{formatDate(selectedAssessment.completionDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Initiated By")}</label>
                <p>{selectedAssessment.initiatedBy?.fullName || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessor")}</label>
                <p>{selectedAssessment.assessor?.fullName || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Approver")}</label>
                <p>{selectedAssessment.approver?.fullName || "-"}</p>
              </div>
              {selectedAssessment.approverComment && (
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">{t("Approver Comment")}</label>
                  <p>{selectedAssessment.approverComment}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
