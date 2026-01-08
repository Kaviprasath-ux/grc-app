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
  ArrowLeft,
  Edit,
  AlertTriangle,
  Shield,
  Building2,
  User,
  Calendar,
  Plus,
  Trash2,
  Link2,
} from "lucide-react";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  likelihood: number;
  impact: number;
  riskRating: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualRiskRating: string | null;
  category: string | null;
  status: string;
  mitigationStatus: string | null;
  owner: string | null;
  dueDate: string | null;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  controlRisks?: Array<{
    id: string;
    control: {
      id: string;
      controlId: string;
      name: string;
      status: string;
      domain?: { name: string } | null;
    };
  }>;
}

interface Department {
  id: string;
  name: string;
}

interface Control {
  id: string;
  controlId: string;
  name: string;
  status: string;
}

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800",
  "In-Progress": "bg-yellow-100 text-yellow-800",
  Completed: "bg-green-100 text-green-800",
};

const riskRatingColors: Record<string, string> = {
  Catastrophic: "bg-red-600 text-white",
  "Very High": "bg-red-500 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-yellow-500 text-black",
  Low: "bg-green-500 text-white",
  "Low Risk": "bg-green-500 text-white",
};

const controlStatusColors: Record<string, string> = {
  Implemented: "bg-green-100 text-green-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Planned: "bg-blue-100 text-blue-800",
  "Not Implemented": "bg-gray-100 text-gray-800",
};

const categories = [
  "Strategic",
  "Operational",
  "Financial",
  "Compliance",
  "Technology",
  "Reputational",
];

const mitigationStatuses = [
  "Not Started",
  "In Progress",
  "Implemented",
  "Verified",
];

export default function RiskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    likelihood: "",
    impact: "",
    residualLikelihood: "",
    residualImpact: "",
    category: "",
    status: "",
    mitigationStatus: "",
    owner: "",
    dueDate: "",
    departmentId: "",
  });

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableControls, setAvailableControls] = useState<Control[]>([]);
  const [selectedControlId, setSelectedControlId] = useState("");

  const fetchRisk = useCallback(async () => {
    try {
      const response = await fetch(`/api/risks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRisk(data);
        setEditForm({
          name: data.name || "",
          description: data.description || "",
          likelihood: data.likelihood?.toString() || "",
          impact: data.impact?.toString() || "",
          residualLikelihood: data.residualLikelihood?.toString() || "",
          residualImpact: data.residualImpact?.toString() || "",
          category: data.category || "",
          status: data.status || "",
          mitigationStatus: data.mitigationStatus || "",
          owner: data.owner || "",
          dueDate: data.dueDate?.split("T")[0] || "",
          departmentId: data.departmentId || "",
        });
      }
    } catch (error) {
      console.error("Error fetching risk:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [departmentsRes, controlsRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/controls"),
      ]);

      if (departmentsRes.ok) {
        const deptData = await departmentsRes.json();
        setDepartments(Array.isArray(deptData) ? deptData : deptData.data || []);
      }
      if (controlsRes.ok) {
        const ctrlData = await controlsRes.json();
        setAvailableControls(Array.isArray(ctrlData) ? ctrlData : ctrlData.data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchRisk();
    fetchReferenceData();
  }, [fetchRisk, fetchReferenceData]);

  const calculateRiskRating = (likelihood: number, impact: number): string => {
    const score = likelihood * impact;
    if (score >= 20) return "Critical";
    if (score >= 12) return "High";
    if (score >= 6) return "Medium";
    return "Low";
  };

  const handleSave = async () => {
    try {
      const likelihood = parseInt(editForm.likelihood);
      const impact = parseInt(editForm.impact);
      const riskRating = calculateRiskRating(likelihood, impact);

      const residualLikelihood = editForm.residualLikelihood ? parseInt(editForm.residualLikelihood) : null;
      const residualImpact = editForm.residualImpact ? parseInt(editForm.residualImpact) : null;
      const residualRiskRating = residualLikelihood && residualImpact
        ? calculateRiskRating(residualLikelihood, residualImpact)
        : null;

      const response = await fetch(`/api/risks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          likelihood,
          impact,
          riskRating,
          residualLikelihood,
          residualImpact,
          residualRiskRating,
          departmentId: editForm.departmentId || null,
          dueDate: editForm.dueDate || null,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        fetchRisk();
      }
    } catch (error) {
      console.error("Error updating risk:", error);
    }
  };

  const handleLinkControl = async () => {
    if (!selectedControlId) return;
    // This would need a dedicated API endpoint for linking
    setLinkControlDialogOpen(false);
    setSelectedControlId("");
    fetchRisk();
  };

  const handleUnlinkControl = async (controlRiskId: string) => {
    // This would need a dedicated API endpoint for unlinking
    console.log("Unlink control risk:", controlRiskId);
    fetchRisk();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Risk not found</div>
      </div>
    );
  }

  const linkedControls = risk.controlRisks || [];
  const riskScore = risk.likelihood * risk.impact;
  const residualRiskScore = (risk.residualLikelihood && risk.residualImpact)
    ? risk.residualLikelihood * risk.residualImpact
    : null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/risk-matrix")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{risk.riskId}</h1>
              <Badge
                className={riskRatingColors[risk.riskRating || "Low"]}
              >
                {risk.riskRating || "Low"}
              </Badge>
              <Badge className={statusColors[risk.status] || "bg-gray-100"}>
                {risk.status}
              </Badge>
            </div>
            <p className="text-gray-600">{risk.name}</p>
          </div>
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Risk</DialogTitle>
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
                <Label>Likelihood (1-5)</Label>
                <Select
                  value={editForm.likelihood}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, likelihood: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Rare</SelectItem>
                    <SelectItem value="2">2 - Unlikely</SelectItem>
                    <SelectItem value="3">3 - Possible</SelectItem>
                    <SelectItem value="4">4 - Likely</SelectItem>
                    <SelectItem value="5">5 - Almost Certain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Impact (1-5)</Label>
                <Select
                  value={editForm.impact}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, impact: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Insignificant</SelectItem>
                    <SelectItem value="2">2 - Minor</SelectItem>
                    <SelectItem value="3">3 - Moderate</SelectItem>
                    <SelectItem value="4">4 - Major</SelectItem>
                    <SelectItem value="5">5 - Catastrophic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Residual Risk Section */}
              <div className="col-span-2 border-t pt-4 mt-2">
                <Label className="text-base font-semibold">Residual Risk Assessment</Label>
                <p className="text-sm text-gray-500 mb-3">After applying controls/mitigations</p>
              </div>
              <div>
                <Label>Residual Likelihood (1-5)</Label>
                <Select
                  value={editForm.residualLikelihood}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, residualLikelihood: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Rare</SelectItem>
                    <SelectItem value="2">2 - Unlikely</SelectItem>
                    <SelectItem value="3">3 - Possible</SelectItem>
                    <SelectItem value="4">4 - Likely</SelectItem>
                    <SelectItem value="5">5 - Almost Certain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Residual Impact (1-5)</Label>
                <Select
                  value={editForm.residualImpact}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, residualImpact: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Insignificant</SelectItem>
                    <SelectItem value="2">2 - Minor</SelectItem>
                    <SelectItem value="3">3 - Moderate</SelectItem>
                    <SelectItem value="4">4 - Major</SelectItem>
                    <SelectItem value="5">5 - Catastrophic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 border-t pt-4 mt-2">
                <Label className="text-base font-semibold">Other Details</Label>
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
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
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In-Progress">In-Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mitigation Status</Label>
                <Select
                  value={editForm.mitigationStatus}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, mitigationStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {mitigationStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Owner</Label>
                <Input
                  value={editForm.owner}
                  onChange={(e) =>
                    setEditForm({ ...editForm, owner: e.target.value })
                  }
                />
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
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, dueDate: e.target.value })
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

      {/* Inherent Risk Assessment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Inherent Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Likelihood</p>
              <p className="text-3xl font-bold">{risk.likelihood}</p>
              <p className="text-xs text-gray-400">
                {risk.likelihood === 1
                  ? "Rare"
                  : risk.likelihood === 2
                  ? "Unlikely"
                  : risk.likelihood === 3
                  ? "Possible"
                  : risk.likelihood === 4
                  ? "Likely"
                  : "Almost Certain"}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Impact</p>
              <p className="text-3xl font-bold">{risk.impact}</p>
              <p className="text-xs text-gray-400">
                {risk.impact === 1
                  ? "Insignificant"
                  : risk.impact === 2
                  ? "Minor"
                  : risk.impact === 3
                  ? "Moderate"
                  : risk.impact === 4
                  ? "Major"
                  : "Catastrophic"}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Risk Score</p>
              <p className="text-3xl font-bold">{riskScore}</p>
              <p className="text-xs text-gray-400">L x I</p>
            </div>
            <div
              className={`text-center p-4 rounded-lg ${
                riskRatingColors[risk.riskRating || "Low"]
              } bg-opacity-20`}
            >
              <p className="text-sm opacity-80">Risk Rating</p>
              <Badge className={riskRatingColors[risk.riskRating || "Low"]}>
                {risk.riskRating || "Low"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Residual Risk Assessment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Residual Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {risk.residualLikelihood && risk.residualImpact ? (
            <div className="grid grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Likelihood</p>
                <p className="text-3xl font-bold">{risk.residualLikelihood}</p>
                <p className="text-xs text-gray-400">
                  {risk.residualLikelihood === 1
                    ? "Rare"
                    : risk.residualLikelihood === 2
                    ? "Unlikely"
                    : risk.residualLikelihood === 3
                    ? "Possible"
                    : risk.residualLikelihood === 4
                    ? "Likely"
                    : "Almost Certain"}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Impact</p>
                <p className="text-3xl font-bold">{risk.residualImpact}</p>
                <p className="text-xs text-gray-400">
                  {risk.residualImpact === 1
                    ? "Insignificant"
                    : risk.residualImpact === 2
                    ? "Minor"
                    : risk.residualImpact === 3
                    ? "Moderate"
                    : risk.residualImpact === 4
                    ? "Major"
                    : "Catastrophic"}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Risk Score</p>
                <p className="text-3xl font-bold">{residualRiskScore}</p>
                <p className="text-xs text-gray-400">L x I</p>
              </div>
              <div
                className={`text-center p-4 rounded-lg ${
                  riskRatingColors[risk.residualRiskRating || "Low"]
                } bg-opacity-20`}
              >
                <p className="text-sm opacity-80">Risk Rating</p>
                <Badge className={riskRatingColors[risk.residualRiskRating || "Low"]}>
                  {risk.residualRiskRating || "Low"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No residual risk assessment available</p>
              <p className="text-sm mt-1">Edit the risk to add residual risk values</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-500">Category</Label>
                <p className="font-medium">{risk.category || "-"}</p>
              </div>
              <div>
                <Label className="text-gray-500">Mitigation Status</Label>
                <p className="font-medium">{risk.mitigationStatus || "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <Label className="text-gray-500">Owner</Label>
                  <p className="font-medium">{risk.owner || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <div>
                  <Label className="text-gray-500">Department</Label>
                  <p className="font-medium">{risk.department?.name || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <Label className="text-gray-500">Due Date</Label>
                  <p className="font-medium">
                    {risk.dueDate
                      ? new Date(risk.dueDate).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            {risk.description ? (
              <p className="whitespace-pre-wrap">{risk.description}</p>
            ) : (
              <p className="text-gray-500 italic">No description provided</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linked Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Mitigating Controls
          </CardTitle>
          <Dialog
            open={linkControlDialogOpen}
            onOpenChange={setLinkControlDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Link Control
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Control to Risk</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Label>Select Control</Label>
                <Select
                  value={selectedControlId}
                  onValueChange={setSelectedControlId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a control" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableControls
                      .filter(
                        (c) =>
                          !linkedControls.find((lc) => lc.control.id === c.id)
                      )
                      .map((control) => (
                        <SelectItem key={control.id} value={control.id}>
                          {control.controlId} - {control.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLinkControlDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleLinkControl}>Link</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {linkedControls.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No controls linked to this risk</p>
              <p className="text-sm mt-1">
                Link controls to show how this risk is being mitigated
              </p>
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
                {linkedControls.map((cr) => (
                  <TableRow key={cr.id}>
                    <TableCell className="font-medium">
                      {cr.control.controlId}
                    </TableCell>
                    <TableCell>{cr.control.name}</TableCell>
                    <TableCell>{cr.control.domain?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          controlStatusColors[cr.control.status] ||
                          "bg-gray-100"
                        }
                      >
                        {cr.control.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            router.push(`/compliance/control/${cr.control.id}`)
                          }
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnlinkControl(cr.id)}
                        >
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

      {/* Risk Matrix Position */}
      <Card>
        <CardHeader>
          <CardTitle>Position in Risk Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <div className="relative">
              <table className="border-collapse">
                <tbody>
                  {[5, 4, 3, 2, 1].map((l) => (
                    <tr key={l}>
                      {[1, 2, 3, 4, 5].map((i) => {
                        const score = l * i;
                        const isCurrentPosition =
                          l === risk.likelihood && i === risk.impact;
                        let bgColor = "bg-green-500";
                        if (score >= 20) bgColor = "bg-red-600";
                        else if (score >= 12) bgColor = "bg-orange-500";
                        else if (score >= 6) bgColor = "bg-yellow-400";

                        return (
                          <td
                            key={i}
                            className={`w-12 h-12 border ${bgColor} ${
                              isCurrentPosition
                                ? "ring-4 ring-black ring-inset"
                                : "bg-opacity-60"
                            }`}
                          >
                            {isCurrentPosition && (
                              <div className="flex items-center justify-center h-full">
                                <AlertTriangle className="h-6 w-6 text-white drop-shadow" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-sm text-gray-500">
                Likelihood
              </div>
              <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-sm text-gray-500">
                Impact
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
