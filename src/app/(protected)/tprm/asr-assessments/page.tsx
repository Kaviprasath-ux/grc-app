"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { DataGrid } from "@/components/shared/data-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Eye, RotateCcw, Home, ChevronRight, UserPlus } from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";

interface AssessmentItem {
  id: string;
  assessmentCode: string;
  assessmentType: string;
  status: string;
  vendorSubmissionDate: string | null;
  completionDate: string | null;
  assessmentResult: string | null;
  approverComment: string | null;
  vendor: { id: string; name: string; vendorCode: string; serviceCategory: string | null };
  initiatedBy: { id: string; fullName: string } | null;
  assessor: { id: string; fullName: string } | null;
  approver: { id: string; fullName: string } | null;
}

interface Assessor {
  id: string;
  fullName: string;
  email: string;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Completed":
    case "Approved":
      return "default";
    case "Rejected":
    case "Returned":
      return "destructive";
    case "In Progress":
    case "Under Review":
    case "Submitted":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

// Tab mappings for URL params
const TAB_MAP: Record<string, string> = {
  "my-queue": "my-queue",
  "due-diligence": "due-diligence",
  "reassessments": "reassessments",
  "offboarding": "offboarding",
  "completed": "completed",
};

export default function AsrAssessmentsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "my-queue";

  const isApprover = useHasRole("TPRMApprover");
  const isAuditor = useHasRole("TPRMAuditor");
  const [activeTab, setActiveTab] = useState(TAB_MAP[initialTab] || "my-queue");
  const [subTab, setSubTab] = useState("main");
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [offboardItems, setOffboardItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Filter state
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningAssessment, setAssigningAssessment] = useState<AssessmentItem | null>(null);
  const [assessors, setAssessors] = useState<Assessor[]>([]);
  const [selectedAssessorId, setSelectedAssessorId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Reassign dialog state
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassigningAssessment, setReassigningAssessment] = useState<AssessmentItem | null>(null);
  const [reassignTargets, setReassignTargets] = useState<Assessor[]>([]);
  const [selectedReassignId, setSelectedReassignId] = useState<string>("");
  const [reassigning, setReassigning] = useState(false);
  const router = useRouter();

  // Get current user ID from session
  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(s => {
      if (s?.user?.id) setCurrentUserId(s.user.id);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [mainRes, offboardRes] = await Promise.all([
        fetch(`/api/tprm/asr-assessments?limit=200`),
        fetch(`/api/tprm/offboard-assessments?role=all`),
      ]);
      if (mainRes.ok) {
        const json = await mainRes.json();
        setItems(json.data || []);
      }
      if (offboardRes.ok) {
        const json = await offboardRes.json();
        setOffboardItems((json.data || []).map((a: Record<string, unknown>) => ({
          id: a.id,
          assessmentCode: a.assessmentCode,
          assessmentType: "Offboard Assessment",
          status: a.status as string,
          vendorSubmissionDate: null,
          completionDate: null,
          assessmentResult: null,
          approverComment: null,
          vendor: { id: a.vendorId || "", name: a.vendorName || "Unknown", vendorCode: a.vendorCode || "", serviceCategory: null },
          initiatedBy: a.initiatedBy ? { id: "", fullName: a.initiatedBy as string } : null,
          assessor: null,
          approver: null,
        })));
      }
    } catch (error) {
      console.error("Error fetching assessments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch assessors list when assign dialog opens
  const openAssignDialog = useCallback(async (assessment: AssessmentItem) => {
    setAssigningAssessment(assessment);
    setSelectedAssessorId("");
    setAssignOpen(true);
    try {
      const res = await fetch("/api/tprm/asr-assessments/assessors");
      if (res.ok) setAssessors(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load assessors"), variant: "destructive" });
    }
  }, [toast, t]);

  const handleAssign = async () => {
    if (!assigningAssessment || !selectedAssessorId) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assigningAssessment.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessorId: selectedAssessorId }),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      triggerTranslation('TPRMAssessment', assigningAssessment.id, {
        questionnaireTemplate: result.questionnaireTemplate ?? assigningAssessment.assessmentType,
        approverComment: result.approverComment ?? null,
      });
      const assignedName = assessors.find(a => a.id === selectedAssessorId)?.fullName || "";
      toast({ title: t("Success"), description: `${t("Assessment assigned to")} ${assignedName}` });
      setAssignOpen(false);
      fetchData(); // Refresh to move item from unassigned to assigned
    } catch {
      toast({ title: t("Error"), description: t("Failed to assign assessment"), variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const openReassignDialog = useCallback(async (assessment: AssessmentItem) => {
    setReassigningAssessment(assessment);
    setSelectedReassignId("");
    setReassignOpen(true);
    try {
      // Approver reassigns to other approvers, assessor reassigns to other assessors
      const endpoint = isApprover
        ? "/api/tprm/asr-assessments/approvers"
        : "/api/tprm/asr-assessments/assessors";
      const res = await fetch(endpoint);
      if (res.ok) setReassignTargets(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load users"), variant: "destructive" });
    }
  }, [isApprover, toast, t]);

  const handleReassign = async () => {
    if (!reassigningAssessment || !selectedReassignId) return;
    setReassigning(true);
    try {
      const bodyData = isApprover
        ? { approverId: selectedReassignId }
        : { assessorId: selectedReassignId };
      const res = await fetch(`/api/tprm/asr-assessments/${reassigningAssessment.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      triggerTranslation('TPRMAssessment', reassigningAssessment.id, {
        questionnaireTemplate: result.questionnaireTemplate ?? reassigningAssessment.assessmentType,
        approverComment: result.approverComment ?? null,
      });
      const targetName = reassignTargets.find(a => a.id === selectedReassignId)?.fullName || "";
      toast({ title: t("Success"), description: `${t("Assessment reassigned to")} ${targetName}` });
      setReassignOpen(false);
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to reassign assessment"), variant: "destructive" });
    } finally {
      setReassigning(false);
    }
  };

  const getDefaultSubTab = (tab: string) => {
    switch (tab) {
      case "due-diligence":
      case "reassessments":
        return "awaiting";
      case "offboarding":
      case "my-queue":
        return "main";
      default:
        return "main";
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSubTab(getDefaultSubTab(tab));
    setSearch("");
    setDateFilter("");
  };

  // Translation hooks — must be before any early returns
  const { data: translatedItems } = useTranslatedData(items, { modelName: 'TPRMAssessment' });
  const { data: translatedOffboardItems } = useTranslatedData(offboardItems, { modelName: 'TPRMAssessment' });

  // Filter data based on active tab and sub-tab
  const filteredItems = useMemo(() => {
    let data = translatedItems;

    // My Queue: assessments assigned to the current user with active statuses
    if (activeTab === "my-queue") {
      if (isApprover) {
        // Approver's queue: assessments sent to me for approval
        data = data.filter((i) => i.approver?.id === currentUserId && i.status === "In-Progress(approver)");
      } else if (subTab === "reassessment") {
        data = data.filter((i) => i.assessor?.id === currentUserId && i.assessmentType === "Reassessment");
      } else if (subTab === "returned") {
        data = data.filter((i) => i.assessor?.id === currentUserId && (i.status === "Returned" || i.status === "Rejected"));
      } else {
        // Main my queue: assigned to me, active statuses
        data = data.filter((i) => i.assessor?.id === currentUserId && ["Submitted", "Under Review"].includes(i.status));
      }
    }

    // Due Diligence
    if (activeTab === "due-diligence") {
      if (subTab === "unassigned") {
        // Submitted assessments with no assessor assigned
        data = data.filter((i) => i.status === "Submitted" && !i.assessor);
      } else if (subTab === "assigned") {
        data = data.filter((i) => !!i.assessor && ["Submitted", "Under Review"].includes(i.status));
      } else if (subTab === "completed") {
        data = data.filter((i) => ["Completed", "Approved", "Reviewed"].includes(i.status));
      } else {
        // Awaiting response: draft/in-progress (vendor hasn't submitted yet)
        data = data.filter((i) => ["Draft", "In Progress"].includes(i.status));
      }
    }

    // Reassessments
    if (activeTab === "reassessments") {
      data = data.filter((i) => i.assessmentType === "Reassessment" || i.assessmentType === "Periodic Assessment");
      if (subTab === "unassigned") {
        data = data.filter((i) => i.status === "Submitted" && !i.assessor);
      } else if (subTab === "assigned") {
        data = data.filter((i) => !!i.assessor && ["Submitted", "Under Review"].includes(i.status));
      } else if (subTab === "completed") {
        data = data.filter((i) => ["Completed", "Approved", "Reviewed"].includes(i.status));
      } else {
        data = data.filter((i) => ["Draft", "In Progress"].includes(i.status));
      }
    }

    // Offboarding — use separate offboard data
    if (activeTab === "offboarding") {
      let offData = translatedOffboardItems;
      if (subTab === "terminated") {
        offData = offData.filter((i) => i.status === "Offboard_Completed");
      } else {
        offData = offData.filter((i) => i.status === "Offboard_Approve_Assessor");
      }
      if (search) {
        const q = search.toLowerCase();
        offData = offData.filter(
          (i) =>
            i.assessmentCode?.toLowerCase().includes(q) ||
            i.vendor?.name?.toLowerCase().includes(q) ||
            i.vendor?.serviceCategory?.toLowerCase().includes(q)
        );
      }
      return offData;
    }

    // Completed
    if (activeTab === "completed") {
      data = data.filter((i) => ["Completed", "Approved", "Reviewed"].includes(i.status));
    }

    // Text search
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (i) =>
          i.assessmentCode?.toLowerCase().includes(q) ||
          i.vendor?.name?.toLowerCase().includes(q) ||
          i.vendor?.serviceCategory?.toLowerCase().includes(q)
      );
    }

    // Date filter
    if (dateFilter) {
      data = data.filter((i) => {
        const d = i.vendorSubmissionDate || i.completionDate;
        return d && d.startsWith(dateFilter);
      });
    }

    return data;
  }, [translatedItems, translatedOffboardItems, activeTab, subTab, search, dateFilter, currentUserId, isApprover]);

  // Determine if current sub-tab is "unassigned" or "assigned"
  const isUnassignedQueue = (activeTab === "due-diligence" || activeTab === "reassessments") && subTab === "unassigned";
  const isAssignedQueue = (activeTab === "due-diligence" || activeTab === "reassessments") && subTab === "assigned";

  // My Queue columns
  const myQueueColumns: ColumnDef<AssessmentItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "assessmentType",
      header: t("Assessment Type"),
      cell: ({ row }) => t(row.getValue("assessmentType") as string),
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Submission Date"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => <Badge variant={getStatusVariant(row.getValue("status"))}>{t(row.getValue("status") as string)}</Badge>,
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(`/tprm/asr-assessments/${row.original.id}`, "_self")}
        >
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  // Unassigned queue columns (with Assign button)
  const unassignedColumns: ColumnDef<AssessmentItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor Name"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "assessmentType",
      header: t("Assessment Type"),
      cell: ({ row }) => t(row.getValue("assessmentType") as string),
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Date of Submission"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => isAuditor ? (
        <Button variant="ghost" size="sm" onClick={() => window.open(`/tprm/asr-assessments/${row.original.id}`, "_self")}>
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openAssignDialog(row.original)}
        >
          <UserPlus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Assign")}
        </Button>
      ),
    },
  ];

  // Due Diligence / general columns
  const dueDiligenceColumns: ColumnDef<AssessmentItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor Name"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "assessor.fullName",
      header: t("Assessor"),
      cell: ({ row }) => row.original.assessor?.fullName || "-",
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Date of Submission"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => <Badge variant={getStatusVariant(row.getValue("status"))}>{t(row.getValue("status") as string)}</Badge>,
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(`/tprm/asr-assessments/${row.original.id}`, "_self")}
        >
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  // Assigned queue columns (with Reassign button)
  const assignedColumns: ColumnDef<AssessmentItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor Name"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: isApprover ? "approver.fullName" : "assessor.fullName",
      header: isApprover ? t("Approver") : t("Assessor"),
      cell: ({ row }) => isApprover
        ? row.original.approver?.fullName || "-"
        : row.original.assessor?.fullName || "-",
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Date of Submission"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => <Badge variant={getStatusVariant(row.getValue("status"))}>{t(row.getValue("status") as string)}</Badge>,
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => isAuditor ? (
        <Button variant="ghost" size="sm" onClick={() => window.open(`/tprm/asr-assessments/${row.original.id}`, "_self")}>
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openReassignDialog(row.original)}
        >
          <RotateCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Reassign")}
        </Button>
      ),
    },
  ];

  // Reassessment columns
  const reassessmentColumns: ColumnDef<AssessmentItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Date of Submission"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
  ];

  // Offboarding columns
  const offboardingColumns: ColumnDef<AssessmentItem>[] = [
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "assessmentCode",
      header: t("Assessment Code"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "initiatedBy.fullName",
      header: t("Initiated By"),
      cell: ({ row }) => row.original.initiatedBy?.fullName || "-",
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => <Badge variant={getStatusVariant(row.getValue("status"))}>{t(row.getValue("status") as string)}</Badge>,
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Submitted Date"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (row.original.assessmentType === "Offboard Assessment") {
              router.push(`/tprm/offboard-review/${row.original.id}?role=assessor`);
            } else {
              window.open(`/tprm/asr-assessments/${row.original.id}`, "_self");
            }
          }}
        >
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  // Completed columns
  const completedColumns: ColumnDef<AssessmentItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor Name"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "assessmentResult",
      header: t("Assessment Result"),
      cell: ({ row }) => {
        const result = row.getValue("assessmentResult") as string;
        return result ? (
          <Badge variant={result === "Satisfactory" ? "default" : "destructive"}>{t(result)}</Badge>
        ) : (
          "-"
        );
      },
    },
    {
      accessorKey: "completionDate",
      header: t("Date"),
      cell: ({ row }) => formatDate(row.getValue("completionDate") || row.original.vendorSubmissionDate),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(`/tprm/asr-assessments/${row.original.id}`, "_self")}
        >
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  const getColumns = () => {
    if (isUnassignedQueue) return unassignedColumns;
    if (isAssignedQueue) return assignedColumns;
    switch (activeTab) {
      case "my-queue":
        return subTab === "reassessment"
          ? reassessmentColumns
          : subTab === "returned"
          ? [...myQueueColumns.slice(0, -1), {
              accessorKey: "approverComment",
              header: t("Approver Comment"),
              cell: ({ row }: { row: { getValue: (key: string) => string } }) => (
                <span className="text-sm truncate max-w-[200px] inline-block">
                  {row.getValue("approverComment") || "-"}
                </span>
              ),
            } as ColumnDef<AssessmentItem>, myQueueColumns[myQueueColumns.length - 1]]
          : myQueueColumns;
      case "due-diligence":
        return subTab === "awaiting" ? dueDiligenceColumns.filter(c => c.id !== "actions") : dueDiligenceColumns;
      case "reassessments":
        return subTab === "awaiting" ? reassessmentColumns : reassessmentColumns;
      case "offboarding":
        return offboardingColumns;
      case "completed":
        return completedColumns;
      default:
        return myQueueColumns;
    }
  };

  // Sub-tab definitions
  const getSubTabs = () => {
    switch (activeTab) {
      case "my-queue":
        return [
          { value: "main", label: t("My Queue") },
          { value: "reassessment", label: t("Initiate Reassessment") },
          { value: "returned", label: t("Returned") },
        ];
      case "due-diligence":
        return isApprover ? [
          { value: "awaiting", label: t("Awaiting Response") },
          { value: "assigned", label: t("Assigned Queue") },
          { value: "completed", label: t("Completed") },
        ] : [
          { value: "awaiting", label: t("Awaiting Response") },
          { value: "unassigned", label: t("Unassigned Queue") },
          { value: "assigned", label: t("Assigned Queue") },
          { value: "completed", label: t("Completed") },
        ];
      case "reassessments":
        return isApprover ? [
          { value: "awaiting", label: t("Awaiting Response") },
          { value: "assigned", label: t("Assigned Queue") },
          { value: "completed", label: t("Completed") },
        ] : [
          { value: "awaiting", label: t("Awaiting Response") },
          { value: "unassigned", label: t("Unassigned Queue") },
          { value: "assigned", label: t("Assigned Queue") },
          { value: "completed", label: t("Completed") },
        ];
      case "offboarding":
        return [
          { value: "main", label: t("Offboard Approval") },
          { value: "terminated", label: t("Terminated Vendors") },
        ];
      default:
        return [];
    }
  };

  const subTabs = getSubTabs();

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessments")}</span>
      </nav>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="my-queue">{t("My Queue")}</TabsTrigger>
          <TabsTrigger value="due-diligence">{t("Due Diligence")}</TabsTrigger>
          <TabsTrigger value="reassessments">{t("Reassessments")}</TabsTrigger>
          <TabsTrigger value="offboarding">{t("Offboarding")}</TabsTrigger>
          <TabsTrigger value="completed">{t("Completed")}</TabsTrigger>
        </TabsList>

        <div className="mt-4 space-y-4">
          {/* Sub-tabs if applicable */}
          {subTabs.length > 0 && (
            <div className="flex gap-0 rounded-lg overflow-hidden border">
              {subTabs.map((st) => (
                <button
                  key={st.value}
                  onClick={() => setSubTab(st.value)}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                    subTab === st.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t("Search by vendor Name, Assessment ID, Service Category")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[180px]"
                placeholder={t("Submission Date")}
              />
            </div>
          </div>

          {/* Table content */}
          {["my-queue", "due-diligence", "reassessments", "offboarding", "completed"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DataGrid columns={getColumns()} data={filteredItems} hideSearch />
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Assign Assessment Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Assign Assessment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {assigningAssessment && (
              <div className="text-sm space-y-1">
                <p><span className="font-medium">{t("Assessment")}:</span> {assigningAssessment.assessmentCode}</p>
                <p><span className="font-medium">{t("Vendor")}:</span> {assigningAssessment.vendor?.name}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1.5">{t("Select Assessor")}</label>
              <Select value={selectedAssessorId} onValueChange={setSelectedAssessorId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Choose an assessor...")} />
                </SelectTrigger>
                <SelectContent>
                  {assessors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedAssessorId}>
              {assigning && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Assessment Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Reassign Assessment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {reassigningAssessment && (
              <div className="text-sm space-y-1">
                <p><span className="font-medium">{t("Assessment")}:</span> {reassigningAssessment.assessmentCode}</p>
                <p><span className="font-medium">{t("Vendor")}:</span> {reassigningAssessment.vendor?.name}</p>
                <p><span className="font-medium">{isApprover ? t("Current Approver") : t("Current Assessor")}:</span>{" "}
                  {isApprover ? reassigningAssessment.approver?.fullName || "-" : reassigningAssessment.assessor?.fullName || "-"}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1.5">
                {isApprover ? t("Select Approver") : t("Select Assessor")}
              </label>
              <Select value={selectedReassignId} onValueChange={setSelectedReassignId}>
                <SelectTrigger>
                  <SelectValue placeholder={isApprover ? t("Choose an approver...") : t("Choose an assessor...")} />
                </SelectTrigger>
                <SelectContent>
                  {reassignTargets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleReassign} disabled={reassigning || !selectedReassignId}>
              {reassigning && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Reassign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
