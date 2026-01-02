"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Edit2,
  MessageSquare,
  Send,
} from "lucide-react";

interface EvidenceComment {
  id: string;
  content: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
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
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

export default function EvidenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"controls" | "artifacts">("controls");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [linkControlsOpen, setLinkControlsOpen] = useState(false);
  const [editAssigneeOpen, setEditAssigneeOpen] = useState(false);

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);

  // Control linking
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);

  // KPI form
  const [kpiForm, setKpiForm] = useState({
    kpiObjective: "",
    kpiDataSource: "",
    kpiExpectedScore: "",
    kpiDescription: "",
    kpiCalculationFormula: "",
  });

  // Comment state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchEvidence = useCallback(async () => {
    try {
      const response = await fetch(`/api/evidences/${id}`);
      if (response.ok) {
        const data = await response.json();
        setEvidence(data);
        setKpiForm({
          kpiObjective: data.kpiObjective || "",
          kpiDataSource: data.kpiDataSource || "",
          kpiExpectedScore: data.kpiExpectedScore?.toString() || "",
          kpiDescription: data.kpiDescription || "",
          kpiCalculationFormula: data.kpiCalculationFormula || "",
        });
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
    try {
      const response = await fetch(`/api/evidences/${id}`, {
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

      if (response.ok) {
        fetchEvidence();
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
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

  const getStatusStep = (status: string) => {
    switch (status) {
      case "Not Uploaded":
        return 0;
      case "Draft":
        return 1;
      case "Validated":
      case "Published":
        return 2;
      default:
        return 0;
    }
  };

  // Filter users by selected department
  const filteredUsers = evidence?.departmentId
    ? users.filter((u) => u.departmentId === evidence.departmentId)
    : users;

  // Get linked control IDs for filtering
  const linkedControlIds = evidence?.evidenceControls?.map((ec) => ec.control.id) || [];

  // Filter out already linked controls
  const availableControls = controls.filter((c) => !linkedControlIds.includes(c.id));

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStatusChange("Not Uploaded")}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              currentStep >= 0 ? "bg-green-500 text-white" : "bg-gray-200"
            }`}
          >
            {currentStep > 0 ? <Check className="h-6 w-6" /> : <Upload className="h-5 w-5" />}
          </button>
          <span className="text-sm">Upload</span>
        </div>
        <div className="w-24 h-0.5 bg-gray-300" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStatusChange("Draft")}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              currentStep >= 1 ? "bg-green-500 text-white" : "bg-gray-200"
            }`}
          >
            {currentStep > 1 ? <Check className="h-6 w-6" /> : <FileText className="h-5 w-5" />}
          </button>
          <span className="text-sm">Draft</span>
        </div>
        <div className="w-24 h-0.5 bg-gray-300" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStatusChange("Published")}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              currentStep >= 2 ? "bg-green-500 text-white" : "bg-gray-200"
            }`}
          >
            {currentStep >= 2 ? <Check className="h-6 w-6" /> : "3"}
          </button>
          <span className="text-sm">Publish</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Evidence Details Form */}
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
              <CardHeader>
                <CardTitle>KPI Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Objective</Label>
                    <Input
                      placeholder="Enter Objective"
                      value={kpiForm.kpiObjective}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiObjective: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Data Source</Label>
                    <Input
                      placeholder="Enter Data Source"
                      value={kpiForm.kpiDataSource}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiDataSource: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Expected Score (%)</Label>
                    <Input
                      type="number"
                      placeholder="Enter expected score"
                      value={kpiForm.kpiExpectedScore}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiExpectedScore: e.target.value })}
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">KPI Calculation Formula</Label>
                    <Input
                      placeholder="Enter the KPI Calculation Formula"
                      value={kpiForm.kpiCalculationFormula}
                      onChange={(e) => setKpiForm({ ...kpiForm, kpiCalculationFormula: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveKpi}>Save</Button>
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

          {/* Tabs: Linked Controls / Linked Artifacts */}
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
                  <Dialog open={linkControlsOpen} onOpenChange={setLinkControlsOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">Link Controls</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Link Controls</DialogTitle>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
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
                              No available controls to link
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {selectedControlIds.length} control(s) selected
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setLinkControlsOpen(false)}>
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

        {/* Right Column - Attachments & Comments */}
        <div className="space-y-6">
          {/* Attachments Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attachments</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Attachment
                </Button>
                <Button size="sm" variant="outline">
                  <Link2 className="h-4 w-4 mr-1" />
                  Link Artifacts
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Month Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {months.map((month) => (
                  <Button
                    key={month}
                    variant={selectedMonth === month ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMonth(selectedMonth === month ? null : month)}
                    className="text-xs"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {month}
                  </Button>
                ))}
              </div>

              {/* Attachments List */}
              <div className="space-y-2">
                {evidence.attachments?.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="text-sm truncate max-w-[150px]">{att.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!evidence.attachments || evidence.attachments.length === 0) && (
                  <p className="text-center text-gray-500 text-sm py-4">No attachments</p>
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
    </div>
  );
}
