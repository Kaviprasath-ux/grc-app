"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  FileText,
  Upload,
  Download,
  Trash2,
  Plus,
  Check,
  Link2,
  Eye,
  MessageSquare,
  Send,
  Calendar,
  X,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Layers,
  Home,
  ChevronRight,
  Pencil,
  Save,
  Search,
} from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { EvidenceAIReview } from "@/components/evidence/EvidenceAIReview";

// Cycle status types
type CycleStatus = "none" | "submitted" | "validated" | "rejected";

interface CycleStatusData {
  status: CycleStatus;
  aiReviewStatus: "none" | "pending" | "completed";
  aiReviewResult?: string;
}

interface EvidenceComment {
  id: string;
  content: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

interface CycleComment {
  id: string;
  evidenceId: string;
  cyclePeriod: string;
  action: string;
  comment: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

interface LinkedKPI {
  id: string;
  code: string;
  objective: string | null;
  description: string | null;
  dataSource: string | null;
  calculationFormula: string | null;
  expectedScore: number | null;
  actualScore: number | null;
  reviewDate: string | null;
  status: string;
  departmentId: string | null;
  evidenceId: string | null;
}

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  domain: string | null;
  recurrence: string | null;
  reviewDate: string | null;
  status: string;
  publishedAt: string | null;
  departmentId: string | null;
  assigneeId: string | null;
  kpiRequired: boolean;
  kpiObjective: string | null;
  kpiDataSource: string | null;
  kpiExpectedScore: number | null;
  kpiDescription: string | null;
  kpiCalculationFormula: string | null;
  framework?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
  evidenceControls?: Array<{
    id: string;
    control: {
      id: string;
      controlCode: string;
      name: string;
      description: string | null;
      entities: string;
      domain?: { name: string } | null;
    };
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string | null;
    uploadedAt: string;
  }>;
  linkedArtifacts?: Array<{
    id: string;
    createdAt: string;
    artifact: {
      id: string;
      artifactCode: string;
      name: string;
      fileName: string;
    };
  }>;
  comments?: EvidenceComment[];
  frameworks?: Array<{ id: string; name: string }>;
  kpis?: LinkedKPI[];
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId: string | null;
}

interface Framework {
  id: string;
  name: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  entities: string;
  functionalGrouping?: string;
  domain?: { id: string; name: string } | null;
  framework?: { id: string; name: string } | null;
}

interface ControlDomain {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-slate-100 text-slate-600",
  Pending: "bg-amber-50 text-amber-700",
  Submitted: "bg-indigo-50 text-indigo-700",
  Draft: "bg-warning-light text-warning-dark",
  Validated: "bg-info-light text-info-dark",
  Approved: "bg-emerald-50 text-emerald-700",
  Published: "bg-success-light text-success-dark",
  "Need Attention": "bg-error-light text-error-dark",
  Overdue: "bg-red-50 text-red-700",
};

const recurrenceOptions = ["Yearly", "Half-yearly", "Quarterly", "Monthly"];

// Helper function to get period labels based on recurrence value
const getPeriodsForRecurrence = (recurrence: string | null): string[] => {
  switch (recurrence) {
    case "Monthly":
      return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    case "Quarterly":
      return ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];
    case "Half-yearly":
      return ["Jan–Jun", "Jul–Dec"];
    case "Yearly":
      return ["Jan–Dec"];
    default:
      return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  }
};

// Helper function to get current cycle based on today's date and recurrence
const getCurrentCycle = (recurrence: string | null): string => {
  const now = new Date();
  const monthIndex = now.getMonth(); // 0-11
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  switch (recurrence) {
    case "Monthly":
      return monthNames[monthIndex];
    case "Quarterly":
      if (monthIndex <= 2) return "Jan–Mar";
      if (monthIndex <= 5) return "Apr–Jun";
      if (monthIndex <= 8) return "Jul–Sep";
      return "Oct–Dec";
    case "Half-yearly":
      if (monthIndex <= 5) return "Jan–Jun";
      return "Jul–Dec";
    case "Yearly":
      return "Jan–Dec";
    default:
      return monthNames[monthIndex];
  }
};

// Local storage key helpers for cycle status
const getCycleStatusKey = (evidenceId: string, period: string): string => {
  return `evidence-${evidenceId}-cycle-${period}-status`;
};

const getCycleStatusFromStorage = (evidenceId: string, period: string): CycleStatusData => {
  if (typeof window === "undefined") {
    return { status: "none", aiReviewStatus: "none" };
  }
  const key = getCycleStatusKey(evidenceId, period);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { status: "none", aiReviewStatus: "none" };
    }
  }
  return { status: "none", aiReviewStatus: "none" };
};

const setCycleStatusToStorage = (evidenceId: string, period: string, data: CycleStatusData): void => {
  if (typeof window === "undefined") return;
  const key = getCycleStatusKey(evidenceId, period);
  localStorage.setItem(key, JSON.stringify(data));
};

export default function EvidenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const id = params.id as string;

  // Context from framework navigation
  const fromFramework = searchParams.get("from") === "framework";
  const frameworkId = searchParams.get("frameworkId");
  const frameworkName = searchParams.get("frameworkName") ? decodeURIComponent(searchParams.get("frameworkName")!) : null;

  const isGRCAdmin = session?.user?.roles?.includes("GRCAdministrator");
  const isCustomerAdmin = session?.user?.roles?.includes("CustomerAdministrator");
  const isDepartmentReviewer = session?.user?.roles?.includes("DepartmentReviewer");
  const isDepartmentContributor = session?.user?.roles?.includes("DepartmentContributor");
  const isReviewer = session?.user?.roles?.includes("Reviewer");
  const isContributor = session?.user?.roles?.includes("Contributor");
  const currentUserId = session?.user?.id;

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"controls" | "artifacts">("controls");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [linkControlsOpen, setLinkControlsOpen] = useState(false);
  const [editAssigneeOpen, setEditAssigneeOpen] = useState(false);

  // Cycle status state (per-cycle approval workflow)
  const [cycleStatuses, setCycleStatuses] = useState<Record<string, CycleStatusData>>({});

  // Publish validation dialog
  const [publishBlockedMessage, setPublishBlockedMessage] = useState<string | null>(null);

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);

  // Control linking
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearchQuery, setControlSearchQuery] = useState("");
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);
  const [controlDomainFilter, setControlDomainFilter] = useState("all");
  const [controlFunctionalGroupingFilter, setControlFunctionalGroupingFilter] = useState("all");
  const [controlFrameworkFilter, setControlFrameworkFilter] = useState("all");

  // KPI form
  const [kpiForm, setKpiForm] = useState({
    kpiObjective: "",
    kpiDataSource: "",
    kpiExpectedScore: "",
    kpiDescription: "",
    kpiCalculationFormula: "",
  });
  const [kpiFormErrors, setKpiFormErrors] = useState<Record<string, string>>({});
  const [kpiEditMode, setKpiEditMode] = useState(false);
  const [kpiSaving, setKpiSaving] = useState(false);

  // KPI Actual Score state
  const [kpiActualScoreDialogOpen, setKpiActualScoreDialogOpen] = useState(false);
  const [kpiActualScoreValue, setKpiActualScoreValue] = useState("");
  const [kpiActualScoreSaving, setKpiActualScoreSaving] = useState(false);
  const [kpiActualScoreEditMode, setKpiActualScoreEditMode] = useState(true); // Start in edit mode if no value

  // Comment state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Send Back / Resubmit / View Comments dialog state
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false);
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [viewCycleCommentsOpen, setViewCycleCommentsOpen] = useState(false);
  const [cycleComment, setCycleComment] = useState("");
  const [cycleComments, setCycleComments] = useState<CycleComment[]>([]);
  const [cycleCommentSubmitting, setCycleCommentSubmitting] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Upload attachment state (Customer Admin)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachmentDate, setAttachmentDate] = useState<string>("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Link artifacts state
  const [linkArtifactsDialogOpen, setLinkArtifactsDialogOpen] = useState(false);
  const [availableArtifacts, setAvailableArtifacts] = useState<Array<{
    id: string;
    artifactCode: string;
    name: string;
    fileName: string;
  }>>([]);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
  const [artifactSearchQuery, setArtifactSearchQuery] = useState("");
  const [linkingArtifacts, setLinkingArtifacts] = useState(false);

  const fetchEvidence = useCallback(async () => {
    try {
      const response = await fetch(`/api/evidences/${id}`);
      if (response.ok) {
        const data = await response.json();
        setEvidence(data);

        // If a linked KPI exists, prefer its data; otherwise use evidence KPI fields
        const linkedKpi = data.kpis?.[0];
        if (linkedKpi) {
          setKpiForm({
            kpiObjective: linkedKpi.objective || data.kpiObjective || "",
            kpiDataSource: linkedKpi.dataSource || data.kpiDataSource || "",
            kpiExpectedScore: linkedKpi.expectedScore?.toString() || data.kpiExpectedScore?.toString() || "",
            kpiDescription: linkedKpi.description || data.kpiDescription || "",
            kpiCalculationFormula: linkedKpi.calculationFormula || data.kpiCalculationFormula || "",
          });
          // Initialize KPI Actual Score value and edit mode
          setKpiActualScoreValue(linkedKpi.actualScore?.toString() || "");
          // If actual score exists, start in non-edit mode (show edit icon)
          setKpiActualScoreEditMode(linkedKpi.actualScore === null || linkedKpi.actualScore === undefined);
          // KPI exists, so show view mode (Edit button)
          setKpiEditMode(false);
        } else {
          setKpiForm({
            kpiObjective: data.kpiObjective || "",
            kpiDataSource: data.kpiDataSource || "",
            kpiExpectedScore: data.kpiExpectedScore?.toString() || "",
            kpiDescription: data.kpiDescription || "",
            kpiCalculationFormula: data.kpiCalculationFormula || "",
          });
          // No KPI exists yet, so show edit mode (Save button)
          setKpiEditMode(true);
        }
      }
    } catch (error) {
      console.error("Error fetching evidence:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [deptRes, usersRes, fwRes, controlsRes, controlDomainsRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users?role=DepartmentContributor"),
        fetch("/api/frameworks"),
        fetch("/api/controls?limit=1000"),
        fetch("/api/control-domains"),
      ]);

      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.data || data || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || data || []);
      }
      if (fwRes.ok) {
        const data = await fwRes.json();
        setFrameworks(data.data || data || []);
      }
      if (controlsRes.ok) {
        const data = await controlsRes.json();
        setControls(data.data || data || []);
      }
      if (controlDomainsRes.ok) {
        const data = await controlDomainsRes.json();
        setControlDomains(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchEvidence();
    fetchReferenceData();
  }, [fetchEvidence, fetchReferenceData]);

  // Set default selected period to current cycle for ALL roles
  useEffect(() => {
    if (evidence && !selectedMonth) {
      const currentCyclePeriod = getCurrentCycle(evidence.recurrence);
      setSelectedMonth(currentCyclePeriod);
    }
  }, [evidence, selectedMonth]);

  // Load cycle statuses from localStorage
  useEffect(() => {
    if (evidence?.id) {
      const periods = getPeriodsForRecurrence(evidence.recurrence);
      const statuses: Record<string, CycleStatusData> = {};
      periods.forEach((period) => {
        statuses[period] = getCycleStatusFromStorage(evidence.id, period);
      });
      setCycleStatuses(statuses);
    }
  }, [evidence?.id, evidence?.recurrence]);

  // Auto-revert parent status: If parent is "Validated" but current cycle is not validated, revert to "Draft"
  // This runs on page load/data fetch to handle cycle changes over time
  useEffect(() => {
    const syncParentStatusWithCurrentCycle = async () => {
      if (!evidence?.id || !evidence.recurrence) return;

      // Safety: Never downgrade from Published
      if (evidence.status === "Published") return;

      // Only check if parent status is currently "Validated"
      if (evidence.status !== "Validated") return;

      // Get current cycle and its validation status
      const currentCycleKey = getCurrentCycle(evidence.recurrence);
      const currentCycleStatus = getCycleStatusFromStorage(evidence.id, currentCycleKey);

      // If current cycle is NOT validated, revert parent to Draft
      if (currentCycleStatus.status !== "validated") {
        try {
          const response = await fetch(`/api/evidences/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Draft" }),
          });

          if (response.ok) {
            fetchEvidence();
            toast.info(t("Status reverted to Draft: Current cycle is not validated."));
          }
        } catch (error) {
          console.error("Error reverting parent status:", error);
        }
      }
    };

    syncParentStatusWithCurrentCycle();
  }, [evidence?.id, evidence?.recurrence, evidence?.status, id, fetchEvidence]);

  // Helper: Check if current user is the assignee
  const isAssignee = evidence?.assigneeId === currentUserId;

  // Helper: Can validate/reject (DepartmentReviewer only)
  const canValidateReject = isDepartmentReviewer;

  // Helper: Get current cycle
  const currentCycle = evidence ? getCurrentCycle(evidence.recurrence) : null;

  // Helper: Get cycle status for selected period
  const getSelectedCycleStatus = (): CycleStatusData => {
    if (!selectedMonth) return { status: "none", aiReviewStatus: "none" };
    return cycleStatuses[selectedMonth] || { status: "none", aiReviewStatus: "none" };
  };

  // Helper: Update cycle status
  const updateCycleStatus = (period: string, data: Partial<CycleStatusData>) => {
    if (!evidence?.id) return;
    const currentData = cycleStatuses[period] || { status: "none", aiReviewStatus: "none" };
    const newData = { ...currentData, ...data };
    setCycleStatuses((prev) => ({ ...prev, [period]: newData }));
    setCycleStatusToStorage(evidence.id, period, newData);
  };

  // Handler: Submit for Approval (DepartmentReviewer only)
  const handleSubmitForApproval = () => {
    if (!selectedMonth) return;

    // Validate: Must have attachment for this cycle
    if (!selectedCycleHasAttachments) {
      toast.error(t("Please upload an attachment for this cycle first."));
      return;
    }

    updateCycleStatus(selectedMonth, { status: "submitted" });
    toast.success(t("Submitted for approval successfully."));
  };

  // Handler: Validate (CustomerAdmin or Assignee)
  const handleValidate = async () => {
    if (!selectedMonth) return;

    // Update cycle status to validated
    updateCycleStatus(selectedMonth, { status: "validated" });

    // If validated cycle is the current cycle, update parent status to Validated
    if (selectedMonth === currentCycle) {
      try {
        const response = await fetch(`/api/evidences/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Validated" }),
        });

        if (response.ok) {
          fetchEvidence();
          toast.success(`${t(selectedMonth || "")} ${t("cycle validated. Evidence status updated to Validated.")}`);
        } else {
          toast.success(`${t(selectedMonth || "")} ${t("cycle validated successfully.")}`);
        }
      } catch (error) {
        console.error("Error updating parent status:", error);
        toast.success(`${t(selectedMonth || "")} ${t("cycle validated successfully.")}`);
      }
    } else {
      toast.success(`${t(selectedMonth || "")} ${t("cycle validated successfully.")}`);
    }
  };

  // Fetch cycle comments for a specific period
  const fetchCycleComments = async (period: string) => {
    if (!evidence?.id) return;
    try {
      const res = await fetch(`/api/evidences/${evidence.id}/cycle-comments?cyclePeriod=${encodeURIComponent(period)}`);
      if (res.ok) {
        const data = await res.json();
        setCycleComments(data);
      }
    } catch (error) {
      console.error("Error fetching cycle comments:", error);
    }
  };

  // Handler: Open Send Back dialog
  const handleOpenSendBack = () => {
    if (!selectedMonth) return;
    setCycleComment("");
    fetchCycleComments(selectedMonth);
    setSendBackDialogOpen(true);
  };

  // Handler: Send Back with comment
  const handleSendBack = async () => {
    if (!selectedMonth || !cycleComment.trim() || !evidence?.id) return;
    setCycleCommentSubmitting(true);
    try {
      const res = await fetch(`/api/evidences/${evidence.id}/cycle-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cyclePeriod: selectedMonth,
          action: "sendback",
          comment: cycleComment.trim(),
        }),
      });
      if (res.ok) {
        updateCycleStatus(selectedMonth, { status: "rejected" });
        toast.info(`${t(selectedMonth || "")} ${t("cycle sent back.")}`);
        setSendBackDialogOpen(false);
        setCycleComment("");
      } else {
        toast.error(t("Failed to send back."));
      }
    } catch (error) {
      console.error("Error sending back:", error);
      toast.error(t("Failed to send back."));
    } finally {
      setCycleCommentSubmitting(false);
    }
  };

  // Handler: Open View Cycle Comments dialog (for validated state)
  const handleOpenViewCycleComments = (period?: string) => {
    const target = period || selectedMonth;
    if (!target) return;
    fetchCycleComments(target);
    setViewCycleCommentsOpen(true);
  };

  // Handler: Open Resubmit dialog
  const handleOpenResubmit = () => {
    if (!selectedMonth) return;
    setCycleComment("");
    fetchCycleComments(selectedMonth);
    setResubmitDialogOpen(true);
  };

  // Handler: Resubmit with comment
  const handleResubmit = async () => {
    if (!selectedMonth || !cycleComment.trim() || !evidence?.id) return;
    setCycleCommentSubmitting(true);
    try {
      const res = await fetch(`/api/evidences/${evidence.id}/cycle-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cyclePeriod: selectedMonth,
          action: "resubmit",
          comment: cycleComment.trim(),
        }),
      });
      if (res.ok) {
        updateCycleStatus(selectedMonth, { status: "submitted" });
        toast.success(`${t(selectedMonth || "")} ${t("cycle resubmitted.")}`);
        setResubmitDialogOpen(false);
        setCycleComment("");
      } else {
        toast.error(t("Failed to resubmit."));
      }
    } catch (error) {
      console.error("Error resubmitting:", error);
      toast.error(t("Failed to resubmit."));
    } finally {
      setCycleCommentSubmitting(false);
    }
  };

  // Handler: Publish with validation
  const handlePublishWithValidation = async () => {
    if (!currentCycle || !evidence) return;

    const currentCycleStatus = cycleStatuses[currentCycle];

    // Check if current cycle is validated
    if (!currentCycleStatus || currentCycleStatus.status !== "validated") {
      setPublishBlockedMessage(t("Current cycle document is not validated."));
      return;
    }

    // Proceed with publish
    await handleStatusChange("Published");
  };

  const handleInlineUpdate = async (field: string, value: string | boolean | number | null) => {
    try {
      const response = await fetch(`/api/evidences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error updating evidence:", error);
    }
  };

  // Helper function to calculate review date based on recurrence
  const calculateReviewDate = (recurrence: string): string => {
    const today = new Date();
    let reviewDate = new Date(today);

    switch (recurrence) {
      case "Monthly":
        reviewDate.setMonth(reviewDate.getMonth() + 1);
        break;
      case "Quarterly":
        reviewDate.setMonth(reviewDate.getMonth() + 3);
        break;
      case "Half-yearly":
        reviewDate.setMonth(reviewDate.getMonth() + 6);
        break;
      case "Yearly":
        reviewDate.setFullYear(reviewDate.getFullYear() + 1);
        break;
      default:
        reviewDate.setMonth(reviewDate.getMonth() + 1);
    }

    return reviewDate.toISOString();
  };

  // Handler for recurrence change - also updates review date
  const handleRecurrenceChange = async (value: string | null) => {
    try {
      const updates: Record<string, string | null> = {
        recurrence: value,
      };

      // Calculate and set review date if recurrence is selected
      if (value) {
        updates.reviewDate = calculateReviewDate(value);
      }

      const response = await fetch(`/api/evidences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error updating recurrence:", error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "Published") {
      updates.publishedAt = new Date().toISOString();
    }

    try {
      const response = await fetch(`/api/evidences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleUnpublish = async () => {
    await handleStatusChange("Draft");
  };

  const validateKpiForm = () => {
    const errors: Record<string, string> = {};
    if (!kpiForm.kpiObjective?.trim()) {
      errors.kpiObjective = t("KPI Objective cannot be empty");
    }
    if (!kpiForm.kpiDataSource?.trim()) {
      errors.kpiDataSource = t("Data Source cannot be empty");
    }
    if (!kpiForm.kpiExpectedScore?.trim()) {
      errors.kpiExpectedScore = t("KPI Expected Score cannot be empty");
    }
    if (!kpiForm.kpiDescription?.trim()) {
      errors.kpiDescription = t("KPI Description cannot be empty");
    }
    if (!kpiForm.kpiCalculationFormula?.trim()) {
      errors.kpiCalculationFormula = t("KPI Calculation Formula cannot be empty");
    }
    setKpiFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleKpiFieldChange = (field: string, value: string) => {
    setKpiForm({ ...kpiForm, [field]: value });
    if (kpiFormErrors[field]) {
      setKpiFormErrors({ ...kpiFormErrors, [field]: "" });
    }
  };

  const handleSaveKpi = async () => {
    // Validate required fields
    if (!validateKpiForm()) {
      return;
    }

    setKpiSaving(true);
    try {
      // First, save KPI fields to Evidence record
      const evidenceResponse = await fetch(`/api/evidences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpiObjective: kpiForm.kpiObjective || null,
          kpiDataSource: kpiForm.kpiDataSource || null,
          kpiExpectedScore: kpiForm.kpiExpectedScore ? parseFloat(kpiForm.kpiExpectedScore) : null,
          kpiDescription: kpiForm.kpiDescription || null,
          kpiCalculationFormula: kpiForm.kpiCalculationFormula || null,
        }),
      });

      if (!evidenceResponse.ok) {
        toast.error(t("Failed to save KPI details to evidence"));
        return;
      }

      // Check if a KPI already exists for this evidence
      const existingKpi = evidence?.kpis?.[0];

      // Prepare KPI data
      const kpiData = {
        objective: kpiForm.kpiObjective || null,
        description: kpiForm.kpiDescription || null,
        dataSource: kpiForm.kpiDataSource || null,
        calculationFormula: kpiForm.kpiCalculationFormula || null,
        expectedScore: kpiForm.kpiExpectedScore ? parseFloat(kpiForm.kpiExpectedScore) : null,
        actualScore: kpiActualScoreValue ? parseFloat(kpiActualScoreValue) : null,
        departmentId: evidence?.departmentId || null,
        reviewDate: evidence?.reviewDate || null,
        evidenceId: id,
        status: "Scheduled",
      };

      let kpiResponse;
      if (existingKpi) {
        // Update existing KPI
        kpiResponse = await fetch(`/api/kpis/${existingKpi.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kpiData),
        });
      } else {
        // Create new KPI - use evidence code as the KPI code
        kpiResponse = await fetch("/api/kpis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...kpiData,
            code: evidence?.evidenceCode || undefined, // Use evidence code as KPI code
          }),
        });
      }

      if (kpiResponse.ok) {
        toast.success(existingKpi ? t("KPI updated successfully!") : t("KPI created successfully!"));
        setKpiEditMode(false); // Switch to view mode (show Edit button)
        await fetchEvidence();
      } else {
        const errorData = await kpiResponse.json();
        toast.error(errorData.error || t("Failed to save KPI"));
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast.error(t("Failed to save KPI"));
    } finally {
      setKpiSaving(false);
    }
  };

  // Handler for saving KPI Actual Score (only saves actual score)
  const handleSaveKpiActualScore = async () => {
    const existingKpi = evidence?.kpis?.[0];

    if (!existingKpi?.id) {
      toast.error(t("Please save KPI details first before saving actual score"));
      return;
    }

    setKpiActualScoreSaving(true);
    try {
      // Update existing KPI with just the actual score
      const response = await fetch(`/api/kpis/${existingKpi.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualScore: kpiActualScoreValue ? parseFloat(kpiActualScoreValue) : null,
        }),
      });

      if (response.ok) {
        toast.success(t("KPI Actual Score saved successfully!"));
        setKpiActualScoreEditMode(false); // Switch to non-edit mode
        await fetchEvidence();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t("Failed to save KPI Actual Score"));
      }
    } catch (error) {
      console.error("Error saving KPI Actual Score:", error);
      toast.error(t("Failed to save KPI Actual Score"));
    } finally {
      setKpiActualScoreSaving(false);
    }
  };

  const handleLinkControls = async () => {
    try {
      const response = await fetch(`/api/evidences/${id}/controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlIds: selectedControlIds }),
      });

      if (response.ok) {
        setLinkControlsOpen(false);
        setSelectedControlIds([]);
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error linking controls:", error);
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    try {
      const response = await fetch(`/api/evidences/${id}/controls`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlId }),
      });

      if (response.ok) {
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error unlinking control:", error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/evidences/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment,
          userName: "Current User",
        }),
      });

      if (response.ok) {
        setNewComment("");
        setCommentDialogOpen(false);
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/evidences/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/compliance/evidence");
      }
    } catch (error) {
      console.error("Error deleting evidence:", error);
    }
  };

  // Upload attachment handler (Customer Admin)
  const handleUploadAttachment = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (attachmentDate) {
        formData.append("uploadedAt", new Date(attachmentDate).toISOString());
      }

      const response = await fetch(`/api/evidences/${id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSelectedFile(null);
        setAttachmentDate("");
        setUploadDialogOpen(false);

        // Update status to Draft if currently Not Uploaded
        if (evidence?.status === "Not Uploaded") {
          await fetch(`/api/evidences/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Draft" }),
          });
        }

        fetchEvidence();
        toast.success(t("Attachment uploaded successfully!"));
      } else {
        const error = await response.json();
        console.error("Upload failed:", error);
        toast.error(t("Failed to upload attachment"));
      }
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast.error(t("Failed to upload attachment"));
    } finally {
      setUploading(false);
    }
  };

  // Delete attachment handler (Customer Admin)
  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/evidences/${id}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Check if there will be any remaining attachments or linked artifacts after deletion
        const remainingAttachments = (evidence?.attachments?.length || 0) - 1; // Subtract 1 for the one being deleted
        const remainingLinkedArtifacts = evidence?.linkedArtifacts?.length || 0;

        // If no documents remain, set status back to "Not Uploaded"
        if (remainingAttachments <= 0 && remainingLinkedArtifacts === 0) {
          await fetch(`/api/evidences/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Not Uploaded" }),
          });
        }

        fetchEvidence();
        toast.success(t("Attachment deleted successfully!"));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
    }
  };

  // Fetch available artifacts for linking
  const fetchAvailableArtifacts = async () => {
    try {
      const response = await fetch("/api/artifacts");
      if (response.ok) {
        const data = await response.json();
        setAvailableArtifacts(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching artifacts:", error);
    }
  };

  // Link artifacts handler
  const handleLinkArtifacts = async () => {
    if (selectedArtifactIds.length === 0) return;

    setLinkingArtifacts(true);
    try {
      const response = await fetch(`/api/evidences/${id}/link-artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactIds: selectedArtifactIds }),
      });

      if (response.ok) {
        // Update status to Draft if currently "Not Uploaded"
        if (evidence?.status === "Not Uploaded") {
          await fetch(`/api/evidences/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Draft" }),
          });
        }

        setLinkArtifactsDialogOpen(false);
        setSelectedArtifactIds([]);
        setArtifactSearchQuery("");
        fetchEvidence();
        toast.success(t("Artifacts linked successfully!"));
      } else {
        toast.error(t("Failed to link artifacts"));
      }
    } catch (error) {
      console.error("Error linking artifacts:", error);
      toast.error(t("Failed to link artifacts"));
    } finally {
      setLinkingArtifacts(false);
    }
  };

  // Unlink artifact handler
  const handleUnlinkArtifact = async (artifactId: string) => {
    try {
      const response = await fetch(`/api/evidences/${id}/link-artifacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId }),
      });

      if (response.ok) {
        // Check if there will be any remaining attachments or linked artifacts after unlinking
        const remainingAttachments = evidence?.attachments?.length || 0;
        const remainingLinkedArtifacts = (evidence?.linkedArtifacts?.length || 0) - 1; // Subtract 1 for the one being unlinked

        // If no documents remain, set status back to "Not Uploaded"
        if (remainingAttachments === 0 && remainingLinkedArtifacts <= 0) {
          await fetch(`/api/evidences/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Not Uploaded" }),
          });
        }

        fetchEvidence();
        toast.success(t("Artifact unlinked successfully!"));
      }
    } catch (error) {
      console.error("Error unlinking artifact:", error);
    }
  };

  // Helper: Get month index from upload date
  const getMonthFromDate = (dateStr: string): number => {
    const date = new Date(dateStr);
    return date.getMonth(); // 0-11
  };

  // Helper: Map month index to period based on recurrence
  const getMonthPeriod = (monthIndex: number, recurrence: string | null): string => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    switch (recurrence) {
      case "Monthly":
        return monthNames[monthIndex];
      case "Quarterly":
        if (monthIndex <= 2) return "Jan–Mar";
        if (monthIndex <= 5) return "Apr–Jun";
        if (monthIndex <= 8) return "Jul–Sep";
        return "Oct–Dec";
      case "Half-yearly":
        if (monthIndex <= 5) return "Jan–Jun";
        return "Jul–Dec";
      case "Yearly":
        return "Jan–Dec";
      default:
        return monthNames[monthIndex];
    }
  };

  // Filter attachments by selected period
  const filteredAttachments = evidence?.attachments?.filter((att) => {
    if (!selectedMonth) return true; // Show all if no period selected
    const monthIndex = getMonthFromDate(att.uploadedAt);
    const period = getMonthPeriod(monthIndex, evidence.recurrence);
    return period === selectedMonth;
  }) || [];

  // Filter linked artifacts by selected period
  const filteredLinkedArtifacts = evidence?.linkedArtifacts?.filter((la) => {
    if (!selectedMonth) return true; // Show all if no period selected
    const monthIndex = getMonthFromDate(la.createdAt);
    const period = getMonthPeriod(monthIndex, evidence?.recurrence || null);
    return period === selectedMonth;
  }) || [];

  // Helper: Check if selected cycle has attachments (including linked artifacts)
  const selectedCycleHasAttachments = selectedMonth ? (filteredAttachments.length > 0 || filteredLinkedArtifacts.length > 0) : false;

  // Determine if evidence has any attachments or linked artifacts
  const hasAnyAttachments = (evidence?.attachments && evidence.attachments.length > 0) ||
    (evidence?.linkedArtifacts && evidence.linkedArtifacts.length > 0);

  // Get status step based on evidence state
  const getStatusStep = (status: string) => {
    // If no attachments, always show step 0 (Not Uploaded state)
    if (!hasAnyAttachments) {
      return -1; // All faded/inactive
    }

    switch (status) {
      case "Not Uploaded":
        // Has attachments but status not updated yet - treat as Draft
        return 1;
      case "Draft":
        return 1;
      case "Validated":
      case "Published":
        return 2;
      default:
        return hasAnyAttachments ? 1 : -1;
    }
  };

  // Filter users by selected department
  const filteredUsers = evidence?.departmentId
    ? users.filter((u) => u.departmentId === evidence.departmentId)
    : users;

  // Get linked control IDs for filtering
  const linkedControlIds = evidence?.evidenceControls?.map((ec) => ec.control.id) || [];

  // Functional grouping options for filter
  const functionalGroupings = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

  // Filter out already linked controls and apply search/filter criteria
  const availableControls = controls.filter((c) => {
    // First, exclude already linked controls
    if (linkedControlIds.includes(c.id)) return false;

    // Search filter
    if (controlSearchQuery.trim()) {
      const query = controlSearchQuery.toLowerCase().trim();
      const matchesCode = c.controlCode?.toLowerCase().includes(query);
      const matchesName = c.name?.toLowerCase().includes(query);
      if (!matchesCode && !matchesName) return false;
    }

    // Domain filter
    if (controlDomainFilter !== "all" && c.domain?.id !== controlDomainFilter) {
      return false;
    }

    // Functional grouping filter
    if (controlFunctionalGroupingFilter !== "all" && c.functionalGrouping !== controlFunctionalGroupingFilter) {
      return false;
    }

    // Framework filter
    if (controlFrameworkFilter !== "all" && c.framework?.id !== controlFrameworkFilter) {
      return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-label={t("Loading...")}></div>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">{t("Evidence not found")}</div>
      </div>
    );
  }

  const currentStep = getStatusStep(evidence.status);

  // GRC Admin View - Simplified
  if (isGRCAdmin) {
    return (
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-b pb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/compliance/evidence")}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-slate-300">|</span>
            <h1 className="text-xl sm:text-2xl font-semibold text-primary-700">
              {evidence.domain || t("Evidence Details")}
            </h1>
          </div>
        </div>

        {/* Framework Badges */}
        <div className="flex flex-wrap gap-2">
          {evidence.frameworks && evidence.frameworks.length > 0 ? (
            evidence.frameworks.map((fw) => (
              <Badge key={fw.id} className="bg-primary-700 text-white hover:bg-primary-600">
                {fw.name}
              </Badge>
            ))
          ) : evidence.framework ? (
            <Badge className="bg-primary-700 text-white hover:bg-primary-600">
              {evidence.framework.name}
            </Badge>
          ) : null}
        </div>

        {/* Evidence Details Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-700">{t("Evidence Details")}</h2>
            <Button variant="ghost" size="icon" className="text-primary-700">
              <Eye className="h-5 w-5" />
            </Button>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Requirement")}</Label>
                  <p className="mt-1 text-slate-800">{evidence.name}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Recurrence")}</Label>
                  <Select
                    value={evidence.recurrence || ""}
                    onValueChange={(value) => handleRecurrenceChange(value || null)}
                  >
                    <SelectTrigger className="mt-1 w-48 bg-white">
                      <SelectValue placeholder={t("Select")} />
                    </SelectTrigger>
                    <SelectContent>
                      {recurrenceOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Artifact")}</Label>
                  <p className="mt-1 text-slate-800">{evidence.description || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t("Review date")}
                  </Label>

                  <div className="mt-1 flex items-center gap-2">
                    <DatePicker
                      value={
                        evidence.reviewDate
                          ? new Date(evidence.reviewDate)
                          : undefined
                      }
                      onChange={(date) =>
                        handleInlineUpdate(
                          "reviewDate",
                          date
                            ? new Date(
                              Date.UTC(
                                date.getFullYear(),
                                date.getMonth(),
                                date.getDate()
                              )
                            ).toISOString()
                            : null
                        )
                      }
                      placeholder={t("Select review date")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 sm:mt-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("artifacts")}
              className={`px-4 sm:px-6 py-2 rounded-t-lg font-medium transition-colors text-sm sm:text-base ${activeTab === "artifacts"
                ? "bg-primary-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              {t("Linked Artifact")}
            </button>
            <button
              onClick={() => setActiveTab("controls")}
              className={`px-4 sm:px-6 py-2 rounded-t-lg font-medium transition-colors text-sm sm:text-base ${activeTab === "controls"
                ? "bg-primary-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              {t("Linked Controls")}
            </button>
          </div>

          {/* Tab Content */}
          <div className="bg-slate-50 rounded-b-lg rounded-tr-lg p-3 sm:p-6">
            {activeTab === "controls" && (
              <div>
                <h3 className="text-lg font-semibold text-primary-700 mb-4">{t("Controls")}</h3>
                <div className="space-y-3">
                  {evidence.evidenceControls?.map((ec) => (
                    <div
                      key={ec.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all"
                      onClick={() => router.push(`/compliance/control/${ec.control.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-primary-700 font-medium hover:underline">
                            {ec.control.controlCode} : {ec.control.name}
                          </p>
                          {ec.control.description && (
                            <p className="text-slate-600 text-sm mt-1">{ec.control.description}</p>
                          )}
                        </div>
                        <Badge className="bg-primary-700 text-white hover:bg-primary-600">
                          {ec.control.entities || t("Organization Wide")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!evidence.evidenceControls || evidence.evidenceControls.length === 0) && (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t("No controls linked to this evidence")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "artifacts" && (
              <div>
                <h3 className="text-lg font-semibold text-primary-700 mb-4">{t("Artifacts")}</h3>
                <div className="space-y-3">
                  {evidence.linkedArtifacts?.map((la) => (
                    <div
                      key={la.id}
                      className="bg-white border border-slate-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary-600" />
                          <div>
                            <p className="font-medium">
                              {la.artifact.artifactCode} : {la.artifact.name}
                            </p>
                            <p className="text-sm text-slate-500">{la.artifact.fileName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!evidence.linkedArtifacts || evidence.linkedArtifacts.length === 0) && (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t("No artifacts linked to this evidence")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular User View - Full features
  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href={fromFramework ? "/roles/customer-administrator/compliance" : ""} className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        {fromFramework && frameworkId ? (
          <>
            <Link href="/roles/customer-administrator/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Integrated Frameworks")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <Link href={`/roles/customer-administrator/compliance/framework/${frameworkId}/evidence`} className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Evidence")}
            </Link>
          </>
        ) : (
          <Link href="/compliance/evidence" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Evidence")}
          </Link>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{evidence.evidenceCode}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{evidence.name}</h1>
          <Badge className={statusColors[evidence.status] || "bg-slate-100 text-slate-600"}>
            {t(evidence.status)}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCommentDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {t("Comments")} ({evidence.comments?.length || 0})
          </Button>
        </div>
      </div>
      <p className="text-slate-500">{evidence.evidenceCode}</p>

      {/* Status Workflow Steps */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-4 px-3 sm:px-6 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
        {/* Upload Step */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${currentStep >= 0 ? "bg-primary-600 text-white" : "bg-slate-200 text-slate-400"
              }`}
          >
            {currentStep > 0 ? <Check className="h-5 w-5 sm:h-6 sm:w-6" /> : <Upload className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>
          <span className={`text-xs sm:text-sm ${currentStep >= 0 ? "text-slate-800" : "text-slate-400"}`}>{t("Upload")}</span>
        </div>
        <div className={`w-12 sm:w-24 h-0.5 shrink-0 ${currentStep >= 1 ? "bg-primary-600" : "bg-slate-300"}`} />

        {/* Draft Step */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${currentStep >= 1 ? "bg-primary-600 text-white" : "bg-slate-200 text-slate-400"
              }`}
          >
            {currentStep > 1 ? <Check className="h-5 w-5 sm:h-6 sm:w-6" /> : <FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>
          <span className={`text-xs sm:text-sm ${currentStep >= 1 ? "text-slate-800" : "text-slate-400"}`}>{t("Draft")}</span>
        </div>
        <div className={`w-12 sm:w-24 h-0.5 shrink-0 ${currentStep >= 2 ? "bg-primary-600" : "bg-slate-300"}`} />

        {/* Publish Step */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${currentStep >= 2 ? "bg-primary-600 text-white" : "bg-slate-200 text-slate-400"
              }`}
          >
            {currentStep >= 2 ? <Check className="h-5 w-5 sm:h-6 sm:w-6" /> : <span className="text-base sm:text-lg font-medium">3</span>}
          </div>
          <span className={`text-xs sm:text-sm ${currentStep >= 2 ? "text-slate-800" : "text-slate-400"}`}>{t("Publish")}</span>
        </div>
      </div>

      {/* Publish Button - visible only for CustomerAdministrator and Reviewer roles */}
      {hasAnyAttachments && evidence.status !== "Published" && (isCustomerAdmin || isReviewer) && (
        <div className="flex justify-end">
          <Button onClick={handlePublishWithValidation} className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" />
            {t("Publish")}
          </Button>
        </div>
      )}

      {/* Linked Frameworks Indicator */}
      {(() => {
        // Compute linked frameworks from both evidence.frameworks array and single framework
        const linkedFrameworks: Array<{ id: string; name: string }> = [];
        if (evidence.frameworks && evidence.frameworks.length > 0) {
          linkedFrameworks.push(...evidence.frameworks);
        } else if (evidence.framework) {
          linkedFrameworks.push(evidence.framework);
        }
        const frameworkCount = linkedFrameworks.length;

        return (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg cursor-pointer hover:bg-primary-100 transition-colors">
                  <Layers className="h-4 w-4 text-primary-600" />
                  <span className="text-sm font-medium text-primary-700">
                    {t("Linked Frameworks:")} {frameworkCount}
                  </span>
                </div>
              </TooltipTrigger>
              {frameworkCount > 0 && (
                <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white p-2">
                  <div className="space-y-1">
                    <p className="font-medium text-xs text-slate-300">{t("Linked Frameworks:")}</p>
                    {linkedFrameworks.map((fw) => (
                      <p key={fw.id} className="text-sm">{fw.name}</p>
                    ))}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        );
      })()}

      {/* Main Content - Single Column Layout */}
      <div className="space-y-6">
        {/* Evidence Details */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Evidence Details")}</h3>
            <Button variant="ghost" size="icon">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Requirement")}</Label>
                <p>{evidence.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</Label>
                <p>{evidence.description || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</Label>
                <Select
                  value={evidence.departmentId || ""}
                  onValueChange={(value) => handleInlineUpdate("departmentId", value || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Assigned to")}</Label>
                  <Dialog open={editAssigneeOpen} onOpenChange={setEditAssigneeOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        {t("Edit Assignee")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("Edit Assignee")}</DialogTitle>
                      </DialogHeader>
                      <div className="py-4 space-y-2">
                        <Label>{t("Select Assignee")}</Label>

                        <Select
                          value={evidence.assigneeId || ""}
                          onValueChange={(value) => {
                            handleInlineUpdate("assigneeId", value || null);
                            setEditAssigneeOpen(false);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("Select assignee")} />
                          </SelectTrigger>

                          <SelectContent className="w-full">
                            {filteredUsers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p>{evidence.assignee?.fullName || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Recurrence")}</Label>
                <Select
                  value={evidence.recurrence || ""}
                  onValueChange={(value) => handleRecurrenceChange(value || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("Select recurrence")} />
                  </SelectTrigger>
                  <SelectContent>
                    {recurrenceOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t("Review Date")}
                </Label>

                <DatePicker
                  value={
                    evidence.reviewDate
                      ? new Date(evidence.reviewDate)
                      : undefined
                  }
                  onChange={(date) =>
                    handleInlineUpdate(
                      "reviewDate",
                      date
                        ? new Date(
                          Date.UTC(
                            date.getFullYear(),
                            date.getMonth(),
                            date.getDate()
                          )
                        ).toISOString()
                        : null
                    )
                  }
                  placeholder={t("Select review date")}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">{t("KPI Required")}</span>
              <Checkbox
                checked={evidence.kpiRequired}
                onCheckedChange={(checked) => handleInlineUpdate("kpiRequired", !!checked)}
              />
            </div>
          </div>
        </div>

        {/* KPI Details - Show if KPI Required */}
        {evidence.kpiRequired && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">{t("KPI Details")}</h3>
              {!kpiEditMode && evidence.kpis && evidence.kpis.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setKpiEditMode(true)}>
                  {t("Edit")}
                </Button>
              )}
            </div>
            <div className="p-3 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Objective")} <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder={t("Enter Objective")}
                    value={kpiForm.kpiObjective}
                    onChange={(e) => handleKpiFieldChange("kpiObjective", e.target.value)}
                    disabled={!kpiEditMode}
                    rows={3}
                    className={kpiFormErrors.kpiObjective ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}
                  />
                  {kpiFormErrors.kpiObjective && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{kpiFormErrors.kpiObjective}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Data Source")} <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder={t("Enter Data Source")}
                    value={kpiForm.kpiDataSource}
                    onChange={(e) => handleKpiFieldChange("kpiDataSource", e.target.value)}
                    disabled={!kpiEditMode}
                    rows={3}
                    className={kpiFormErrors.kpiDataSource ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}
                  />
                  {kpiFormErrors.kpiDataSource && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{kpiFormErrors.kpiDataSource}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Expected Score (%)")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    placeholder={t("Enter expected score")}
                    value={kpiForm.kpiExpectedScore}
                    onChange={(e) => handleKpiFieldChange("kpiExpectedScore", e.target.value)}
                    disabled={!kpiEditMode}
                    className={kpiFormErrors.kpiExpectedScore ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}
                  />
                  {kpiFormErrors.kpiExpectedScore && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{kpiFormErrors.kpiExpectedScore}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Description")} <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder={t("Enter KPI Description")}
                    value={kpiForm.kpiDescription}
                    onChange={(e) => handleKpiFieldChange("kpiDescription", e.target.value)}
                    disabled={!kpiEditMode}
                    rows={3}
                    className={kpiFormErrors.kpiDescription ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}
                  />
                  {kpiFormErrors.kpiDescription && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{kpiFormErrors.kpiDescription}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Calculation Formula")} <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder={t("Enter the KPI Calculation Formula")}
                    value={kpiForm.kpiCalculationFormula}
                    onChange={(e) => handleKpiFieldChange("kpiCalculationFormula", e.target.value)}
                    disabled={!kpiEditMode}
                    rows={3}
                    className={kpiFormErrors.kpiCalculationFormula ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}
                  />
                  {kpiFormErrors.kpiCalculationFormula && (
                    <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{kpiFormErrors.kpiCalculationFormula}</p>
                  )}
                </div>
                {/* KPI Actual Score - visible when KPI Expected Score AND Description are not empty */}
                {kpiForm.kpiExpectedScore && kpiForm.kpiDescription && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Actual Score")} <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={t("Enter actual score")}
                        value={kpiActualScoreValue}
                        onChange={(e) => setKpiActualScoreValue(e.target.value)}
                        disabled={!kpiActualScoreEditMode}
                        className="flex-1"
                      />
                      {kpiActualScoreEditMode ? (
                        <Button
                          variant="default"
                          size="icon"
                          className="bg-primary hover:bg-primary/90"
                          onClick={handleSaveKpiActualScore}
                          disabled={!kpiActualScoreValue || kpiActualScoreSaving || !evidence?.kpis?.[0]?.id}
                          title={!evidence?.kpis?.[0]?.id ? t("Save KPI details first") : t("Save actual score")}
                        >
                          {kpiActualScoreSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="icon"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => setKpiActualScoreEditMode(true)}
                          title={t("Edit actual score")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {kpiActualScoreEditMode && !evidence?.kpis?.[0]?.id && (
                      <p className="text-xs text-amber-600">{t("Save KPI details first to enable saving actual score")}</p>
                    )}
                  </div>
                )}
                {/* Empty placeholder when KPI Actual Score is not shown */}
                {!(kpiForm.kpiExpectedScore && kpiForm.kpiDescription) && <div></div>}
              </div>
              {kpiEditMode && (
                <div className="flex gap-2">
                  <Button onClick={handleSaveKpi} disabled={kpiSaving}>
                    {kpiSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("Saving...")}
                      </>
                    ) : (
                      t("Save")
                    )}
                  </Button>
                  {evidence.kpis && evidence.kpis.length > 0 && (
                    <Button variant="outline" onClick={() => setKpiEditMode(false)} disabled={kpiSaving}>
                      {t("Cancel")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Published Section */}
        {evidence.status === "Published" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">{t("Published")}</h3>
              <Button variant="outline" onClick={handleUnpublish} className="w-full sm:w-auto">
                {t("Unpublish")}
              </Button>
            </div>
            <div className="p-3 sm:p-5">
              <div className="space-y-2">
                {evidence.attachments?.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm text-slate-500">
                        {t("Published On:")} {new Date(att.uploadedAt).toLocaleString()}
                      </p>
                      <p className="font-medium">{att.fileName}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      {t("Download")}
                    </Button>
                  </div>
                ))}
                {(!evidence.attachments || evidence.attachments.length === 0) && (
                  <p className="text-slate-500 text-center py-4">{t("No published files")}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Attachments Card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Attachments")}</h3>
            <div className="flex flex-wrap gap-2">
              {(isCustomerAdmin || isReviewer || isContributor || isDepartmentReviewer || isDepartmentContributor) && (
                <Button size="sm" variant="outline" onClick={() => setUploadDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("Add Attachment")}
                </Button>
              )}
              {(isCustomerAdmin || isReviewer || isContributor || isDepartmentReviewer || isDepartmentContributor) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    fetchAvailableArtifacts();
                    setLinkArtifactsDialogOpen(true);
                  }}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  {t("Link Artifacts")}
                </Button>
              )}
            </div>
          </div>
          <div className="p-3 sm:p-5">
            {/* Period Buttons with Validation Status Tags - Based on recurrence for ALL roles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {getPeriodsForRecurrence(evidence.recurrence).map((period) => {
                const cycleStatus = cycleStatuses[period];
                const isCurrentCycle = period === currentCycle;

                return (
                  <div key={period} className="flex items-center gap-1">
                    <Button
                      variant={selectedMonth === period ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedMonth(selectedMonth === period ? null : period)}
                      className={`text-xs ${isCurrentCycle ? "ring-2 ring-primary-400" : ""}`}
                    >
                      <FileText className="h-3 w-3 me-1" />
                      {t(period)}
                    </Button>
                    {/* Validated/Rejected Tags */}
                    {cycleStatus?.status === "validated" && (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border-2 border-green-500 text-green-700 bg-green-50 rounded">
                          <CheckCircle className="h-3 w-3" />
                          {t("Validated")}
                        </span>
                        <button
                          onClick={() => handleOpenViewCycleComments(period)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                          title={t("View Comments")}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {cycleStatus?.status === "rejected" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border-2 border-red-500 text-red-700 bg-red-50 rounded">
                        <XCircle className="h-3 w-3" />
                        {t("Sent Back")}
                      </span>
                    )}
                    {cycleStatus?.status === "submitted" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border-2 border-yellow-500 text-yellow-700 bg-yellow-50 rounded">
                        <Clock className="h-3 w-3" />
                        {t("Pending")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI Review Section - Real AI Integration */}
            <EvidenceAIReview
              evidenceId={id}
              hasAttachments={hasAnyAttachments || false}
            />

            {/* Approval Workflow Buttons */}
            {selectedMonth && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                {/* Submit for Approval - DepartmentContributor only */}
                {isDepartmentContributor && getSelectedCycleStatus().status === "none" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSubmitForApproval}
                    className="border-primary-500 text-primary-600 hover:bg-primary-50"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {t("Submit for Approval")}
                  </Button>
                )}

                {/* Validate/Reject - CustomerAdmin OR Assignee, only when submitted */}
                {canValidateReject && getSelectedCycleStatus().status === "submitted" && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleValidate}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t("Validate")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenSendBack}
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t("Send Back")}
                    </Button>
                  </>
                )}

                {/* Status display when already validated/rejected */}
                {getSelectedCycleStatus().status === "validated" && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    {t("This cycle has been validated")}
                  </span>
                )}
                {getSelectedCycleStatus().status === "rejected" && isDepartmentContributor && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenResubmit}
                    className="border-orange-500 text-orange-600 hover:bg-orange-50"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {t("Resubmit")}
                  </Button>
                )}
                {getSelectedCycleStatus().status === "rejected" && !isDepartmentContributor && (
                  <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {t("This cycle has been sent back")}
                  </span>
                )}
                {getSelectedCycleStatus().status === "none" && !isDepartmentContributor && (
                  <span className="text-sm text-slate-500">
                    {t("Awaiting submission from Department Contributor")}
                  </span>
                )}
              </div>
            )}

            {/* Attachments List - Filtered by selected cycle for ALL roles */}
            <div className="space-y-2">
              {/* Regular Attachments */}
              {filteredAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50/60"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-600" />
                    <span className="text-sm">{att.fileName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                    {isCustomerAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAttachment(att.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {/* Linked Artifacts shown in Attachments section - filtered by selected period */}
              {filteredLinkedArtifacts.map((la) => (
                <div
                  key={`artifact-${la.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50/60 border-purple-200 bg-purple-50/30"
                >
                  <div className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-purple-600" />
                    <div>
                      <span className="text-sm font-medium">{la.artifact.artifactCode} : {la.artifact.name}</span>
                      <p className="text-xs text-slate-500">{la.artifact.fileName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                      {t("Linked")}
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                    {isCustomerAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUnlinkArtifact(la.artifact.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {filteredAttachments.length === 0 && filteredLinkedArtifacts.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-4">
                  {selectedMonth ? `${t("No attachments for")} ${t(selectedMonth)}` : t("No attachments")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Comments Card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-800">{t("Recent Comments")}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommentDialogOpen(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {t("Add Comment")}
              </Button>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            {evidence.comments && evidence.comments.length > 0 ? (
              <div className="space-y-3">
                {evidence.comments.slice(0, 3).map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {comment.userName || t("Unknown User")}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(comment.createdAt).toLocaleDateString(
                          "en-GB"
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{comment.content}</p>
                  </div>
                ))}
                {evidence.comments.length > 3 && (
                  <Button
                    variant="link"
                    className="w-full"
                    onClick={() => setCommentDialogOpen(true)}
                  >
                    {t("View all")} {evidence.comments.length} {t("comments")}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">
                {t("No comments yet")}
              </p>
            )}
          </div>
        </div>

        {/* Linked Section - Tabs: Linked Controls / Linked Artifacts */}
        <div>
          <div className="flex flex-wrap border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab("controls")}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap ${activeTab === "controls"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-slate-500"
                }`}
            >
              {t("Linked Controls")}
            </button>
            <button
              onClick={() => setActiveTab("artifacts")}
              className={`px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap ${activeTab === "artifacts"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-slate-500"
                }`}
            >
              {t("Linked Artifacts")}
            </button>
          </div>

          {activeTab === "controls" && (
            <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Controls")}</h3>
                <Dialog open={linkControlsOpen} onOpenChange={(open) => {
                  setLinkControlsOpen(open);
                  if (!open) {
                    setControlSearchQuery("");
                    setSelectedControlIds([]);
                    setControlDomainFilter("all");
                    setControlFunctionalGroupingFilter("all");
                    setControlFrameworkFilter("all");
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm">{t("Link Controls")}</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
                      <DialogTitle className="text-base font-semibold text-slate-800">{t("Link Control")}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                      {/* Filters */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                          <SelectTrigger className="bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <SelectValue placeholder={t("Domain")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("All Domains")}</SelectItem>
                            {controlDomains.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={controlFunctionalGroupingFilter} onValueChange={setControlFunctionalGroupingFilter}>
                          <SelectTrigger className="bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <SelectValue placeholder={t("Functional Grouping")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("All Groupings")}</SelectItem>
                            {functionalGroupings.map((g) => (
                              <SelectItem key={g} value={g}>{t(g)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={controlFrameworkFilter} onValueChange={setControlFrameworkFilter}>
                          <SelectTrigger className="bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <SelectValue placeholder={t("Framework")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                            {frameworks.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Search input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder={t("Search By Control Code , Name")}
                          value={controlSearchQuery}
                          onChange={(e) => setControlSearchQuery(e.target.value)}
                          className="pl-10 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                        />
                        {controlSearchQuery && (
                          <button
                            onClick={() => setControlSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Control cards list */}
                      <div className="border border-slate-200 rounded-lg max-h-[350px] overflow-y-auto">
                        {availableControls.map((control) => (
                          <div
                            key={control.id}
                            className={`flex items-start gap-3 p-4 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50/60 transition-colors ${selectedControlIds.includes(control.id) ? "bg-primary-50" : ""
                              }`}
                            onClick={() => {
                              setSelectedControlIds((prev) =>
                                prev.includes(control.id)
                                  ? prev.filter((id) => id !== control.id)
                                  : [...prev, control.id]
                              );
                            }}
                          >
                            <div onClick={(e) => e.stopPropagation()} className="pt-1">
                              <Checkbox
                                checked={selectedControlIds.includes(control.id)}
                                onCheckedChange={() => {
                                  setSelectedControlIds((prev) =>
                                    prev.includes(control.id)
                                      ? prev.filter((id) => id !== control.id)
                                      : [...prev, control.id]
                                  );
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-800">
                                  {control.controlCode} : {control.name}
                                </span>
                                <Badge className="bg-slate-100 text-slate-600 rounded-full px-3 text-xs font-medium">
                                  {control.entities || t("Organization Wide")}
                                </Badge>
                              </div>
                              {control.description && (
                                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{control.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {availableControls.length === 0 && (
                          <div className="p-8 text-center text-slate-400">
                            {controlSearchQuery.trim() || controlDomainFilter !== "all" || controlFunctionalGroupingFilter !== "all" || controlFrameworkFilter !== "all"
                              ? t("No controls found matching your filters")
                              : t("No available controls to link")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
                      <Button
                        onClick={handleLinkControls}
                        disabled={selectedControlIds.length === 0}
                        className="rounded-lg"
                      >
                        {t("Link Control")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-3 sm:p-5">
                <div className="space-y-2">
                  {evidence.evidenceControls?.map((ec) => (
                    <div
                      key={ec.id}
                      className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50/60 cursor-pointer hover:border-primary-300 transition-all"
                      onClick={() => router.push(`/compliance/control/${ec.control.id}`)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary-700 hover:underline">{ec.control.controlCode}</span>
                          <span>: {ec.control.name}</span>
                        </div>
                        {ec.control.description && (
                          <p className="text-sm text-slate-500 mt-1">{ec.control.description}</p>
                        )}
                        <Badge variant="secondary" className="mt-2">
                          {ec.control.entities}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlinkControl(ec.control.id);
                        }}
                      >
                        {t("Unlink")}
                      </Button>
                    </div>
                  ))}
                  {(!evidence.evidenceControls || evidence.evidenceControls.length === 0) && (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t("No controls linked to this evidence")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "artifacts" && (
            <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 sm:px-5 py-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Linked Artifacts")}</h3>
              </div>
              <div className="p-3 sm:p-5">
                <div className="space-y-2">
                  {evidence.linkedArtifacts?.map((la) => (
                    <div
                      key={la.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50/60"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary-600" />
                        <div>
                          <p className="font-medium">
                            {la.artifact.artifactCode} : {la.artifact.name}
                          </p>
                          <p className="text-sm text-slate-500">{la.artifact.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!evidence.linkedArtifacts || evidence.linkedArtifacts.length === 0) && (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t("No artifacts linked to this evidence")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comments Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Comments")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            {/* Comment List */}
            <div className="max-h-64 overflow-y-auto space-y-3">
              {evidence.comments && evidence.comments.length > 0 ? (
                evidence.comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-slate-800">
                        {comment.userName || t("Unknown User")}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.createdAt).toLocaleDateString("en-GB")}{" "}
                        {new Date(comment.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{comment.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">
                  {t("No comments yet")}
                </p>
              )}
            </div>
          </div>

          {/* Add Comment Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Add a comment")}</Label>
            <div className="flex items-end gap-2 mt-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t("Type your comment...")}
                rows={2}
                className="flex-1 text-sm bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:ring-offset-0 focus-visible:border-primary-300 transition-colors resize-none"
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
                size="icon"
                className="h-9 w-9 rounded-lg shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this evidence? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Attachment Dialog */}
      {(isCustomerAdmin || isReviewer || isContributor || isDepartmentReviewer || isDepartmentContributor) && (
        <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            setSelectedFile(null);
            setAttachmentDate("");
            setIsDraggingFile(false);
          }
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Evidence Attachment")}</DialogTitle>
            </div>
            <div className="px-4 sm:px-6 py-5 space-y-4">
              {/* Date Picker */}
              <div>
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Date")}</Label>
                <div className="mt-1.5">
                  <DatePicker
                    value={attachmentDate || undefined}
                    onChange={(date) => setAttachmentDate(date ? format(date, "yyyy-MM-dd") : "")}
                    placeholder={t("Select date")}
                  />
                </div>
              </div>

              {/* Drag and Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDraggingFile
                  ? "border-primary-400 bg-primary-50"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  const files = e.dataTransfer.files;
                  if (files.length > 0) {
                    setSelectedFile(files[0]);
                  }
                }}
                onClick={() => document.getElementById("attachment-file-input")?.click()}
              >
                <input
                  id="attachment-file-input"
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                />
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 mx-auto text-primary-500" />
                    <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("Drag and drop or select file.")}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button
                onClick={handleUploadAttachment}
                disabled={!selectedFile || uploading}
                className="rounded-lg"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {t("Submitting...")}
                  </>
                ) : (
                  t("Submit")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Publish Blocked Dialog */}
      <AlertDialog open={!!publishBlockedMessage} onOpenChange={() => setPublishBlockedMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <XCircle className="h-5 w-5" />
              {t("Cannot Publish")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {publishBlockedMessage}
              {currentCycle && (
                <p className="mt-2 text-sm">
                  {t("Current cycle:")} <span className="font-medium">{currentCycle}</span>
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link Artifacts Dialog */}
      <Dialog open={linkArtifactsDialogOpen} onOpenChange={(open) => {
        setLinkArtifactsDialogOpen(open);
        if (!open) {
          setSelectedArtifactIds([]);
          setArtifactSearchQuery("");
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Link Artifacts")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search by Artifact Code or Name...")}
                value={artifactSearchQuery}
                onChange={(e) => setArtifactSearchQuery(e.target.value)}
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-8 rtl:pl-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
              {artifactSearchQuery && (
                <button
                  onClick={() => setArtifactSearchQuery("")}
                  className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Artifacts list */}
            <div className="border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto">
              {(() => {
                // Filter out already linked artifacts
                const linkedArtifactIds = evidence?.linkedArtifacts?.map(la => la.artifact.id) || [];
                const filteredArtifacts = availableArtifacts.filter(artifact => {
                  if (linkedArtifactIds.includes(artifact.id)) return false;
                  if (artifactSearchQuery.trim()) {
                    const query = artifactSearchQuery.toLowerCase().trim();
                    return artifact.artifactCode?.toLowerCase().includes(query) ||
                      artifact.name?.toLowerCase().includes(query) ||
                      artifact.fileName?.toLowerCase().includes(query);
                  }
                  return true;
                });

                if (filteredArtifacts.length === 0) {
                  return (
                    <div className="py-10 text-center">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center mx-auto mb-2">
                        <FileText className="h-5 w-5 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-400">
                        {artifactSearchQuery.trim()
                          ? t("No artifacts found matching your search")
                          : t("No available artifacts to link")}
                      </p>
                    </div>
                  );
                }

                return filteredArtifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors ${selectedArtifactIds.includes(artifact.id) ? "bg-primary-50/60" : "hover:bg-slate-50/60"
                      }`}
                    onClick={() => {
                      setSelectedArtifactIds((prev) =>
                        prev.includes(artifact.id)
                          ? prev.filter((id) => id !== artifact.id)
                          : [...prev, artifact.id]
                      );
                    }}
                  >
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedArtifactIds.includes(artifact.id)}
                        onCheckedChange={() => {
                          setSelectedArtifactIds((prev) =>
                            prev.includes(artifact.id)
                              ? prev.filter((id) => id !== artifact.id)
                              : [...prev, artifact.id]
                          );
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-800">{artifact.artifactCode}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{artifact.fileName}</p>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <p className="text-xs text-slate-500">
              {selectedArtifactIds.length} {t("artifact(s) selected")}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setLinkArtifactsDialogOpen(false);
                setSelectedArtifactIds([]);
                setArtifactSearchQuery("");
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleLinkArtifacts}
              disabled={selectedArtifactIds.length === 0 || linkingArtifacts}
              className="rounded-lg"
            >
              {linkingArtifacts ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Linking...")}
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  {t("Link Artifacts")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Back Dialog */}
      <Dialog open={sendBackDialogOpen} onOpenChange={(open) => {
        setSendBackDialogOpen(open);
        if (!open) {
          setCycleComment("");
          setCycleComments([]);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Evidence Send Back")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-primary-600 font-semibold">{t("Comment")}</Label>
              <Textarea
                value={cycleComment}
                onChange={(e) => setCycleComment(e.target.value)}
                placeholder={t("Enter your comment...")}
                className="mt-1"
                rows={3}
              />
            </div>

            {cycleComments.length > 0 && (
              <div>
                <Label className="text-primary-600 font-semibold">{t("Previous Comments")}</Label>
                <div className="mt-1 max-h-[200px] overflow-y-auto space-y-3 border rounded-lg p-3 bg-slate-50">
                  {cycleComments.map((c) => {
                    const date = new Date(c.createdAt);
                    return (
                      <div key={c.id} className="text-sm">
                        <div className="flex justify-between items-start">
                          <span>{c.comment}</span>
                          <span className="text-slate-400 text-xs whitespace-nowrap ltr:ml-2 rtl:mr-2">
                            {date.toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>~ {c.userName || t("Unknown")}</span>
                          <span className="text-xs">{date.toLocaleTimeString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setSendBackDialogOpen(false)} className="w-full sm:w-auto">
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleSendBack}
                disabled={!cycleComment.trim() || cycleCommentSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
              >
                {cycleCommentSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-1" />
                )}
                {t("Send Back")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resubmit Dialog */}
      <Dialog open={resubmitDialogOpen} onOpenChange={(open) => {
        setResubmitDialogOpen(open);
        if (!open) {
          setCycleComment("");
          setCycleComments([]);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Comment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-primary-600 font-semibold">{t("Comment")}</Label>
              <Textarea
                value={cycleComment}
                onChange={(e) => setCycleComment(e.target.value)}
                placeholder={t("Enter your comment...")}
                className="mt-1"
                rows={3}
              />
            </div>

            {cycleComments.length > 0 && (
              <div>
                <Label className="text-primary-600 font-semibold">{t("Previous Comments")}</Label>
                <div className="mt-1 max-h-[200px] overflow-y-auto space-y-3 border rounded-lg p-3 bg-slate-50">
                  {cycleComments.map((c) => {
                    const date = new Date(c.createdAt);
                    return (
                      <div key={c.id} className="text-sm">
                        <div className="flex justify-between items-start">
                          <span>{c.comment}</span>
                          <span className="text-slate-400 text-xs whitespace-nowrap ltr:ml-2 rtl:mr-2">
                            {date.toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>~ {c.userName || t("Unknown")}</span>
                          <span className="text-xs">{date.toLocaleTimeString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setResubmitDialogOpen(false)} className="w-full sm:w-auto">
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleResubmit}
                disabled={!cycleComment.trim() || cycleCommentSubmitting}
                className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
              >
                {cycleCommentSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                {t("Resend")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Cycle Comments Dialog (for validated state) */}
      <Dialog open={viewCycleCommentsOpen} onOpenChange={(open) => {
        setViewCycleCommentsOpen(open);
        if (!open) {
          setCycleComments([]);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Comments")} - {selectedMonth ? t(selectedMonth) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cycleComments.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto space-y-3 border rounded-lg p-3 bg-slate-50">
                {cycleComments.map((c) => {
                  const date = new Date(c.createdAt);
                  return (
                    <div key={c.id} className="text-sm">
                      <div className="flex justify-between items-start">
                        <span>{c.comment}</span>
                        <span className="text-slate-400 text-xs whitespace-nowrap ltr:ml-2 rtl:mr-2">
                          {date.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>~ {c.userName || t("Unknown")}</span>
                        <span className="text-xs">{date.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-slate-500 text-sm py-4">
                {t("No comments yet")}
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setViewCycleCommentsOpen(false)}>
                {t("Close")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
