"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  DialogTrigger,
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
} from "lucide-react";

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

// Status workflow steps
const STATUS_WORKFLOW = [
  { key: "Not Uploaded", label: "Upload", icon: Upload },
  { key: "Draft", label: "Draft", icon: FileText },
  { key: "Published", label: "Publish", icon: Check },
];

export default function GovernanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("controls");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [approverDialogOpen, setApproverDialogOpen] = useState(false);

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
          Governance document not found
        </div>
      </div>
    );
  }

  const linkedControls = policy.policyControls || [];
  const linkedExceptions = policy.policyExceptions || [];
  const attachments = policy.attachments || [];
  const linkedDocuments = policy.linkedDocuments || [];
  const policyFrameworks = policy.policyFrameworks || [];

  // Get current status step index
  const currentStatusIndex = STATUS_WORKFLOW.findIndex(s => s.key === policy.status);

  const tabs = [
    {
      id: "controls",
      label: "Linked Control",
      icon: Shield,
      count: linkedControls.length,
    },
    {
      id: "exceptions",
      label: "Linked Exception",
      icon: AlertTriangle,
      count: linkedExceptions.length,
    },
    {
      id: "documents",
      label: "Linked Documents",
      icon: FileText,
      count: linkedDocuments.length,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Back Link - Text style like website */}
          <button
            onClick={() => router.push("/compliance/governance")}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{typeLabels[policy.type] || "Policy"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Approve Button */}
          {policy.status !== "Approved" && policy.status !== "Published" && (
            <Button variant="outline" onClick={handleApprove}>
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}

          {/* Start AI Review Button */}
          {policy.aiReviewStatus !== "In Progress" && (
            <Button variant="outline" onClick={handleTriggerAIReview}>
              <Sparkles className="h-4 w-4 mr-2" />
              {policy.aiReviewStatus === "Completed" ? "Re-run AI Review" : "Start AI Review"}
            </Button>
          )}

          {/* Edit Button */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit {typeLabels[policy.type]}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Type</Label>
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
                      <SelectItem value="Policy">Policy</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Procedure">Procedure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
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
                      <SelectItem value="Not Uploaded">Not Uploaded</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Under Review">Under Review</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                      <SelectItem value="Needs Review">Needs Review</SelectItem>
                      <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Version</Label>
                  <Input
                    value={editForm.version}
                    onChange={(e) =>
                      setEditForm({ ...editForm, version: e.target.value })
                    }
                    placeholder="e.g., 1.0"
                  />
                </div>
                <div>
                  <Label>Recurrence</Label>
                  <Select
                    value={editForm.recurrence}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, recurrence: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Framework</Label>
                  <Select
                    value={editForm.frameworkId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, frameworkId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select framework" />
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
                  <Label>Department</Label>
                  <Select
                    value={editForm.departmentId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, departmentId: value })
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
                <div>
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={editForm.effectiveDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, effectiveDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Review Date</Label>
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
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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

      {/* Framework Tags */}
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

      {/* Status Workflow Steps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {STATUS_WORKFLOW.map((step, index) => {
              const isActive = step.key === policy.status;
              const isCompleted = currentStatusIndex > index;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <button
                    onClick={() => handleStatusChange(step.key)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{step.label}</span>
                  </button>
                  {index < STATUS_WORKFLOW.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      isCompleted || isActive ? "bg-green-500" : "bg-muted"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Policy Details - Inline Editable */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {/* Department - Inline Dropdown */}
            <div>
              <Label className="text-muted-foreground text-sm">Department</Label>
              <Select
                value={selectedDepartmentId}
                onValueChange={(value) => {
                  setSelectedDepartmentId(value);
                  handleInlineUpdate("departmentId", value);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned To - With Edit Button */}
            <div>
              <Label className="text-muted-foreground text-sm">Assigned To</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{policy.assignee?.fullName || "-"}</span>
                <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Assignee</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Select Assignee</Label>
                      <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select assignee" />
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
                        Cancel
                      </Button>
                      <Button onClick={handleSaveAssignee}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Approvers - With Add Button */}
            <div>
              <Label className="text-muted-foreground text-sm">Approvers</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{policy.approver?.fullName || "-"}</span>
                <Dialog open={approverDialogOpen} onOpenChange={setApproverDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Approver</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Select Approver</Label>
                      <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select approver" />
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
                        Cancel
                      </Button>
                      <Button onClick={handleSaveApprover}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Recurrence - Inline Dropdown */}
            <div>
              <Label className="text-muted-foreground text-sm">Recurrence</Label>
              <Select
                value={selectedRecurrence}
                onValueChange={(value) => {
                  setSelectedRecurrence(value);
                  handleInlineUpdate("recurrence", value);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select recurrence" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Review Date - Inline Date Picker */}
            <div>
              <Label className="text-muted-foreground text-sm">Review Date</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="date"
                  value={selectedReviewDate}
                  onChange={(e) => {
                    setSelectedReviewDate(e.target.value);
                    handleInlineUpdate("reviewDate", e.target.value);
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Version - Read-only */}
            <div>
              <Label className="text-muted-foreground text-sm">Version</Label>
              <p className="font-medium mt-1">{policy.version || "-"}</p>
            </div>
          </div>

          {policy.description && (
            <div className="mt-6">
              <Label className="text-muted-foreground text-sm">Description</Label>
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
            AI Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!policy.aiReviewStatus || policy.aiReviewStatus === "Pending" ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>AI Review has not been performed yet</p>
            </div>
          ) : policy.aiReviewStatus === "In Progress" ? (
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p>AI Review in progress...</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              <div>
                <Label className="text-muted-foreground text-sm">Status</Label>
                <div className="mt-1">
                  <Badge className={aiStatusColors[policy.aiReviewStatus] || "bg-gray-100"}>
                    {policy.aiReviewStatus}
                  </Badge>
                </div>
              </div>
              {policy.aiReviewScore !== null && (
                <div>
                  <Label className="text-muted-foreground text-sm">Score</Label>
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
                  <Label className="text-muted-foreground text-sm">Justification</Label>
                  <p className="mt-1 p-3 bg-muted rounded-lg">{policy.aiReviewJustification}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attachments</CardTitle>
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No attachments uploaded</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
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
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <CardTitle>Linked Control</CardTitle>
            <Dialog open={linkControlDialogOpen} onOpenChange={setLinkControlDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Link Control
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link Control</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label>Select Control</Label>
                  <Select value={selectedControlId} onValueChange={setSelectedControlId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a control" />
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
                    Cancel
                  </Button>
                  <Button onClick={handleLinkControl}>Link</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {linkedControls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No controls linked to this {(policy.type || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Control ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkControl(pc.control.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Unlink
                        </Button>
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
            <CardTitle>Linked Exception</CardTitle>
          </CardHeader>
          <CardContent>
            {linkedExceptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No exceptions linked to this {(policy.type || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exception Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
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
            <CardTitle>Linked Documents</CardTitle>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Link Document
            </Button>
          </CardHeader>
          <CardContent>
            {linkedDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No documents linked to this {(policy.type || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.code}</TableCell>
                      <TableCell>{doc.name}</TableCell>
                      <TableCell>{doc.type}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          Unlink
                        </Button>
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
