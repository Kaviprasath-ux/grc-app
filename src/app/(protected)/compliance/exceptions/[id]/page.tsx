"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ArrowLeft, CheckCircle, MessageSquare, Send, Trash2, XCircle, Home, ChevronRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

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
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Authorised: "bg-blue-100 text-blue-800",
  "Submitted for Closure": "bg-purple-100 text-purple-800",
  Overdue: "bg-orange-100 text-orange-800",
  RiskAccepted: "bg-pink-100 text-pink-800",
  Closed: "bg-gray-100 text-gray-800",
};

const categoryColors: Record<string, string> = {
  Policy: "bg-purple-100 text-purple-800",
  Control: "bg-blue-100 text-blue-800",
  Compliance: "bg-green-100 text-green-800",
  Risk: "bg-orange-100 text-orange-800",
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!exception) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t("Exception not found")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Back Button and Breadcrumb */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("Back")}
        </Button>
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href="/compliance/exceptions" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Exceptions")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{exception.exceptionCode}</span>
        </nav>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{exception.name}</h1>
          <Badge className={statusColors[exception.status] || "bg-gray-100"}>
            {exception.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {/* Approve and Send Back buttons - visible only to Approver when status is Pending */}
          {isApprover && exception.status === "Pending" && (
            <>
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={approving}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {approving ? t("Processing...") : t("Approve")}
              </Button>
              <Button
                variant="outline"
                className="border-red-500 text-red-600 hover:bg-red-50"
                onClick={() => setSendBackDialogOpen(true)}
                disabled={approving}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t("Send Back")}
              </Button>
            </>
          )}
          {/* Resubmit button - visible to CustomerAdministrator when status is Rejected */}
          {canResubmit && (
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setResubmitDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              {t("Submit")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setCommentDialogOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {t("Comments")} ({exception.comments?.length || 0})
          </Button>
          {!isReadOnly && !isApprovedStatus && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("Delete")}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Exception Details Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Exception Details")}</CardTitle>
            {isApprovedStatus && (
              <p className="text-sm text-green-600 mt-1">
                {t("This exception has been approved and cannot be edited.")}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">{t("Exception Code")}</Label>
                <Input value={exception.exceptionCode} disabled />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">{t("Exception Name")}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={isReadOnly}
                  className={isReadOnly ? "bg-gray-100" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">{t("Category")}</Label>
                <Input value={exception.category} disabled />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">{t("Status")}</Label>
                {isReadOnly ? (
                  <Input
                    value={formData.status}
                    disabled
                    className="bg-gray-100"
                  />
                ) : (
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label className="font-medium">{t("Department")}</Label>
                {isReadOnly ? (
                  <Input
                    value={exception.department?.name || "-"}
                    disabled
                    className="bg-gray-100"
                  />
                ) : (
                  <Select
                    value={formData.departmentId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, departmentId: value })
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
                )}
              </div>
              <div className="space-y-2">
                <Label className="font-medium">{t("End Date")}</Label>
                <Input
                  type={isReadOnly ? "text" : "date"}
                  value={isReadOnly && formData.endDate ? new Date(formData.endDate).toLocaleDateString("en-GB") : formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  disabled={isReadOnly}
                  className={isReadOnly ? "bg-gray-100" : ""}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="font-medium">{t("Reason For Exception")}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  disabled={isReadOnly}
                  className={isReadOnly ? "bg-gray-100" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">{t("Requester")}</Label>
                <Input
                  value={
                    exception.requester?.fullName ||
                    exception.requester?.userName ||
                    (exception.requester?.firstName && exception.requester?.lastName
                      ? `${exception.requester.firstName} ${exception.requester.lastName}`
                      : null) ||
                    exception.requester?.name ||
                    "-"
                  }
                  disabled
                  className="bg-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">{t("Approver")}</Label>
                <Input
                  value={
                    exception.approver?.fullName ||
                    exception.approver?.userName ||
                    (exception.approver?.firstName && exception.approver?.lastName
                      ? `${exception.approver.firstName} ${exception.approver.lastName}`
                      : null) ||
                    exception.approver?.name ||
                    "-"
                  }
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </div>
            {!isReadOnly && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t("Saving...") : t("Save")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Category-specific Reference & Approval */}
        <div className="space-y-6">
          {/* Category-specific Reference Card */}
          {exception.category === "Policy" && exception.policy && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Policy Reference")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      {t("Policy Code")}
                    </Label>
                    <p className="font-medium">{exception.policy.code}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      {t("Policy Name")}
                    </Label>
                    <p className="font-medium">{exception.policy.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {exception.category === "Control" && exception.control && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Control Reference")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      {t("Control Code")}
                    </Label>
                    <p className="font-medium">{exception.control.controlId}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      {t("Control Name")}
                    </Label>
                    <p className="font-medium">{exception.control.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {exception.category === "Risk" && exception.risk && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Risk Reference")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      {t("Risk Code")}
                    </Label>
                    <p className="font-medium">{exception.risk.riskCode}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      {t("Risk Name")}
                    </Label>
                    <p className="font-medium">{exception.risk.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Approval Information")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">{t("Approved by")}</Label>
                  <Input
                    value={formData.approvedBy || "-"}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">{t("Approved Date")}</Label>
                  <Input
                    value={formData.approvedDate ? new Date(formData.approvedDate).toLocaleDateString("en-GB") : "-"}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments Summary Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("Recent Comments")}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommentDialogOpen(true)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t("Add Comment")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {exception.comments && exception.comments.length > 0 ? (
                <div className="space-y-3">
                  {exception.comments.slice(0, 3).map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {comment.userName || t("Unknown User")}
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
                  {exception.comments.length > 3 && (
                    <Button
                      variant="link"
                      className="w-full"
                      onClick={() => setCommentDialogOpen(true)}
                    >
                      {t("View all")} {exception.comments.length} {t("comments")}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {t("No comments yet")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comments Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Comments")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Comment List */}
            <div className="max-h-64 overflow-y-auto space-y-3">
              {exception.comments && exception.comments.length > 0 ? (
                exception.comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {comment.userName || t("Unknown User")}
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
                  {t("No comments yet")}
                </p>
              )}
            </div>

            {/* Add Comment */}
            <div className="border-t pt-4">
              <Label className="font-medium">{t("Add a comment")}</Label>
              <div className="flex gap-2 mt-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t("Type your comment...")}
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
            <AlertDialogTitle>{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this exception? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Back Dialog */}
      <Dialog open={sendBackDialogOpen} onOpenChange={setSendBackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Send Back Exception")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t("Please provide a reason for sending back this exception request.")}
            </p>
            <div className="space-y-2">
              <Label className="font-medium">
                {t("Comment")} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={sendBackComment}
                onChange={(e) => setSendBackComment(e.target.value)}
                placeholder={t("Enter reason for sending back...")}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
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
                onClick={handleSendBack}
                disabled={!sendBackComment.trim() || approving}
              >
                {approving ? t("Processing...") : t("Send Back")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resubmit Dialog - for rejected exceptions */}
      <Dialog open={resubmitDialogOpen} onOpenChange={setResubmitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Resubmit Exception")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t("Please provide a comment explaining the changes made before resubmitting for approval.")}
            </p>
            <div className="space-y-2">
              <Label className="font-medium">
                {t("Comment")} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={resubmitComment}
                onChange={(e) => setResubmitComment(e.target.value)}
                placeholder={t("Enter your comment...")}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResubmitComment("");
                  setResubmitDialogOpen(false);
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleResubmit}
                disabled={!resubmitComment.trim() || resubmitting}
              >
                <Send className="h-4 w-4 mr-2" />
                {resubmitting ? t("Submitting...") : t("Submit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
