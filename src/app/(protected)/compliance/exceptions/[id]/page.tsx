"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
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
import { CheckCircle, MessageSquare, Send, Trash2, XCircle, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { DatePicker } from "@/components/ui/date-picker";
import { useTranslatedRecord, useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

interface ExceptionComment {
  id: string;
  content: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  name?: string;
  fullName?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  email: string | null;
}

interface Exception {
  id: string;
  exceptionCode: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  endDate: string | null;
  approvedBy: string | null;
  approvedDate: string | null;
  createdAt: string;
  department?: Department | null;
  control?: {
    id: string;
    controlId: string;
    name: string;
    domain?: { id: string; name: string } | null;
    framework?: { id: string; name: string } | null;
  } | null;
  policy?: { id: string; code: string; name: string } | null;
  risk?: {
    id: string;
    riskCode: string;
    name: string;
    category?: { id: string; name: string } | null;
  } | null;
  requester?: User | null;
  approver?: User | null;
  comments: ExceptionComment[];
}

const statusColors: Record<string, string> = {
  Pending: "bg-warning-light text-warning-dark",
  Approved: "bg-success-light text-success-dark",
  Rejected: "bg-error-light text-error-dark",
  Authorised: "bg-info-light text-info-dark",
  "Submitted for Closure": "bg-primary-100 text-primary-700",
  Overdue: "bg-error-light text-error-dark",
  RiskAccepted: "bg-risk-medium-bg text-risk-medium",
  Closed: "bg-slate-100 text-slate-600",
};

const categoryColors: Record<string, string> = {
  Policy: "bg-primary-100 text-primary-700",
  Control: "bg-info-light text-info-dark",
  Compliance: "bg-success-light text-success-dark",
  Risk: "bg-risk-high-bg text-risk-high",
};

const categories = ["Policy", "Control", "Compliance", "Risk"];
const statuses = [
  "Pending",
  "Approved",
  "Rejected",
  "Authorised",
  "Submitted for Closure",
  "Overdue",
  "RiskAccepted",
  "Closed",
];

export default function ExceptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [exception, setException] = useState<Exception | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  // Reference data
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Dynamic translations
  const { data: translatedException } = useTranslatedRecord(exception, { modelName: 'Exception' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });

  // Translate nested reference objects
  const policyArray = useMemo(() => exception?.policy ? [exception.policy] : [], [exception?.policy]);
  const controlArray = useMemo(() => exception?.control ? [exception.control] : [], [exception?.control]);
  const riskArray = useMemo(() => exception?.risk ? [exception.risk] : [], [exception?.risk]);
  const { data: translatedPolicies } = useTranslatedData(policyArray, { modelName: 'Policy' });
  const { data: translatedControls } = useTranslatedData(controlArray, { modelName: 'Control' });
  const { data: translatedRisks } = useTranslatedData(riskArray, { modelName: 'Risk' });

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    status: "",
    departmentId: "",
    requesterId: "",
    approverId: "",
    endDate: "",
    approvedBy: "",
    approvedDate: "",
  });

  // Comment state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Send Back state
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");

  // Resubmit state (for rejected exceptions)
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [resubmitComment, setResubmitComment] = useState("");
  const [resubmitting, setResubmitting] = useState(false);

  // Check if current user is the approver
  const currentUserId = session?.user?.id;
  const userRoles = (session?.user?.roles as string[]) || [];
  const isApprover = currentUserId && exception?.approver?.id === currentUserId;
  const isDepartmentReviewer = userRoles.includes("DepartmentReviewer");
  const isCustomerAdmin = userRoles.includes("CustomerAdministrator");

  // Check if exception is rejected and can be resubmitted
  const isRejectedStatus = exception?.status === "Rejected";
  const canResubmit = isCustomerAdmin && isRejectedStatus;

  // DepartmentReviewer can only view and approve/reject, not edit other fields
  // Also make read-only when status is Approved
  const isApprovedStatus = exception?.status === "Approved";
  const isReadOnly = isDepartmentReviewer || isApprovedStatus;

  const fetchException = useCallback(async () => {
    try {
      const response = await fetch(`/api/exceptions/${id}`);
      if (response.ok) {
        const data = await response.json();
        setException(data);
        setFormData({
          name: data.name || "",
          description: data.description || "",
          category: data.category || "",
          status: data.status || "",
          departmentId: data.departmentId || "",
          requesterId: data.requesterId || "",
          approverId: data.approverId || "",
          endDate: data.endDate?.split("T")[0] || "",
          approvedBy: data.approvedBy || "",
          approvedDate: data.approvedDate?.split("T")[0] || "",
        });
      }
    } catch (error) {
      console.error("Error fetching exception:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [usersRes, deptRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/departments"),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || data || []);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchException();
    fetchReferenceData();
  }, [fetchException, fetchReferenceData]);

  // Update form with translated values when translations load
  useEffect(() => {
    if (translatedException && exception) {
      setFormData(prev => ({
        ...prev,
        name: translatedException.name || prev.name,
        description: translatedException.description || prev.description,
      }));
    }
  }, [translatedException, exception]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/exceptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          status: formData.status,
          departmentId: formData.departmentId || null,
          requesterId: formData.requesterId || null,
          approverId: formData.approverId || null,
          endDate: formData.endDate || null,
          // Note: approvedBy and approvedDate are system-managed via Approve action
        }),
      });

      if (response.ok) {
        triggerTranslation('Exception', id, {
          name: formData.name,
          description: formData.description,
        });
        fetchException();
      }
    } catch (error) {
      console.error("Error saving exception:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/exceptions/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment,
          userName: "Current User", // In real app, get from auth context
        }),
      });

      if (response.ok) {
        setNewComment("");
        setCommentDialogOpen(false);
        fetchException();
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/exceptions/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/compliance/exceptions");
      }
    } catch (error) {
      console.error("Error deleting exception:", error);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const response = await fetch(`/api/exceptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Approved",
          approvedBy: session?.user?.name || "Approver",
          approvedDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to approve exception");
      }

      toast.success(t("Exception approved successfully"));
      await fetchException();
    } catch (error) {
      console.error("Error approving exception:", error);
      toast.error(error instanceof Error ? error.message : t("Failed to approve exception"));
    } finally {
      setApproving(false);
    }
  };

  const handleSendBack = async () => {
    if (!sendBackComment.trim()) {
      toast.error(t("Please enter a comment"));
      return;
    }

    setApproving(true);
    try {
      // First add the comment
      const commentResponse = await fetch(`/api/exceptions/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `[Send Back] ${sendBackComment}`,
          userName: session?.user?.name || "Approver",
        }),
      });

      if (!commentResponse.ok) {
        const errorData = await commentResponse.json();
        throw new Error(errorData.error || "Failed to add comment");
      }

      // Then update status to Rejected
      const response = await fetch(`/api/exceptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Rejected",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      toast.success(t("Exception sent back successfully"));
      setSendBackComment("");
      setSendBackDialogOpen(false);
      await fetchException();
    } catch (error) {
      console.error("Error sending back exception:", error);
      toast.error(error instanceof Error ? error.message : t("Failed to send back exception"));
    } finally {
      setApproving(false);
    }
  };

  const handleResubmit = async () => {
    if (!resubmitComment.trim()) {
      toast.error(t("Please enter a comment"));
      return;
    }

    setResubmitting(true);
    try {
      // First add the comment
      const commentResponse = await fetch(`/api/exceptions/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `[Resubmitted] ${resubmitComment}`,
          userName: session?.user?.name || "Administrator",
        }),
      });

      if (!commentResponse.ok) {
        const errorData = await commentResponse.json();
        throw new Error(errorData.error || "Failed to add comment");
      }

      // Then update status back to Pending
      const response = await fetch(`/api/exceptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Pending",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to resubmit exception");
      }

      toast.success(t("Exception resubmitted for approval"));
      setResubmitComment("");
      setResubmitDialogOpen(false);
      await fetchException();
    } catch (error) {
      console.error("Error resubmitting exception:", error);
      toast.error(error instanceof Error ? error.message : t("Failed to resubmit exception"));
    } finally {
      setResubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!exception) {
    return (
      <div className="p-6">
        <p className="text-slate-500">{t("Exception not found")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/compliance/exceptions" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Exceptions")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{exception.exceptionCode}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{translatedException?.name || exception.name}</h1>
          <Badge className={statusColors[exception.status] || "bg-slate-100 text-slate-600"}>
            {t(exception.status)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Approve and Send Back buttons - visible only to Approver when status is Pending */}
          {isApprover && exception.status === "Pending" && (
            <>
              <Button
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={approving}
              >
                <CheckCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {approving ? t("Processing...") : t("Approve")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500 text-red-600 hover:bg-red-50"
                onClick={() => setSendBackDialogOpen(true)}
                disabled={approving}
              >
                <XCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Send Back")}
              </Button>
            </>
          )}
          {/* Resubmit button - visible to CustomerAdministrator when status is Rejected */}
          {canResubmit && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setResubmitDialogOpen(true)}
            >
              <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Submit")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommentDialogOpen(true)}
          >
            <MessageSquare className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Comments")} ({exception.comments?.length || 0})
          </Button>
          {!isReadOnly && !isApprovedStatus && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Delete")}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4 sm:space-y-6">
        {/* Exception Details Form */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">{t("Exception Details")}</h2>
            {isApprovedStatus && (
              <p className="text-sm text-green-600 mt-1">
                {t("This exception has been approved and cannot be edited.")}
              </p>
            )}
          </div>
          <div className="px-3 sm:px-5 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Exception Code")}</Label>
                <Input value={exception.exceptionCode} disabled className="bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Exception Name")}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={isReadOnly}
                  className={isReadOnly ? "bg-slate-50" : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Category")}</Label>
                <Input value={t(exception.category)} disabled className="bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</Label>
                {isReadOnly ? (
                  <Input
                    value={t(formData.status)}
                    disabled
                    className="bg-slate-50"
                  />
                ) : (
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</Label>
                {isReadOnly ? (
                  <Input
                    value={translatedDepartments.find(d => d.id === exception.department?.id)?.name || exception.department?.name || "-"}
                    disabled
                    className="bg-slate-50"
                  />
                ) : (
                  <Select
                    value={formData.departmentId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, departmentId: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent>
                      {translatedDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("End Date")}</Label>
                {isReadOnly ? (
                  <Input
                    value={formData.endDate ? new Date(formData.endDate).toLocaleDateString("en-GB") : "-"}
                    disabled
                    className="bg-slate-50"
                  />
                ) : (
                  <DatePicker
                    value={formData.endDate || undefined}
                    onChange={(date) =>
                      setFormData({ ...formData, endDate: date ? date.toISOString().split("T")[0] : "" })
                    }
                    placeholder={t("Select end date")}
                    className="w-full"
                  />
                )}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Reason For Exception")}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  disabled={isReadOnly}
                  className={`focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:ring-offset-0 focus-visible:border-primary-300 ${isReadOnly ? "bg-slate-50" : ""}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Requester")}</Label>
                <Input
                  value={
                    (exception.requester?.id ? translatedUsers.find(u => u.id === exception.requester?.id)?.fullName : null) ||
                    exception.requester?.fullName ||
                    exception.requester?.userName ||
                    exception.requester?.name ||
                    "-"
                  }
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approver")}</Label>
                <Input
                  value={
                    (exception.approver?.id ? translatedUsers.find(u => u.id === exception.approver?.id)?.fullName : null) ||
                    exception.approver?.fullName ||
                    exception.approver?.userName ||
                    exception.approver?.name ||
                    "-"
                  }
                  disabled
                  className="bg-slate-50"
                />
              </div>
            </div>
            {!isReadOnly && (
              <div className="mt-5 flex ltr:justify-end rtl:justify-start">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? t("Saving...") : t("Save")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Category-specific Reference & Approval */}
          {/* Category-specific Reference Card */}
          {exception.category === "Policy" && exception.policy && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800">{t("Policy Reference")}</h2>
              </div>
              <div className="px-3 sm:px-5 py-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Policy Code")}
                    </Label>
                    <p className="text-sm font-medium text-slate-800">{exception.policy.code}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Policy Name")}
                    </Label>
                    <p className="text-sm font-medium text-slate-800">{translatedPolicies[0]?.name || exception.policy.name}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {exception.category === "Control" && exception.control && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800">{t("Control Reference")}</h2>
              </div>
              <div className="px-3 sm:px-5 py-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Control Code")}
                    </Label>
                    <p className="text-sm font-medium text-slate-800">{exception.control.controlId}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Control Name")}
                    </Label>
                    <p className="text-sm font-medium text-slate-800">{translatedControls[0]?.name || exception.control.name}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {exception.category === "Risk" && exception.risk && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800">{t("Risk Reference")}</h2>
              </div>
              <div className="px-3 sm:px-5 py-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Risk Code")}
                    </Label>
                    <p className="text-sm font-medium text-slate-800">{exception.risk.riskCode}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Risk Name")}
                    </Label>
                    <p className="text-sm font-medium text-slate-800">{translatedRisks[0]?.name || exception.risk.name}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Approval Information Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">{t("Approval Information")}</h2>
            </div>
            <div className="px-3 sm:px-5 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approved by")}</Label>
                  <Input
                    value={formData.approvedBy || "-"}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approved Date")}</Label>
                  <Input
                    value={formData.approvedDate ? new Date(formData.approvedDate).toLocaleDateString("en-GB") : "-"}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Comments Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">{t("Recent Comments")}</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommentDialogOpen(true)}
              >
                <MessageSquare className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Add Comment")}
              </Button>
            </div>
            <div className="px-3 sm:px-5 py-5">
              {exception.comments && exception.comments.length > 0 ? (
                <div className="space-y-3">
                  {exception.comments.slice(0, 3).map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-slate-800">
                          {comment.userName || t("Unknown User")}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(comment.createdAt).toLocaleDateString(
                            "en-GB"
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{comment.content}</p>
                    </div>
                  ))}
                  {exception.comments.length > 3 && (
                    <Button
                      variant="link"
                      className="w-full text-primary-600"
                      onClick={() => setCommentDialogOpen(true)}
                    >
                      {t("View all")} {exception.comments.length} {t("comments")}
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
      </div>

      {/* Comments Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}  >
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden"  onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Comments")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            {/* Comment List */}
            <div className="max-h-64 overflow-y-auto space-y-3">
              {exception.comments && exception.comments.length > 0 ? (
                exception.comments.map((comment) => (
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
        <AlertDialogContent className="p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <AlertDialogTitle className="text-base font-semibold text-slate-800">{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500">
              {t("Are you sure you want to delete this exception? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Back Dialog */}
      <Dialog open={sendBackDialogOpen} onOpenChange={setSendBackDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Send Back Exception")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500">
              {t("Please provide a reason for sending back this exception request.")}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Comment")} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={sendBackComment}
                onChange={(e) => setSendBackComment(e.target.value)}
                placeholder={t("Enter reason for sending back...")}
                rows={4}
                className="focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:ring-offset-0 focus-visible:border-primary-300"
              />
            </div>
          </div>
          <div className="flex flex-row items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setSendBackComment("");
                setSendBackDialogOpen(false);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleSendBack}
              disabled={!sendBackComment.trim() || approving}
            >
              {approving ? t("Processing...") : t("Send Back")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resubmit Dialog - for rejected exceptions */}
      <Dialog open={resubmitDialogOpen} onOpenChange={setResubmitDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Resubmit Exception")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500">
              {t("Please provide a comment explaining the changes made before resubmitting for approval.")}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Comment")} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={resubmitComment}
                onChange={(e) => setResubmitComment(e.target.value)}
                placeholder={t("Enter your comment...")}
                className="focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:ring-offset-0 focus-visible:border-primary-300"
                rows={4}
              />
            </div>
          </div>
          <div className="flex flex-row items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setResubmitComment("");
                setResubmitDialogOpen(false);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleResubmit}
              disabled={!resubmitComment.trim() || resubmitting}
            >
              <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {resubmitting ? t("Submitting...") : t("Submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
