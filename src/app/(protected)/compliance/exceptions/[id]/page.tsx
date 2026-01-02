"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, MessageSquare, Send, Trash2 } from "lucide-react";

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
  name: string;
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
  const [exception, setException] = useState<Exception | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          approvedBy: formData.approvedBy || null,
          approvedDate: formData.approvedDate || null,
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
        <p className="text-gray-500">Exception not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/exceptions")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Exception Detail Page</h1>
            <p className="text-gray-600">{exception.exceptionCode} - {exception.name}</p>
          </div>
          <Badge className={statusColors[exception.status] || "bg-gray-100"}>
            {exception.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCommentDialogOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Comments ({exception.comments?.length || 0})
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Exception Details Form */}
        <Card>
          <CardHeader>
            <CardTitle>Exception Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Exception Code</Label>
                <Input value={exception.exceptionCode} disabled />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Exception Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Category</Label>
                <Input value={exception.category} disabled />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Status</Label>
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
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, departmentId: value })
                  }
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
                <Label className="font-medium">End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="font-medium">Reason For Exception</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Requester</Label>
                <Select
                  value={formData.requesterId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, requesterId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select requester" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Approver</Label>
                <Select
                  value={formData.approverId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, approverId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Category-specific Reference & Approval */}
        <div className="space-y-6">
          {/* Category-specific Reference Card */}
          {exception.category === "Policy" && exception.policy && (
            <Card>
              <CardHeader>
                <CardTitle>Policy Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      Policy code
                    </Label>
                    <p className="font-medium">{exception.policy.code}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      Policies Name
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
                <CardTitle>Control Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      Control code
                    </Label>
                    <p className="font-medium">{exception.control.controlId}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      Control Name
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
                <CardTitle>Risk Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      Risk Code
                    </Label>
                    <p className="font-medium">{exception.risk.riskCode}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-500">
                      Risk Name
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
              <CardTitle>Approval Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Approved by</Label>
                  <Input
                    value={formData.approvedBy}
                    onChange={(e) =>
                      setFormData({ ...formData, approvedBy: e.target.value })
                    }
                    placeholder="Enter approver name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Approved Date</Label>
                  <Input
                    type="date"
                    value={formData.approvedDate}
                    onChange={(e) =>
                      setFormData({ ...formData, approvedDate: e.target.value })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments Summary Card */}
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
              {exception.comments && exception.comments.length > 0 ? (
                <div className="space-y-3">
                  {exception.comments.slice(0, 3).map((comment) => (
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
                  {exception.comments.length > 3 && (
                    <Button
                      variant="link"
                      className="w-full"
                      onClick={() => setCommentDialogOpen(true)}
                    >
                      View all {exception.comments.length} comments
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
              {exception.comments && exception.comments.length > 0 ? (
                exception.comments.map((comment) => (
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
              Are you sure you want to delete this exception? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
