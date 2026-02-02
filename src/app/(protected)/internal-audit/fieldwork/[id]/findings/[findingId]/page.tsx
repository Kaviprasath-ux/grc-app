"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
import { DatePicker } from "@/components/ui/date-picker";

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
  // New fields
  criteria: string;
  condition: string;
  cause: string;
  effect: string;
  recommendation: string;
}

export default function ViewFindingPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const engagementId = params.id as string;
  const findingId = params.findingId as string;
  const editMode = searchParams.get("edit") === "true";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(editMode);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState<Finding | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (engagementId && findingId) {
        await fetchFinding();
        await fetchUsers();
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, findingId]);

  // Update edit mode when search params change
  useEffect(() => {
    setIsEditing(editMode);
  }, [editMode]);

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

  const fetchUsers = async () => {
    try {
      // Fetch only auditees associated with the current audit head
      const response = await fetch("/api/users/my-auditees");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.auditees || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch auditees:", error);
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
          severity: formData.severity,
          criteria: formData.criteria,
          condition: formData.condition,
          cause: formData.cause || null,
          effect: formData.effect,
          recommendation: formData.recommendation,
          responsiblePersonId: formData.responsiblePersonId && formData.responsiblePersonId !== "none" ? formData.responsiblePersonId : null,
          status: formData.status !== "none" ? formData.status : "Open",
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
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">Audit Plan</span>
          <span className="text-gray-400">|</span>
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
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">Audit Plan</span>
          <span className="text-gray-400">|</span>
          <span className="text-[#1e3a5f] font-semibold">Finding Details - {formData.findingId}</span>
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

      {/* Form */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Finding Title */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Finding Title</Label>
            {isEditing ? (
              <Input
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="border-gray-300"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {formData.title || "-"}
              </div>
            )}
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Severity</Label>
            {isEditing ? (
              <Select
                value={formData.severity}
                onValueChange={(value) => handleInputChange("severity", value)}
              >
                <SelectTrigger className="border-gray-300">
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

          {/* Criteria (What should be) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Criteria (What should be)</Label>
            {isEditing ? (
              <Textarea
                value={formData.criteria || ""}
                onChange={(e) => handleInputChange("criteria", e.target.value)}
                rows={4}
                className="border-gray-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                {formData.criteria || "-"}
              </div>
            )}
          </div>

          {/* Condition (What is) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Condition (What is)</Label>
            {isEditing ? (
              <Textarea
                value={formData.condition || ""}
                onChange={(e) => handleInputChange("condition", e.target.value)}
                rows={4}
                className="border-gray-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                {formData.condition || "-"}
              </div>
            )}
          </div>

          {/* Cause (Why it happened) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Cause (Why it happened)</Label>
            {isEditing ? (
              <Textarea
                value={formData.cause || ""}
                onChange={(e) => handleInputChange("cause", e.target.value)}
                rows={4}
                className="border-gray-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                {formData.cause || "-"}
              </div>
            )}
          </div>

          {/* Effect (The consequence) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Effect (The consequence)</Label>
            {isEditing ? (
              <Textarea
                value={formData.effect || ""}
                onChange={(e) => handleInputChange("effect", e.target.value)}
                rows={4}
                className="border-gray-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                {formData.effect || "-"}
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Recommendation</Label>
            {isEditing ? (
              <Textarea
                value={formData.recommendation || ""}
                onChange={(e) => handleInputChange("recommendation", e.target.value)}
                rows={4}
                className="border-gray-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                {formData.recommendation || "-"}
              </div>
            )}
          </div>

          {/* Corrective & Preventive Actions (CAPA) Section */}
          <div className="pt-4">
            <h2 className="text-lg font-semibold text-[#1e3a5f] mb-4">
              Corrective & Preventive Actions (CAPA)
            </h2>

            {/* Responsible Person */}
            <div className="space-y-2 mb-4">
              <Label className="text-[#1e3a5f] font-medium">Responsible Person</Label>
              {isEditing ? (
                <Select
                  value={formData.responsiblePersonId || "none"}
                  onValueChange={(value) => handleInputChange("responsiblePersonId", value)}
                >
                  <SelectTrigger className="border-gray-300">
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select person</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName || `${user.firstName} ${user.lastName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {formData.responsiblePerson || "-"}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2 mb-4">
              <Label className="text-[#1e3a5f] font-medium">Status</Label>
              {isEditing ? (
                <Select
                  value={formData.status || "none"}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select status</SelectItem>
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

            {/* Target Closure Date */}
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Target Closure Date</Label>
              {isEditing ? (
                <DatePicker
                  value={formData.targetDate}
                  onChange={(date) => handleInputChange("targetDate", date ? date.toISOString().split('T')[0] : "")}
                  placeholder="Select date"
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {formatDisplayDate(formData.targetDate)}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  fetchFinding();
                }}
                className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
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
