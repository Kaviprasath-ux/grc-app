"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Edit,
  FileText,
  Shield,
  AlertTriangle,
  Sparkles,
  Link2,
  Plus,
  Trash2,
  Check,
  Upload,
  Download,
  Calendar,
  ChevronLeft,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface Policy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  version: string | null;
  owner: string | null;
  recurrence: string | null;
  effectiveDate: string | null;
  reviewDate: string | null;
  nextReviewDate: string | null;
  aiReviewStatus: string | null;
  aiReviewScore: number | null;
  aiReviewJustification: string | null;
  frameworkId: string | null;
  departmentId: string | null;
  assigneeId: string | null;
  approverId: string | null;
  updatedAt: string;
  framework?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
  approver?: { id: string; fullName: string } | null;
  policyControls?: Array<{
    control: {
      id: string;
      controlCode: string;
      name: string;
      status: string;
      domain?: { name: string } | null;
    };
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    filePath: string;
    uploadedAt: string;
  }>;
  policyExceptions?: Array<{
    exception: {
      id: string;
      exceptionCode: string;
      name: string;
      status: string;
      category: string;
    };
  }>;
  linkedDocuments?: Array<{
    id: string;
    name: string;
    type: string;
    code: string;
  }>;
  policyFrameworks?: Array<{
    framework: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

interface Framework {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
  designation?: string;
  department?: { id: string; name: string };
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  status: string;
  domain?: { name: string } | null;
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-gray-100 text-gray-800",
  Draft: "bg-yellow-100 text-yellow-800",
  "Under Review": "bg-blue-100 text-blue-800",
  Approved: "bg-green-100 text-green-800",
  Published: "bg-purple-100 text-purple-800",
  "Needs Review": "bg-orange-100 text-orange-800",
  Archived: "bg-gray-100 text-gray-800",
};

const aiStatusColors: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  Failed: "bg-red-100 text-red-800",
};

const typeLabels: Record<string, string> = {
  Policy: "Policy",
  Standard: "Standard",
  Procedure: "Procedure",
};

const RECURRENCE_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];

// Status workflow steps - 3 visual steps with status mapping
// Step 1 (Upload): Active when status is Draft, Approved, or Published
// Step 2 (Draft): Active when status is Approved or Published
// Step 3 (Publish): Active when status is Published
const STATUS_WORKFLOW = [
  { key: "Upload", label: "Upload", icon: Upload },
  { key: "Draft", label: "Draft", icon: FileText },
  { key: "Publish", label: "Publish", icon: Check },
];

// Helper to determine which steps are active/completed based on status
const getStepStates = (status: string) => {
  switch (status) {
    case "Not Uploaded":
      return { upload: false, draft: false, publish: false };
    case "Draft":
      return { upload: true, draft: false, publish: false };
    case "Approved":
      return { upload: true, draft: true, publish: false };
    case "Published":
      return { upload: true, draft: true, publish: true };
    default:
      return { upload: false, draft: false, publish: false };
  }
};

export default function GovernanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const currentUserId = session?.user?.id as string | undefined;
  const { canEdit, canApprove, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.governance');
  const isGRCAdmin = useHasRole('GRCAdministrator');
  const { t } = useLanguage();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("controls");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [approverDialogOpen, setApproverDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false);
  const [storedSignature, setStoredSignature] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    type: "",
    status: "",
    version: "",
    owner: "",
    recurrence: "",
    effectiveDate: "",
    reviewDate: "",
    nextReviewDate: "",
    frameworkId: "",
    departmentId: "",
  });

  // Inline edit states
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedApproverId, setSelectedApproverId] = useState("");
  const [selectedRecurrence, setSelectedRecurrence] = useState("");
  const [selectedReviewDate, setSelectedReviewDate] = useState("");

  // Reference data
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availableControls, setAvailableControls] = useState<Control[]>([]);
  const [selectedControlId, setSelectedControlId] = useState("");

  const fetchPolicy = useCallback(async () => {
    try {
      const response = await fetch(`/api/policies/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPolicy(data);
        setEditForm({
          name: data.name || "",
          description: data.description || "",
          type: data.type || "",
          status: data.status || "",
          version: data.version || "",
          owner: data.owner || "",
          recurrence: data.recurrence || "",
          effectiveDate: data.effectiveDate?.split("T")[0] || "",
          reviewDate: data.reviewDate?.split("T")[0] || "",
          nextReviewDate: data.nextReviewDate?.split("T")[0] || "",
          frameworkId: data.frameworkId || "",
          departmentId: data.departmentId || "",
        });
        setSelectedDepartmentId(data.departmentId || "");
        setSelectedAssigneeId(data.assigneeId || "");
        setSelectedApproverId(data.approverId || "");
        setSelectedRecurrence(data.recurrence || "");
        setSelectedReviewDate(data.reviewDate?.split("T")[0] || "");
      }
    } catch (error) {
      console.error("Error fetching policy:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [frameworksRes, departmentsRes, usersRes, controlsRes] = await Promise.all([
        fetch("/api/frameworks"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/controls"),
      ]);

      if (frameworksRes.ok) {
        const data = await frameworksRes.json();
        setFrameworks(Array.isArray(data) ? data : data.data || []);
      }
      if (departmentsRes.ok) {
        setDepartments(await departmentsRes.json());
      }
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
      if (controlsRes.ok) {
        const data = await controlsRes.json();
        setAvailableControls(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
    fetchReferenceData();
  }, [fetchPolicy, fetchReferenceData]);

  // Load stored signature from localStorage when policy is loaded and Published
  useEffect(() => {
    if (policy?.id && policy.status === "Published") {
      const signature = localStorage.getItem(`policy-signature-${policy.id}`);
      setStoredSignature(signature);
    } else {
      setStoredSignature(null);
    }
  }, [policy?.id, policy?.status]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          effectiveDate: editForm.effectiveDate || null,
          reviewDate: editForm.reviewDate || null,
          nextReviewDate: editForm.nextReviewDate || null,
          frameworkId: editForm.frameworkId || null,
          departmentId: editForm.departmentId || null,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error updating policy:", error);
    }
  };

  const handleInlineUpdate = async (field: string, value: string) => {
    try {
      const response = await fetch(`/api/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value || null }),
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error updating field:", error);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error approving policy:", error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleLinkControl = async () => {
    if (!selectedControlId) return;

    try {
      const response = await fetch(`/api/policies/${id}/controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlId: selectedControlId }),
      });

      if (response.ok) {
        setLinkControlDialogOpen(false);
        setSelectedControlId("");
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error linking control:", error);
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    try {
      const response = await fetch(`/api/policies/${id}/controls/${controlId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unlinking control:", error);
    }
  };

  const handleTriggerAIReview = async () => {
    try {
      const response = await fetch(`/api/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiReviewStatus: "In Progress",
        }),
      });

      if (response.ok) {
        // Simulate AI review completion after delay
        setTimeout(async () => {
          await fetch(`/api/policies/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aiReviewStatus: "Completed",
              aiReviewScore: Math.floor(Math.random() * 30) + 70,
              aiReviewJustification:
                "The document meets compliance requirements with minor recommendations for improvement in clarity and scope definition.",
            }),
          });
          fetchPolicy();
        }, 2000);
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error triggering AI review:", error);
    }
  };

  const handleSaveAssignee = async () => {
    await handleInlineUpdate("assigneeId", selectedAssigneeId);
    setAssigneeDialogOpen(false);
  };

  const handleSaveApprover = async () => {
    await handleInlineUpdate("approverId", selectedApproverId);
    setApproverDialogOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUploadAttachment = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch(`/api/policies/${id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUploadDialogOpen(false);
        setUploadFile(null);

        // Auto-transition to Draft status when first attachment is uploaded
        // Also set approver = assignee if not already set
        if (policy?.status === "Not Uploaded") {
          const updateData: Record<string, string | null> = { status: "Draft" };

          // Auto-set approver to assignee if approver is not set
          if (!policy.approverId && policy.assigneeId) {
            updateData.approverId = policy.assigneeId;
          }

          await fetch(`/api/policies/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData),
          });
        }

        fetchPolicy(); // Refresh policy data including attachments
      } else {
        const error = await response.json();
        console.error("Upload failed:", error);
      }
    } catch (error) {
      console.error("Error uploading attachment:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/policies/${id}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPolicy(); // Refresh policy data
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
    }
  };

  const handlePublish = async () => {
    try {
      // Save signature to localStorage before publishing
      const canvas = canvasRef.current;
      if (canvas && hasSignature) {
        const signatureDataUrl = canvas.toDataURL("image/png");
        localStorage.setItem(`policy-signature-${id}`, signatureDataUrl);
        // Also store the publish timestamp
        localStorage.setItem(`policy-publishedAt-${id}`, new Date().toISOString());
      }

      const response = await fetch(`/api/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Published" }),
      });

      if (response.ok) {
        setPublishDialogOpen(false);
        setSignatureDialogOpen(false);
        clearSignature();
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error publishing policy:", error);
    }
  };

  const handleUnpublish = async () => {
    try {
      const response = await fetch(`/api/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });

      if (response.ok) {
        // Clear stored signature and publishedAt from localStorage
        localStorage.removeItem(`policy-signature-${id}`);
        localStorage.removeItem(`policy-publishedAt-${id}`);
        setStoredSignature(null);
        setUnpublishDialogOpen(false);
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unpublishing policy:", error);
    }
  };

  // Signature canvas functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    setHasSignature(true);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  const openSignatureDialog = () => {
    setSignatureDialogOpen(true);
    setHasSignature(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          {t("Governance document not found")}
        </div>
      </div>
    );
  }

  const linkedControls = policy.policyControls || [];
  const linkedExceptions = policy.policyExceptions || [];
  const attachments = policy.attachments || [];
  const linkedDocuments = policy.linkedDocuments || [];
  const policyFrameworks = policy.policyFrameworks || [];

  // Get step states based on current status
  const stepStates = getStepStates(policy.status);

  // Approve button visibility: Only CustomerAdmin who is the Approver can approve
  // And only when status is Draft
  const canShowApproveButton =
    isGRCAdmin &&
    currentUserId &&
    policy.approverId &&
    currentUserId === policy.approverId &&
    policy.status === "Draft";

  // Publish button visibility: Only when status is Approved
  // And only if user is Assignee OR CustomerAdmin
  const canShowPublishButton =
    policy.status === "Approved" &&
    currentUserId &&
    (currentUserId === policy.assigneeId || isGRCAdmin);

  const tabs = [
    {
      id: "controls",
      label: t("Linked Control"),
      icon: Shield,
      count: linkedControls.length,
    },
    {
      id: "exceptions",
      label: t("Linked Exception"),
      icon: AlertTriangle,
      count: linkedExceptions.length,
    },
    {
      id: "documents",
      label: t("Linked Documents"),
      icon: FileText,
      count: linkedDocuments.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{t("Compliance")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/roles/grc-administrator/compliance/governance" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Governance")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{policy.code}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">
          {/* Approve Button */}
          {canShowApproveButton && (
            <Button variant="outline" onClick={handleApprove}>
              <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Approve")}
            </Button>
          )}

          {/* Publish Button */}
          {canShowPublishButton && (
            <Button onClick={openSignatureDialog}>
              <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Publish")}
            </Button>
          )}

          {/* Start AI Review Button */}
          <PermissionGate resource="compliance.governance" action="edit">
            {policy.aiReviewStatus !== "In Progress" && (
              <Button variant="outline" onClick={handleTriggerAIReview}>
                <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {policy.aiReviewStatus === "Completed" ? t("Re-run AI Review") : t("Start AI Review")}
              </Button>
            )}
          </PermissionGate>

          {/* Edit Button */}
          <PermissionGate resource="compliance.governance" action="edit">
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Edit")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("Edit")} {typeLabels[policy.type]}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2">
                  <Label>{t("Name")}</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>{t("Description")}</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{t("Type")}</Label>
                  <Select
                    value={editForm.type}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Policy">{t("Policy")}</SelectItem>
                      <SelectItem value="Standard">{t("Standard")}</SelectItem>
                      <SelectItem value="Procedure">{t("Procedure")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Status")}</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Not Uploaded">{t("Not Uploaded")}</SelectItem>
                      <SelectItem value="Draft">{t("Draft")}</SelectItem>
                      <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                      <SelectItem value="Approved">{t("Approved")}</SelectItem>
                      <SelectItem value="Published">{t("Published")}</SelectItem>
                      <SelectItem value="Needs Review">{t("Needs Review")}</SelectItem>
                      <SelectItem value="Archived">{t("Archived")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Version")}</Label>
                  <Input
                    value={editForm.version}
                    onChange={(e) =>
                      setEditForm({ ...editForm, version: e.target.value })
                    }
                    placeholder={t("e.g., 1.0")}
                  />
                </div>
                <div>
                  <Label>{t("Recurrence")}</Label>
                  <Select
                    value={editForm.recurrence}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, recurrence: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select recurrence")} />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Framework")}</Label>
                  <Select
                    value={editForm.frameworkId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, frameworkId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select framework")} />
                    </SelectTrigger>
                    <SelectContent>
                      {frameworks.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Department")}</Label>
                  <Select
                    value={editForm.departmentId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, departmentId: value })
                    }
                  >
                    <SelectTrigger>
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
                <div>
                  <Label>{t("Effective Date")}</Label>
                  <Input
                    type="date"
                    value={editForm.effectiveDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, effectiveDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("Review Date")}</Label>
                  <Input
                    type="date"
                    value={editForm.reviewDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, reviewDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  {t("Cancel")}
                </Button>
                <Button onClick={handleSave}>{t("Save Changes")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </PermissionGate>
        </div>
      </div>

      {/* Framework Tags - displayed above policy name */}
      {(policyFrameworks.length > 0 || policy.framework) && (
        <div className="flex flex-wrap gap-2">
          {policyFrameworks.map((pf) => (
            <Badge key={pf.framework.id} variant="outline" className="bg-blue-50">
              {pf.framework.name}
            </Badge>
          ))}
          {policy.framework && policyFrameworks.length === 0 && (
            <Badge variant="outline" className="bg-blue-50">
              {policy.framework.name}
            </Badge>
          )}
        </div>
      )}

      {/* Policy Name and Status */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{policy.name}</h1>
          <Badge className={statusColors[policy.status] || "bg-gray-100"}>
            {policy.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">{policy.code}</p>
      </div>

      {/* Status Workflow Steps - Visual display of current state */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {STATUS_WORKFLOW.map((step, index) => {
              // Determine step state based on status
              const isStepActive =
                (step.key === "Upload" && stepStates.upload) ||
                (step.key === "Draft" && stepStates.draft) ||
                (step.key === "Publish" && stepStates.publish);

              // Determine if connecting line should be green
              const isLineGreen =
                (index === 0 && stepStates.upload) ||
                (index === 1 && stepStates.draft);

              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors ${
                      isStepActive
                        ? "bg-green-100 text-green-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{t(step.label)}</span>
                  </div>
                  {index < STATUS_WORKFLOW.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      isLineGreen ? "bg-green-500" : "bg-muted"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Policy Details - Inline Editable (with permission check) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Policy Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {/* Department - Inline Dropdown (editable only with permission) */}
            <div>
              <Label className="text-muted-foreground text-sm">{t("Department")}</Label>
              {canEdit ? (
                <Select
                  value={selectedDepartmentId}
                  onValueChange={(value) => {
                    setSelectedDepartmentId(value);
                    handleInlineUpdate("departmentId", value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium mt-1">{policy.department?.name || "-"}</p>
              )}
            </div>

            {/* Assigned To - With Edit Button (only with edit permission) */}
            <div>
              <Label className="text-muted-foreground text-sm">{t("Assigned To")}</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{policy.assignee?.fullName || "-"}</span>
                <PermissionGate resource="compliance.governance" action="edit">
                  <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("Edit Assignee")}</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Label>{t("Select Assignee")}</Label>
                        <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder={t("Select assignee")} />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setAssigneeDialogOpen(false)}>
                          {t("Cancel")}
                        </Button>
                        <Button onClick={handleSaveAssignee}>{t("Save")}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>
            </div>

            {/* Approvers - With Add Button (only with edit permission) */}
            <div>
              <Label className="text-muted-foreground text-sm">{t("Approvers")}</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{policy.approver?.fullName || "-"}</span>
                <PermissionGate resource="compliance.governance" action="edit">
                  <Dialog open={approverDialogOpen} onOpenChange={setApproverDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("Add Approver")}</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Label>{t("Select Approver")}</Label>
                        <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder={t("Select approver")} />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setApproverDialogOpen(false)}>
                          {t("Cancel")}
                        </Button>
                        <Button onClick={handleSaveApprover}>{t("Save")}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>
            </div>

            {/* Recurrence - Inline Dropdown (editable only with permission) */}
            <div>
              <Label className="text-muted-foreground text-sm">{t("Recurrence")}</Label>
              {canEdit ? (
                <Select
                  value={selectedRecurrence}
                  onValueChange={(value) => {
                    setSelectedRecurrence(value);
                    handleInlineUpdate("recurrence", value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("Select recurrence")} />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium mt-1">{policy.recurrence || "-"}</p>
              )}
            </div>

            {/* Review Date - Inline Date Picker (editable only with permission) */}
            <div>
              <Label className="text-muted-foreground text-sm">{t("Review Date")}</Label>
              <div className="flex items-center gap-2 mt-1">
                {canEdit ? (
                  <Input
                    type="date"
                    value={selectedReviewDate}
                    onChange={(e) => {
                      setSelectedReviewDate(e.target.value);
                      handleInlineUpdate("reviewDate", e.target.value);
                    }}
                    className="w-full"
                  />
                ) : (
                  <p className="font-medium">{policy.reviewDate ? new Date(policy.reviewDate).toLocaleDateString() : "-"}</p>
                )}
              </div>
            </div>

            {/* Version - Read-only */}
            <div>
              <Label className="text-muted-foreground text-sm">{t("Version")}</Label>
              <p className="font-medium mt-1">{policy.version || "-"}</p>
            </div>
          </div>

          {policy.description && (
            <div className="mt-6">
              <Label className="text-muted-foreground text-sm">{t("Description")}</Label>
              <p className="mt-1">{policy.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Review Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t("AI Review")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!policy.aiReviewStatus || policy.aiReviewStatus === "Pending" ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>{t("AI Review has not been performed yet")}</p>
            </div>
          ) : policy.aiReviewStatus === "In Progress" ? (
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p>{t("AI Review in progress...")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              <div>
                <Label className="text-muted-foreground text-sm">{t("Status")}</Label>
                <div className="mt-1">
                  <Badge className={aiStatusColors[policy.aiReviewStatus] || "bg-gray-100"}>
                    {policy.aiReviewStatus}
                  </Badge>
                </div>
              </div>
              {policy.aiReviewScore !== null && (
                <div>
                  <Label className="text-muted-foreground text-sm">{t("Score")}</Label>
                  <div className="mt-1">
                    <span className={`text-2xl font-bold ${
                      policy.aiReviewScore >= 80
                        ? "text-green-600"
                        : policy.aiReviewScore >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}>
                      {policy.aiReviewScore}%
                    </span>
                  </div>
                </div>
              )}
              {policy.aiReviewJustification && (
                <div className="col-span-3">
                  <Label className="text-muted-foreground text-sm">{t("Justification")}</Label>
                  <p className="mt-1 p-3 bg-muted rounded-lg">{policy.aiReviewJustification}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Published Section - Only show when status is Published */}
      {policy.status === "Published" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              {t("Published")}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Download Published Document Button */}
              {attachments.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(attachments[0].filePath, "_blank")}
                >
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Download")}
                </Button>
              )}
              {/* Unpublish Button */}
              <PermissionGate resource="compliance.governance" action="edit">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnpublishDialogOpen(true)}
                  className="text-orange-600 hover:text-orange-700"
                >
                  {t("Unpublish")}
                </Button>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Published Info */}
              <div className="space-y-4">
                {/* Published On */}
                <div>
                  <Label className="text-muted-foreground text-sm">{t("Published On")}</Label>
                  <p className="font-medium mt-1">
                    {(() => {
                      // Try to get stored publishedAt from localStorage, fallback to updatedAt
                      const storedPublishedAt = localStorage.getItem(`policy-publishedAt-${policy.id}`);
                      const publishDate = storedPublishedAt
                        ? new Date(storedPublishedAt)
                        : new Date(policy.updatedAt);
                      return publishDate.toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    })()}
                  </p>
                </div>

                {/* Published Document */}
                <div>
                  <Label className="text-muted-foreground text-sm">{t("Published Document")}</Label>
                  {attachments.length > 0 ? (
                    <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">{attachments[0].fileName}</span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-1">{t("No document attached")}</p>
                  )}
                </div>

                {/* Approver Details */}
                <div>
                  <Label className="text-muted-foreground text-sm">{t("Approved By")}</Label>
                  {policy.approver ? (
                    <div className="mt-1 p-3 bg-muted rounded-lg space-y-1">
                      <p className="font-medium">{policy.approver.fullName}</p>
                      {(() => {
                        // Find the approver in users array to get full details
                        const approverUser = users.find(u => u.id === policy.approverId);
                        return (
                          <>
                            {approverUser?.department && (
                              <p className="text-sm text-muted-foreground">
                                {t("Department")}: {approverUser.department.name}
                              </p>
                            )}
                            {approverUser?.designation && (
                              <p className="text-sm text-muted-foreground">
                                {t("Designation")}: {approverUser.designation}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-1">-</p>
                  )}
                </div>
              </div>

              {/* Right Column - Signature */}
              <div>
                <Label className="text-muted-foreground text-sm">{t("Signature")}</Label>
                <div className="mt-1 border rounded-lg p-4 bg-white min-h-[150px] flex items-center justify-center">
                  {storedSignature ? (
                    <img
                      src={storedSignature}
                      alt={t("Signature")}
                      className="max-w-full max-h-[140px] object-contain"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">{t("Signature not available")}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unpublish Confirmation Dialog */}
      <AlertDialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Unpublish")} {typeLabels[policy.type] || t("Document")}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This will revert the status from Published to Approved. The document will need to be published again after any changes.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpublish} className="bg-orange-600 hover:bg-orange-700">
              {t("Unpublish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attachments Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("Attachments")}</CardTitle>
          <PermissionGate resource="compliance.governance" action="edit">
            {isGRCAdmin ? (
              /* Customer Admin: Upload dialog with full functionality */
              <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
                setUploadDialogOpen(open);
                if (!open) setUploadFile(null);
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Upload")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("Upload Document")}</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div>
                      <Label>{t("Select File")}</Label>
                      <Input
                        type="file"
                        onChange={handleFileSelect}
                        className="mt-2"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      />
                    </div>
                    {uploadFile && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadDialogOpen(false);
                        setUploadFile(null);
                      }}
                      disabled={uploading}
                    >
                      {t("Cancel")}
                    </Button>
                    <Button
                      onClick={handleUploadAttachment}
                      disabled={!uploadFile || uploading}
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" />
                          {t("Uploading...")}
                        </>
                      ) : (
                        t("Upload")
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              /* GRC Admin / Other roles: Original simple button (no functionality) */
              <Button size="sm">
                <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Upload")}
              </Button>
            )}
          </PermissionGate>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t("No attachments uploaded")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("File Name")}</TableHead>
                  <TableHead>{t("Type")}</TableHead>
                  <TableHead>{t("Uploaded")}</TableHead>
                  <TableHead className="w-[100px]">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium">{att.fileName}</TableCell>
                    <TableCell>{att.fileType}</TableCell>
                    <TableCell>{new Date(att.uploadedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isGRCAdmin ? (
                          /* Customer Admin: Functional download button */
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(att.filePath, "_blank")}
                            title={t("Download")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : (
                          /* GRC Admin / Other: Original button (no functionality) */
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <PermissionGate resource="compliance.governance" action="delete">
                          {isGRCAdmin ? (
                            /* Customer Admin: Functional delete button */
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAttachment(att.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          ) : (
                            /* GRC Admin / Other: Original button (no functionality) */
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Signature Publish Dialog */}
      <Dialog open={signatureDialogOpen} onOpenChange={(open) => {
        setSignatureDialogOpen(open);
        if (!open) clearSignature();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{typeLabels[policy.type] || t("Policy")} {t("signature Publish")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("Please sign below to publish this")} {(policy.type || "document").toLowerCase()}.
            </p>
            <div className="border rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="w-full border border-dashed border-gray-300 rounded cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                disabled={!hasSignature}
              >
                {t("Clear Signature")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("Draw your signature above")}
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setSignatureDialogOpen(false);
              clearSignature();
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handlePublish} disabled={!hasSignature}>
              {t("Publish")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== null && (
                <Badge variant="secondary" className="ml-1">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "controls" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("Linked Control")}</CardTitle>
            <PermissionGate resource="compliance.governance" action="edit">
              <Dialog open={linkControlDialogOpen} onOpenChange={setLinkControlDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Link Control")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("Link Control")}</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <Label>{t("Select Control")}</Label>
                    <Select value={selectedControlId} onValueChange={setSelectedControlId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder={t("Select a control")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableControls
                          .filter((c) => !linkedControls.find((lc) => lc.control.id === c.id))
                          .map((control) => (
                            <SelectItem key={control.id} value={control.id}>
                              {control.controlCode} - {control.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setLinkControlDialogOpen(false)}>
                      {t("Cancel")}
                    </Button>
                    <Button onClick={handleLinkControl}>{t("Link")}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </PermissionGate>
          </CardHeader>
          <CardContent>
            {linkedControls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t("No controls linked to this")} {(policy.type || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Control ID")}</TableHead>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Domain")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead className="w-[80px]">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedControls.map((pc) => (
                    <TableRow key={pc.control.id}>
                      <TableCell className="font-medium">{pc.control.controlCode}</TableCell>
                      <TableCell>{pc.control.name}</TableCell>
                      <TableCell>{pc.control.domain?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[pc.control.status] || "bg-gray-100"}>
                          {pc.control.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PermissionGate resource="compliance.governance" action="edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkControl(pc.control.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            {t("Unlink")}
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "exceptions" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Linked Exception")}</CardTitle>
          </CardHeader>
          <CardContent>
            {linkedExceptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t("No exceptions linked to this")} {(policy.type || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Exception Code")}</TableHead>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Category")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedExceptions.map((pe) => (
                    <TableRow key={pe.exception.id}>
                      <TableCell className="font-medium">{pe.exception.exceptionCode}</TableCell>
                      <TableCell>{pe.exception.name}</TableCell>
                      <TableCell>{pe.exception.category}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[pe.exception.status] || "bg-gray-100"}>
                          {pe.exception.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "documents" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("Linked Documents")}</CardTitle>
            <PermissionGate resource="compliance.governance" action="edit">
              <Button size="sm">
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Link Document")}
              </Button>
            </PermissionGate>
          </CardHeader>
          <CardContent>
            {linkedDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t("No documents linked to this")} {(policy.type || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Code")}</TableHead>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Type")}</TableHead>
                    <TableHead className="w-[80px]">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.code}</TableCell>
                      <TableCell>{doc.name}</TableCell>
                      <TableCell>{doc.type}</TableCell>
                      <TableCell>
                        <PermissionGate resource="compliance.governance" action="edit">
                          <Button variant="ghost" size="sm" className="text-red-500">
                            {t("Unlink")}
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
