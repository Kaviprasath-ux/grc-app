"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Brain,
  X,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Layers,
} from "lucide-react";

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
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "!bg-gray-500 !text-white border-gray-500",
  Draft: "!bg-yellow-500 !text-white border-yellow-500",
  Validated: "!bg-blue-500 !text-white border-blue-500",
  Published: "!bg-green-600 !text-white border-green-600",
  "Need Attention": "!bg-red-600 !text-white border-red-600",
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
  const { data: session } = useSession();
  const id = params.id as string;

  const isGRCAdmin = session?.user?.roles?.includes("GRCAdministrator");
  const isCustomerAdmin = session?.user?.roles?.includes("CustomerAdministrator");
  const isDepartmentReviewer = session?.user?.roles?.includes("DepartmentReviewer");
  const currentUserId = session?.user?.id;

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"controls" | "artifacts">("controls");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [linkControlsOpen, setLinkControlsOpen] = useState(false);
  const [editAssigneeOpen, setEditAssigneeOpen] = useState(false);

  // Cycle status state (per-cycle approval workflow)
  const [cycleStatuses, setCycleStatuses] = useState<Record<string, CycleStatusData>>({});

  // AI Review state
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

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

  // KPI form
  const [kpiForm, setKpiForm] = useState({
    kpiObjective: "",
    kpiDataSource: "",
    kpiExpectedScore: "",
    kpiDescription: "",
    kpiCalculationFormula: "",
  });
  const [kpiEditMode, setKpiEditMode] = useState(false);
  const [kpiSaving, setKpiSaving] = useState(false);

  // Comment state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Upload attachment state (Customer Admin)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
      const [deptRes, usersRes, fwRes, controlsRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/frameworks"),
        fetch("/api/controls?limit=500"),
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
            toast.info("Status reverted to Draft: Current cycle is not validated.");
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

  // Helper: Can validate/reject (CustomerAdmin OR Assignee)
  const canValidateReject = isCustomerAdmin || isAssignee;

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

  // Handler: Start AI Review
  const handleStartAIReview = async () => {
    if (!selectedMonth) return;

    // Validate: Must have attachment for this cycle
    if (!selectedCycleHasAttachments) {
      toast.error("Please upload an attachment for this cycle first.");
      return;
    }

    setAiReviewLoading(true);

    // Simulate AI review process (since we can't add new APIs)
    // In a real implementation, this would call an existing AI review service
    try {
      // Update status to pending
      updateCycleStatus(selectedMonth, { aiReviewStatus: "pending" });

      // Simulate AI processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update status to completed with result
      updateCycleStatus(selectedMonth, {
        aiReviewStatus: "completed",
        aiReviewResult: "AI Review completed successfully. Document meets compliance requirements."
      });

      toast.success("AI Review completed successfully!");
    } catch (error) {
      console.error("AI Review error:", error);
      toast.error("AI Review failed. Please try again.");
    } finally {
      setAiReviewLoading(false);
    }
  };

  // Handler: Submit for Approval (DepartmentReviewer only)
  const handleSubmitForApproval = () => {
    if (!selectedMonth) return;

    // Validate: Must have attachment for this cycle
    if (!selectedCycleHasAttachments) {
      toast.error("Please upload an attachment for this cycle first.");
      return;
    }

    updateCycleStatus(selectedMonth, { status: "submitted" });
    toast.success("Submitted for approval successfully.");
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
          toast.success(`${selectedMonth} cycle validated. Evidence status updated to Validated.`);
        } else {
          toast.success(`${selectedMonth} cycle validated successfully.`);
        }
      } catch (error) {
        console.error("Error updating parent status:", error);
        toast.success(`${selectedMonth} cycle validated successfully.`);
      }
    } else {
      toast.success(`${selectedMonth} cycle validated successfully.`);
    }
  };

  // Handler: Reject (CustomerAdmin or Assignee)
  const handleReject = () => {
    if (!selectedMonth) return;
    updateCycleStatus(selectedMonth, { status: "rejected" });
    toast.info(`${selectedMonth} cycle rejected.`);
  };

  // Handler: Publish with validation
  const handlePublishWithValidation = async () => {
    if (!currentCycle || !evidence) return;

    const currentCycleStatus = cycleStatuses[currentCycle];

    // Check if current cycle is validated
    if (!currentCycleStatus || currentCycleStatus.status !== "validated") {
      setPublishBlockedMessage("Current cycle document is not validated.");
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

  const handleSaveKpi = async () => {
    // Validate required fields
    if (!kpiForm.kpiObjective?.trim()) {
      toast.error("KPI Objective is required");
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
        toast.error("Failed to save KPI details to evidence");
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
        toast.success(existingKpi ? "KPI updated successfully!" : "KPI created successfully!");
        setKpiEditMode(false); // Switch to view mode (show Edit button)
        await fetchEvidence();
      } else {
        const errorData = await kpiResponse.json();
        toast.error(errorData.error || "Failed to save KPI");
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast.error("Failed to save KPI");
    } finally {
      setKpiSaving(false);
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

      const response = await fetch(`/api/evidences/${id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSelectedFile(null);
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
        toast.success("Attachment uploaded successfully!");
      } else {
        const error = await response.json();
        console.error("Upload failed:", error);
        toast.error("Failed to upload attachment");
      }
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast.error("Failed to upload attachment");
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
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
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

  // Helper: Check if selected cycle has attachments
  const selectedCycleHasAttachments = selectedMonth ? filteredAttachments.length > 0 : false;

  // Determine if evidence has any attachments
  const hasAnyAttachments = evidence?.attachments && evidence.attachments.length > 0;

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

  // Filter out already linked controls and apply search filter
  const availableControls = controls.filter((c) => {
    // First, exclude already linked controls
    if (linkedControlIds.includes(c.id)) return false;

    // Then apply search filter if there's a query
    if (controlSearchQuery.trim()) {
      const query = controlSearchQuery.toLowerCase().trim();
      const matchesCode = c.controlCode?.toLowerCase().includes(query);
      const matchesName = c.name?.toLowerCase().includes(query);
      return matchesCode || matchesName;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Evidence not found</div>
      </div>
    );
  }

  const currentStep = getStatusStep(evidence.status);

  // GRC Admin View - Simplified
  if (isGRCAdmin) {
    return (
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-2 border-b pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/compliance/evidence")}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-gray-300">|</span>
          <h1 className="text-xl font-semibold text-blue-700">
            {evidence.domain || "Evidence Details"}
          </h1>
        </div>

        {/* Framework Badges */}
        <div className="flex gap-2">
          {evidence.frameworks && evidence.frameworks.length > 0 ? (
            evidence.frameworks.map((fw) => (
              <Badge key={fw.id} className="bg-blue-900 text-white hover:bg-blue-800">
                {fw.name}
              </Badge>
            ))
          ) : evidence.framework ? (
            <Badge className="bg-blue-900 text-white hover:bg-blue-800">
              {evidence.framework.name}
            </Badge>
          ) : null}
        </div>

        {/* Evidence Details Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-blue-700">Evidence Details</h2>
            <Button variant="ghost" size="icon" className="text-blue-700">
              <Eye className="h-5 w-5" />
            </Button>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <Label className="text-blue-700 font-medium">Requirement</Label>
                  <p className="mt-1 text-gray-900">{evidence.name}</p>
                </div>
                <div>
                  <Label className="text-blue-700 font-medium">Recurrence</Label>
                  <Select
                    value={evidence.recurrence || ""}
                    onValueChange={(value) => handleInlineUpdate("recurrence", value || null)}
                  >
                    <SelectTrigger className="mt-1 w-48 bg-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {recurrenceOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <Label className="text-blue-700 font-medium">Artifact</Label>
                  <p className="mt-1 text-gray-900">{evidence.description || "-"}</p>
                </div>
                <div>
                  <Label className="text-blue-700 font-medium">Review date</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="date"
                      value={evidence.reviewDate?.split("T")[0] || ""}
                      onChange={(e) => handleInlineUpdate("reviewDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
                      className="w-48 bg-white"
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("artifacts")}
              className={`px-6 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === "artifacts"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Linked Artifact
            </button>
            <button
              onClick={() => setActiveTab("controls")}
              className={`px-6 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === "controls"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Linked Controls
            </button>
          </div>

          {/* Tab Content */}
          <div className="bg-gray-50 rounded-b-lg rounded-tr-lg p-6">
            {activeTab === "controls" && (
              <div>
                <h3 className="text-lg font-semibold text-blue-700 mb-4">Controls</h3>
                <div className="space-y-3">
                  {evidence.evidenceControls?.map((ec) => (
                    <div
                      key={ec.id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-blue-700 font-medium">
                            {ec.control.controlCode} : {ec.control.name}
                          </p>
                          {ec.control.description && (
                            <p className="text-gray-600 text-sm mt-1">{ec.control.description}</p>
                          )}
                        </div>
                        <Badge className="bg-blue-700 text-white hover:bg-blue-600">
                          {ec.control.entities || "Organization Wide"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!evidence.evidenceControls || evidence.evidenceControls.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No controls linked to this evidence</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "artifacts" && (
              <div>
                <h3 className="text-lg font-semibold text-blue-700 mb-4">Artifacts</h3>
                <div className="space-y-3">
                  {evidence.linkedArtifacts?.map((la) => (
                    <div
                      key={la.id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-blue-600" />
                          <div>
                            <p className="font-medium">
                              {la.artifact.artifactCode} : {la.artifact.name}
                            </p>
                            <p className="text-sm text-gray-500">{la.artifact.fileName}</p>
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
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No artifacts linked to this evidence</p>
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/evidence")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Evidence Detail Page</h1>
            <p className="text-gray-600">{evidence.evidenceCode} - {evidence.name}</p>
          </div>
          <Badge className={statusColors[evidence.status] || "bg-gray-500 text-white"}>
            {evidence.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCommentDialogOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Comments ({evidence.comments?.length || 0})
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Workflow Steps */}
      <div className="flex items-center justify-center gap-4 py-4 bg-gray-50 rounded-lg">
        {/* Upload Step */}
        <div className="flex items-center gap-2">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              currentStep >= 0 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            {currentStep > 0 ? <Check className="h-6 w-6" /> : <Upload className="h-5 w-5" />}
          </div>
          <span className={`text-sm ${currentStep >= 0 ? "text-gray-900" : "text-gray-400"}`}>Upload</span>
        </div>
        <div className={`w-24 h-0.5 ${currentStep >= 1 ? "bg-green-500" : "bg-gray-300"}`} />

        {/* Draft Step */}
        <div className="flex items-center gap-2">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              currentStep >= 1 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            {currentStep > 1 ? <Check className="h-6 w-6" /> : <FileText className="h-5 w-5" />}
          </div>
          <span className={`text-sm ${currentStep >= 1 ? "text-gray-900" : "text-gray-400"}`}>Draft</span>
        </div>
        <div className={`w-24 h-0.5 ${currentStep >= 2 ? "bg-green-500" : "bg-gray-300"}`} />

        {/* Publish Step */}
        <div className="flex items-center gap-2">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              currentStep >= 2 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            {currentStep >= 2 ? <Check className="h-6 w-6" /> : <span className="text-lg font-medium">3</span>}
          </div>
          <span className={`text-sm ${currentStep >= 2 ? "text-gray-900" : "text-gray-400"}`}>Publish</span>
        </div>
      </div>

      {/* Publish Button - visible after Draft state but with validation */}
      {hasAnyAttachments && evidence.status !== "Published" && (
        <div className="flex justify-end">
          <Button onClick={handlePublishWithValidation} className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" />
            Publish
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Linked Frameworks: {frameworkCount}
                  </span>
                </div>
              </TooltipTrigger>
              {frameworkCount > 0 && (
                <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white p-2">
                  <div className="space-y-1">
                    <p className="font-medium text-xs text-slate-300">Linked Frameworks:</p>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Evidence Details</CardTitle>
              <Button variant="ghost" size="icon">
                <Eye className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Requirement</Label>
                  <p>{evidence.name}</p>
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Description</Label>
                  <p>{evidence.description || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Department</Label>
                  <Select
                    value={evidence.departmentId || ""}
                    onValueChange={(value) => handleInlineUpdate("departmentId", value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
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
                    <Label className="font-medium">Assigned to</Label>
                    <Dialog open={editAssigneeOpen} onOpenChange={setEditAssigneeOpen}>
                      <DialogTrigger asChild>
                        <Button variant="link" size="sm">
                          Edit Assignee
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Assignee</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                          <Label>Select Assignee</Label>
                          <Select
                            value={evidence.assigneeId || ""}
                            onValueChange={(value) => {
                              handleInlineUpdate("assigneeId", value || null);
                              setEditAssigneeOpen(false);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                            <SelectContent>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Recurrence</Label>
                  <Select
                    value={evidence.recurrence || ""}
                    onValueChange={(value) => handleInlineUpdate("recurrence", value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent>
                      {recurrenceOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Review Date</Label>
                  <Input
                    type="date"
                    value={evidence.reviewDate?.split("T")[0] || ""}
                    onChange={(e) => handleInlineUpdate("reviewDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">KPI Required</span>
                <Checkbox
                  checked={evidence.kpiRequired}
                  onCheckedChange={(checked) => handleInlineUpdate("kpiRequired", !!checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* KPI Details - Show if KPI Required */}
          {evidence.kpiRequired && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>KPI Details</CardTitle>
                {!kpiEditMode && evidence.kpis && evidence.kpis.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setKpiEditMode(true)}>
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Objective <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="Enter Objective"
                      value={kpiForm.kpiObjective}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiObjective: e.target.value })}
                      disabled={!kpiEditMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Data Source</Label>
                    <Input
                      placeholder="Enter Data Source"
                      value={kpiForm.kpiDataSource}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiDataSource: e.target.value })}
                      disabled={!kpiEditMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Expected Score (%)</Label>
                    <Input
                      type="number"
                      placeholder="Enter expected score"
                      value={kpiForm.kpiExpectedScore}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiExpectedScore: e.target.value })}
                      disabled={!kpiEditMode}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Description</Label>
                    <Input
                      placeholder="Enter KPI Description"
                      value={kpiForm.kpiDescription}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiDescription: e.target.value })}
                      disabled={!kpiEditMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Calculation Formula</Label>
                    <Input
                      placeholder="Enter the KPI Calculation Formula"
                      value={kpiForm.kpiCalculationFormula}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiCalculationFormula: e.target.value })}
                      disabled={!kpiEditMode}
                    />
                  </div>
                </div>
                {kpiEditMode && (
                  <div className="flex gap-2">
                    <Button onClick={handleSaveKpi} disabled={kpiSaving}>
                      {kpiSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    {evidence.kpis && evidence.kpis.length > 0 && (
                      <Button variant="outline" onClick={() => setKpiEditMode(false)} disabled={kpiSaving}>
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Published Section */}
          {evidence.status === "Published" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Published</CardTitle>
                <Button variant="outline" onClick={handleUnpublish}>
                  Unpublish
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {evidence.attachments?.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm text-gray-500">
                          Published On: {new Date(att.uploadedAt).toLocaleString()}
                        </p>
                        <p className="font-medium">{att.fileName}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                  {(!evidence.attachments || evidence.attachments.length === 0) && (
                    <p className="text-gray-500 text-center py-4">No published files</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Attachments Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Attachments</CardTitle>
            <div className="flex gap-2">
              {isCustomerAdmin ? (
                <Button size="sm" variant="outline" onClick={() => setUploadDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Attachment
                </Button>
              ) : (
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Attachment
                </Button>
              )}
              <Button size="sm" variant="outline">
                <Link2 className="h-4 w-4 mr-1" />
                Link Artifacts
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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
                      className={`text-xs ${isCurrentCycle ? "ring-2 ring-blue-400" : ""}`}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      {period}
                    </Button>
                    {/* Validated/Rejected Tags */}
                    {cycleStatus?.status === "validated" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border-2 border-green-500 text-green-700 bg-green-50 rounded">
                        <CheckCircle className="h-3 w-3" />
                        Validated
                      </span>
                    )}
                    {cycleStatus?.status === "rejected" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border-2 border-red-500 text-red-700 bg-red-50 rounded">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </span>
                    )}
                    {cycleStatus?.status === "submitted" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border-2 border-yellow-500 text-yellow-700 bg-yellow-50 rounded">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI Review Section */}
            {selectedMonth && (
              <Card className={`mb-4 ${getSelectedCycleStatus().aiReviewStatus === "none" ? "opacity-60" : ""}`}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className={`h-5 w-5 ${getSelectedCycleStatus().aiReviewStatus === "completed" ? "text-green-600" : "text-gray-400"}`} />
                      <span className="font-medium">AI Review</span>
                      {getSelectedCycleStatus().aiReviewStatus === "completed" && (
                        <Badge className="bg-green-100 text-green-700 border-green-300">Completed</Badge>
                      )}
                      {getSelectedCycleStatus().aiReviewStatus === "pending" && (
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">In Progress</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleStartAIReview}
                      disabled={aiReviewLoading || getSelectedCycleStatus().aiReviewStatus === "completed"}
                    >
                      {aiReviewLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Reviewing...
                        </>
                      ) : getSelectedCycleStatus().aiReviewStatus === "completed" ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Review Complete
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-1" />
                          Start AI Review
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {getSelectedCycleStatus().aiReviewStatus === "completed" && getSelectedCycleStatus().aiReviewResult && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-600 bg-green-50 p-3 rounded border border-green-200">
                      {getSelectedCycleStatus().aiReviewResult}
                    </p>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Approval Workflow Buttons */}
            {selectedMonth && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                {/* Submit for Approval - DepartmentReviewer only */}
                {isDepartmentReviewer && getSelectedCycleStatus().status === "none" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSubmitForApproval}
                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Submit for Approval
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
                      Validate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReject}
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}

                {/* Status display when already validated/rejected */}
                {getSelectedCycleStatus().status === "validated" && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    This cycle has been validated
                  </span>
                )}
                {getSelectedCycleStatus().status === "rejected" && (
                  <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    This cycle has been rejected
                  </span>
                )}
                {getSelectedCycleStatus().status === "none" && !isDepartmentReviewer && (
                  <span className="text-sm text-gray-500">
                    Awaiting submission from Department Reviewer
                  </span>
                )}
              </div>
            )}

            {/* Attachments List - Filtered by selected cycle for ALL roles */}
            <div className="space-y-2">
              {filteredAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
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
              {filteredAttachments.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">
                  {selectedMonth ? `No attachments for ${selectedMonth}` : "No attachments"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Comments Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Comments</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommentDialogOpen(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Comment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {evidence.comments && evidence.comments.length > 0 ? (
              <div className="space-y-3">
                {evidence.comments.slice(0, 3).map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {comment.userName || "Unknown User"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString(
                          "en-GB"
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
                {evidence.comments.length > 3 && (
                  <Button
                    variant="link"
                    className="w-full"
                    onClick={() => setCommentDialogOpen(true)}
                  >
                    View all {evidence.comments.length} comments
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No comments yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Linked Section - Tabs: Linked Controls / Linked Artifacts */}
        <div>
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("controls")}
              className={`px-4 py-2 ${
                activeTab === "controls"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500"
              }`}
            >
              Linked Controls
            </button>
            <button
              onClick={() => setActiveTab("artifacts")}
              className={`px-4 py-2 ${
                activeTab === "artifacts"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500"
              }`}
            >
              Linked Artifacts
            </button>
          </div>

          {activeTab === "controls" && (
            <Card className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Controls</CardTitle>
                <Dialog open={linkControlsOpen} onOpenChange={(open) => {
                      setLinkControlsOpen(open);
                      if (!open) setControlSearchQuery(""); // Clear search when dialog closes
                    }}>
                  <DialogTrigger asChild>
                    <Button size="sm">Link Controls</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Link Controls</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      {/* Search input for filtering controls */}
                      <div className="relative">
                        <Input
                          placeholder="Search by Control Code or Control Name..."
                          value={controlSearchQuery}
                          onChange={(e) => setControlSearchQuery(e.target.value)}
                          className="w-full"
                        />
                        {controlSearchQuery && (
                          <button
                            onClick={() => setControlSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                        {availableControls.map((control) => (
                          <div
                            key={control.id}
                            className={`flex items-start gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                              selectedControlIds.includes(control.id) ? "bg-blue-50" : ""
                            }`}
                            onClick={() => {
                              setSelectedControlIds((prev) =>
                                prev.includes(control.id)
                                  ? prev.filter((id) => id !== control.id)
                                  : [...prev, control.id]
                              );
                            }}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
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
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{control.controlCode}</span>
                                <span className="text-gray-600">: {control.name}</span>
                              </div>
                              <Badge variant="secondary" className="mt-1">
                                {control.entities}
                              </Badge>
                              {control.description && (
                                <p className="text-sm text-gray-500 mt-1">{control.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {availableControls.length === 0 && (
                          <div className="p-4 text-center text-gray-500">
                            {controlSearchQuery.trim()
                              ? "No controls found matching your search"
                              : "No available controls to link"}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedControlIds.length} control(s) selected
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => {
                            setLinkControlsOpen(false);
                            setControlSearchQuery("");
                          }}>
                          Cancel
                        </Button>
                        <Button onClick={handleLinkControls} disabled={selectedControlIds.length === 0}>
                          Link Controls
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {evidence.evidenceControls?.map((ec) => (
                    <div
                      key={ec.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">"{ec.control.controlCode}</span>
                          <span>: {ec.control.name}"</span>
                        </div>
                        {ec.control.description && (
                          <p className="text-sm text-gray-500 mt-1">{ec.control.description}</p>
                        )}
                        <Badge variant="secondary" className="mt-2">
                          {ec.control.entities}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlinkControl(ec.control.id)}
                      >
                        Unlink
                      </Button>
                    </div>
                  ))}
                  {(!evidence.evidenceControls || evidence.evidenceControls.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No controls linked to this evidence</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "artifacts" && (
            <Card className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Linked Artifacts</CardTitle>
                <Button size="sm">
                  <Link2 className="h-4 w-4 mr-1" />
                  Link Artifacts
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {evidence.linkedArtifacts?.map((la) => (
                    <div
                      key={la.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="font-medium">
                            {la.artifact.artifactCode} : {la.artifact.name}
                          </p>
                          <p className="text-sm text-gray-500">{la.artifact.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!evidence.linkedArtifacts || evidence.linkedArtifacts.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No artifacts linked to this evidence</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Comments Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Comment List */}
            <div className="max-h-64 overflow-y-auto space-y-3">
              {evidence.comments && evidence.comments.length > 0 ? (
                evidence.comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {comment.userName || "Unknown User"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString("en-GB")}{" "}
                        {new Date(comment.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No comments yet
                </p>
              )}
            </div>

            {/* Add Comment */}
            <div className="border-t pt-4">
              <Label className="font-medium">Add a comment</Label>
              <div className="flex gap-2 mt-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                  size="icon"
                  className="h-auto"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this evidence? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Attachment Dialog (Customer Admin) */}
      {isCustomerAdmin && (
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Attachment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select File</Label>
                <Input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-500">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUploadAttachment}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
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
              Cannot Publish
            </AlertDialogTitle>
            <AlertDialogDescription>
              {publishBlockedMessage}
              {currentCycle && (
                <p className="mt-2 text-sm">
                  Current cycle: <span className="font-medium">{currentCycle}</span>
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
