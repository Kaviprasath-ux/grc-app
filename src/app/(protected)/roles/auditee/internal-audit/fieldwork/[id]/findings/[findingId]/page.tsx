"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Save,
  Edit2,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface Finding {
  id: string;
  findingId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  departmentId: string | null;
  departmentName: string;
  responsiblePerson: string;
  responsiblePersonId: string;
  identifiedDate: string | null;
  targetDate: string | null;
  closedDate: string | null;
}

export default function ViewFindingPage() {
  const router = useRouter();
  const params = useParams();
  const engagementId = params.id as string;
  const findingId = params.findingId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState<Finding | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (engagementId && findingId) {
        await fetchFinding();
        await fetchDepartments();
        await fetchUsers();
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, findingId]);

  const fetchFinding = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${findingId}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(data);
      } else {
        toast.error("Finding not found");
        router.push(`/internal-audit/fieldwork/${engagementId}`);
      }
    } catch (error) {
      console.error("Failed to fetch finding:", error);
      toast.error("Failed to load finding");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().split("T")[0];
  };

  const formatDisplayDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleSave = async () => {
    if (!formData) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          severity: formData.severity,
          status: formData.status,
          departmentId: formData.departmentId && formData.departmentId !== "none" ? formData.departmentId : null,
          responsiblePersonId: formData.responsiblePersonId && formData.responsiblePersonId !== "none" ? formData.responsiblePersonId : null,
          identifiedDate: formData.identifiedDate || null,
          targetDate: formData.targetDate || null,
        }),
      });

      if (response.ok) {
        toast.success("Finding updated successfully");
        setIsEditing(false);
        fetchFinding();
      } else {
        toast.error("Failed to update finding");
      }
    } catch (error) {
      console.error("Error updating finding:", error);
      toast.error("Failed to update finding");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !formData) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-500">|</span>
          <span className="text-[#1e3a5f] font-semibold">Finding Details</span>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">Internal Audit</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">Field Work</span>
          <span className="text-gray-500">|</span>
          <span className="text-[#1e3a5f] font-semibold">Finding Details</span>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {/* Page Title */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h1 className="text-xl font-semibold text-[#1e3a5f]">
          Finding Details - {formData.findingId}
        </h1>
      </div>

      {/* Form */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Row 1: Finding ID and Title */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Finding ID</Label>
              <Input value={formData.findingId} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Finding Title</Label>
              {isEditing ? (
                <Input
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                />
              ) : (
                <Input value={formData.title} disabled className="bg-gray-50" />
              )}
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Description</Label>
            {isEditing ? (
              <Textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                {formData.description || "-"}
              </div>
            )}
          </div>

          {/* Row 3: Severity and Status */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Severity</Label>
              {isEditing ? (
                <Select
                  value={formData.severity}
                  onValueChange={(value) => handleInputChange("severity", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    formData.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                    formData.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                    formData.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {formData.severity}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Status</Label>
              {isEditing ? (
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    formData.status === 'Closed' ? 'bg-green-100 text-green-800' :
                    formData.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    formData.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {formData.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Department and Responsible Person */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Department</Label>
              {isEditing ? (
                <Select
                  value={formData.departmentId || "none"}
                  onValueChange={(value) => handleInputChange("departmentId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formData.departmentName || "-"} disabled className="bg-gray-50" />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Responsible Person</Label>
              {isEditing ? (
                <Select
                  value={formData.responsiblePersonId || "none"}
                  onValueChange={(value) => handleInputChange("responsiblePersonId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName || `${user.firstName} ${user.lastName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formData.responsiblePerson || "-"} disabled className="bg-gray-50" />
              )}
            </div>
          </div>

          {/* Row 5: Dates */}
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Identified Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formatDate(formData.identifiedDate)}
                  onChange={(e) => handleInputChange("identifiedDate", e.target.value)}
                />
              ) : (
                <Input value={formatDisplayDate(formData.identifiedDate)} disabled className="bg-gray-50" />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Target Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formatDate(formData.targetDate)}
                  onChange={(e) => handleInputChange("targetDate", e.target.value)}
                />
              ) : (
                <Input value={formatDisplayDate(formData.targetDate)} disabled className="bg-gray-50" />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Closed Date</Label>
              <Input value={formatDisplayDate(formData.closedDate)} disabled className="bg-gray-50" />
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  fetchFinding();
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
