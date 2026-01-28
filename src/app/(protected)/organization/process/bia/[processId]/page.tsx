"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { useUserRoles } from "@/hooks/usePermissions";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  userRoles?: { role: { name: string } }[];
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  departmentId: string | null;
  department: Department | null;
}

interface BIACategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

interface BIARatingOption {
  id: string;
  label: string;
  score: number;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

interface BIAScoringConfig {
  id: string;
  calculationType: string;
}

interface CategoryRating {
  categoryName: string;
  rating: string;
  ratingScore: number;
  description: string;
}

interface BIAComment {
  id: string;
  comment: string;
  createdBy: string;
  createdByName: string;
  action: string;
  createdAt: string;
}

interface ProcessBIA {
  id: string;
  processId: string;
  status: string;
  impactRating?: number;
  processCriticality?: string;
  rtoHours: number;
  rpoHours: number;
  rtoLabel?: string;
  rpoLabel?: string;
  approverId?: string;
  approverName?: string;
  categoryRatings: {
    categoryName: string;
    rating?: string;
    ratingScore?: number;
    description?: string;
  }[];
  biaComments?: BIAComment[];
}

interface BCPLabel {
  id: string;
  name: string;
  type: string;
  hours: number;
  isActive: boolean;
}

export default function BIAPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const processId = params.processId as string;

  // Check user role
  const isDepartmentReviewer = userRoles.some((role) => role === "DepartmentReviewer");
  const isReviewer = userRoles.some((role) => role === "Reviewer");
  const currentUserId = session?.user?.id;
  const currentUserName = session?.user?.name || "User";

  const [process, setProcess] = useState<Process | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [approvers, setApprovers] = useState<User[]>([]);
  const [filteredApprovers, setFilteredApprovers] = useState<User[]>([]); // For Reviewer role only
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // BIA Settings data
  const [categories, setCategories] = useState<BIACategory[]>([]);
  const [ratingOptions, setRatingOptions] = useState<BIARatingOption[]>([]);
  const [scoringConfig, setScoringConfig] = useState<BIAScoringConfig | null>(null);
  const [bcpLabels, setBcpLabels] = useState<BCPLabel[]>([]);

  // Form state
  const [status, setStatus] = useState("Open");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedApprover, setSelectedApprover] = useState("");
  const [categoryRatings, setCategoryRatings] = useState<CategoryRating[]>([]);
  const [rtoHours, setRtoHours] = useState(0);
  const [rpoHours, setRpoHours] = useState(0);
  const [lowValue, setLowValue] = useState(0);
  const [criticalValue, setCriticalValue] = useState(0);
  const [highValue, setHighValue] = useState(0);
  const [mediumValue, setMediumValue] = useState(0);

  // Comments state
  const [biaComments, setBiaComments] = useState<BIAComment[]>([]);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [isSendBackDialogOpen, setIsSendBackDialogOpen] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [processRes, deptRes, userRes, catRes, ratingRes, configRes, bcpRes, biaRes] = await Promise.all([
        fetch(`/api/processes/${processId}`),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/bia-categories"),
        fetch("/api/bia-ratings"),
        fetch("/api/bia-scoring-config"),
        fetch("/api/bcp-labels"),
        fetch(`/api/process-bia/${processId}`),
      ]);

      // Process data
      if (processRes.ok) {
        const processData = await processRes.json();
        setProcess(processData);
        if (processData.departmentId) {
          setSelectedDepartment(processData.departmentId);
        }
      }

      // Departments
      if (deptRes.ok) setDepartments(await deptRes.json());

      // Filter users to only Reviewer and DepartmentReviewer roles
      if (userRes.ok) {
        const allUsers = await userRes.json();
        const reviewerUsers = allUsers.filter((user: User) => {
          const roles = user.userRoles?.map((ur) => ur.role.name) || [];
          return roles.some((r: string) => ["Reviewer", "DepartmentReviewer"].includes(r));
        });
        setApprovers(reviewerUsers);
      }

      // BIA Categories
      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(cats.filter((c: BIACategory) => c.isActive));
      }

      // BIA Rating options
      if (ratingRes.ok) {
        const rats = await ratingRes.json();
        setRatingOptions(rats.filter((r: BIARatingOption) => r.isActive));
      }

      // Scoring config
      if (configRes.ok) {
        const config = await configRes.json();
        setScoringConfig(config);
      }

      // BCP Labels
      if (bcpRes.ok) {
        const labels = await bcpRes.json();
        setBcpLabels(labels.filter((l: BCPLabel) => l.isActive));
      }

      // Existing BIA assessment
      if (biaRes.ok) {
        const biaData: ProcessBIA | null = await biaRes.json();
        if (biaData) {
          setStatus(biaData.status);
          setSelectedApprover(biaData.approverId || "");
          setRtoHours(biaData.rtoHours);
          setRpoHours(biaData.rpoHours);
          setBiaComments(biaData.biaComments || []);

          // Set category ratings from existing data
          if (biaData.categoryRatings && biaData.categoryRatings.length > 0) {
            setCategoryRatings(
              biaData.categoryRatings.map((cr) => ({
                categoryName: cr.categoryName,
                rating: cr.rating || "",
                ratingScore: cr.ratingScore || 0,
                description: cr.description || "",
              }))
            );
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [processId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize category ratings when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && categoryRatings.length === 0) {
      setCategoryRatings(
        categories.map((cat) => ({
          categoryName: cat.name,
          rating: "",
          ratingScore: 0,
          description: "",
        }))
      );
    }
  }, [categories, categoryRatings.length]);

  // For all roles: Fetch filtered approvers when department changes
  useEffect(() => {
    const fetchFilteredApprovers = async () => {
      if (!selectedDepartment) {
        setFilteredApprovers([]);
        setSelectedApprover("");
        return;
      }
      try {
        const res = await fetch(`/api/users?departmentId=${selectedDepartment}`);
        if (res.ok) {
          const deptUsers = await res.json();
          // Filter to only Reviewer and DepartmentReviewer roles
          const reviewerUsers = deptUsers.filter((user: User) => {
            const roles = user.userRoles?.map((ur) => ur.role.name) || [];
            return roles.some((r: string) => ["Reviewer", "DepartmentReviewer"].includes(r));
          });
          setFilteredApprovers(reviewerUsers);
          // Reset approver when department changes
          setSelectedApprover("");
        }
      } catch (error) {
        console.error("Error fetching filtered approvers:", error);
      }
    };
    fetchFilteredApprovers();
  }, [selectedDepartment]);

  const handleRatingChange = (categoryName: string, ratingLabel: string) => {
    const ratingOption = ratingOptions.find((r) => r.label === ratingLabel);
    setCategoryRatings(
      categoryRatings.map((cr) =>
        cr.categoryName === categoryName
          ? {
              ...cr,
              rating: ratingLabel,
              ratingScore: ratingOption?.score || 0,
              description: ratingOption?.description || "",
            }
          : cr
      )
    );
  };

  const calculateImpactRating = () => {
    const scores = categoryRatings.map((cr) => cr.ratingScore || 0);
    if (scores.length === 0 || scores.every((s) => s === 0)) return 0;

    const calculationType = scoringConfig?.calculationType || "High of all";

    if (calculationType === "High of all") {
      return Math.max(...scores);
    } else if (calculationType === "Addition of all") {
      return scores.reduce((sum, s) => sum + s, 0);
    } else if (calculationType === "Product of all") {
      return scores.filter((s) => s > 0).reduce((prod, s) => prod * s, 1);
    }
    return Math.max(...scores);
  };

  const getCalculationNote = () => {
    const calculationType = scoringConfig?.calculationType || "High of all";
    if (calculationType === "High of all") {
      return "Note: The highest rating will be taken";
    } else if (calculationType === "Addition of all") {
      return "Note: Sum of all ratings will be calculated";
    } else if (calculationType === "Product of all") {
      return "Note: Product of all ratings will be calculated";
    }
    return "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const approver = approvers.find((a) => a.id === selectedApprover);

      // Update process department if changed
      if (selectedDepartment !== process?.departmentId) {
        await fetch(`/api/processes/${processId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: selectedDepartment || null,
          }),
        });
      }

      // Update BIA data
      const res = await fetch(`/api/process-bia/${processId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryRatings,
          rtoHours,
          rpoHours,
          approverId: selectedApprover || null,
          approverName: approver?.fullName || null,
          status,
        }),
      });

      if (res.ok) {
        toast({
          title: "Saved",
          description: "BIA data has been saved",
        });
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to save BIA",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving BIA:", error);
      toast({
        title: "Error",
        description: "Failed to save BIA",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleSubmitForApproval = async () => {
    if (!selectedApprover) {
      toast({
        title: "Error",
        description: "Please select an approver",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const approver = approvers.find((a) => a.id === selectedApprover);

      // Update process department if changed
      if (selectedDepartment !== process?.departmentId) {
        await fetch(`/api/processes/${processId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: selectedDepartment || null,
          }),
        });
      }

      const res = await fetch(`/api/process-bia/${processId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryRatings,
          rtoHours,
          rpoHours,
          approverId: selectedApprover,
          approverName: approver?.fullName || null,
          status: "Pending Approval",
        }),
      });

      if (res.ok) {
        // Add a comment for the submission
        await fetch(`/api/process-bia/${processId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comment: "BIA submitted for approval",
            createdBy: currentUserId,
            createdByName: currentUserName,
            action: "Submit",
          }),
        });

        toast({
          title: "Submitted",
          description: "BIA has been submitted for approval",
        });
        // Navigate back to process page
        router.push("/organization/process");
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to submit BIA",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting BIA:", error);
      toast({
        title: "Error",
        description: "Failed to submit BIA",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      // Update status to Approved
      const res = await fetch(`/api/process-bia/${processId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Approved",
        }),
      });

      if (res.ok) {
        // Add approval comment
        await fetch(`/api/process-bia/${processId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comment: "BIA approved",
            createdBy: currentUserId,
            createdByName: currentUserName,
            action: "Approve",
          }),
        });

        toast({
          title: "Approved",
          description: "BIA has been approved",
        });
        setStatus("Approved");
        fetchData(); // Refresh data
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to approve BIA",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error approving BIA:", error);
      toast({
        title: "Error",
        description: "Failed to approve BIA",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleSendBack = async () => {
    if (!sendBackComment.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Add send back comment and update status
      const commentRes = await fetch(`/api/process-bia/${processId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: sendBackComment,
          createdBy: currentUserId,
          createdByName: currentUserName,
          action: "SendBack",
          newStatus: "Sent Back",
        }),
      });

      if (commentRes.ok) {
        toast({
          title: "Sent Back",
          description: "BIA has been sent back for revision",
        });
        setIsSendBackDialogOpen(false);
        setSendBackComment("");
        setStatus("Sent Back");
        fetchData(); // Refresh data
      } else {
        const error = await commentRes.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send back BIA",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending back BIA:", error);
      toast({
        title: "Error",
        description: "Failed to send back BIA",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleCancel = () => {
    router.back();
  };

  // Determine if fields should be editable
  // Reviewer role has same access as CustomerAdmin (not DepartmentReviewer behavior)
  const isEditable = isDepartmentReviewer && !isReviewer
    ? status === "Pending Approval" // DeptReviewer can edit when pending
    : status === "Open" || status === "Sent Back"; // CustomerAdmin, Contributor, Reviewer can edit when open or sent back

  // Determine what buttons to show
  // Reviewer role has same access as CustomerAdmin (shows Submit button, not Approve buttons)
  const showApproveButtons = isDepartmentReviewer && !isReviewer && status === "Pending Approval";
  const showSubmitButton = (!isDepartmentReviewer || isReviewer) && (status === "Open" || status === "Sent Back");
  const showCommentsIcon = biaComments.length > 0 || status === "Pending Approval" || status === "Approved" || status === "Sent Back";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">Process</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-primary-600 font-medium">Business Impact Analysis</span>
      </div>

      {/* Top controls row */}
      <div className="flex items-center justify-end gap-4">
        <span className={`font-medium ${
          status === "Open" ? "text-info" :
          status === "Pending Approval" ? "text-warning" :
          status === "Approved" ? "text-success" :
          status === "Sent Back" ? "text-error" :
          "text-slate-600"
        }`}>
          {status}
        </span>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={isReviewer ? !(status === "Open" || status === "Sent Back") : !isEditable}>
          <SelectTrigger className="w-[200px] bg-white">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedApprover}
          onValueChange={setSelectedApprover}
          disabled={
            !isEditable ||
            (isDepartmentReviewer && !isReviewer) ||
            !selectedDepartment // For all roles: disabled if no department selected
          }
        >
          <SelectTrigger className="w-[200px] bg-white">
            <SelectValue placeholder={!selectedDepartment ? "Select Department First" : "Approver"} />
          </SelectTrigger>
          <SelectContent>
            {filteredApprovers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* DepartmentReviewer: Show Approve and Send Back buttons when status is Pending Approval */}
        {showApproveButtons && (
          <>
            <Button
              variant="outline"
              onClick={() => setIsSendBackDialogOpen(true)}
              disabled={saving}
              className="border-error/30 text-error hover:bg-error-light"
            >
              Send Back
            </Button>
            <Button onClick={handleApprove} disabled={saving}>
              {saving ? "Approving..." : "Approve"}
            </Button>
          </>
        )}

        {/* CustomerAdmin/Contributor: Show Submit button when status is Open or Sent Back */}
        {showSubmitButton && (
          <Button onClick={handleSubmitForApproval} disabled={saving}>
            {saving ? "Submitting..." : "Submit For Approval"}
          </Button>
        )}

        {/* Show comments icon when there are comments or status indicates approval flow has started */}
        {showCommentsIcon && !showApproveButtons && !showSubmitButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title="View Comments"
            onClick={() => setIsCommentsDialogOpen(true)}
          >
            <MessageSquare className="h-5 w-5 text-primary-600" />
          </Button>
        )}

        {/* Always show comments button if there are comments */}
        {biaComments.length > 0 && (showApproveButtons || showSubmitButton) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title={`View Comments (${biaComments.length})`}
            onClick={() => setIsCommentsDialogOpen(true)}
          >
            <MessageSquare className="h-5 w-5 text-primary-600" />
          </Button>
        )}
      </div>

      {/* Main content card */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
        {/* Process name */}
        <h2 className="text-lg font-semibold">{process?.name}</h2>

        {/* Category table */}
        <div className="border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-3 bg-slate-800 text-white">
            <div className="px-4 py-3 font-medium">Category</div>
            <div className="px-4 py-3 font-medium text-center">BIA Rating</div>
            <div className="px-4 py-3 font-medium">Description</div>
          </div>

          {/* Table rows */}
          {categories.map((category) => {
            const categoryRating = categoryRatings.find((cr) => cr.categoryName === category.name);
            return (
              <div
                key={category.id}
                className="grid grid-cols-3 border-b last:border-b-0"
              >
                <div className="px-4 py-4 text-sm">{category.name}</div>
                <div className="px-4 py-3 flex justify-center">
                  <Select
                    value={categoryRating?.rating || ""}
                    onValueChange={(value) => handleRatingChange(category.name, value)}
                    disabled={!isEditable}
                  >
                    <SelectTrigger className="w-[150px] bg-white">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {ratingOptions.map((option) => (
                        <SelectItem key={option.id} value={option.label}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  {categoryRating?.description || "-"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Impact Rating box */}
        <div className="border rounded-lg p-4 max-w-md">
          <div className="font-medium">Impact Rating = {calculateImpactRating()}</div>
          <p className="text-sm text-muted-foreground mt-1">{getCalculationNote()}</p>
        </div>

        {/* Recovery metrics row */}
        <div className="grid grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-600">RTO</label>
            <Input
              type="number"
              value={rtoHours}
              onChange={(e) => setRtoHours(parseInt(e.target.value) || 0)}
              min="0"
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-600">Low</label>
            <Input
              type="number"
              value={lowValue}
              onChange={(e) => setLowValue(parseInt(e.target.value) || 0)}
              min="0"
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-600">Critical</label>
            <Input
              type="number"
              value={criticalValue}
              onChange={(e) => setCriticalValue(parseInt(e.target.value) || 0)}
              min="0"
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-600">High</label>
            <Input
              type="number"
              value={highValue}
              onChange={(e) => setHighValue(parseInt(e.target.value) || 0)}
              min="0"
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-600">Medium</label>
            <Input
              type="number"
              value={mediumValue}
              onChange={(e) => setMediumValue(parseInt(e.target.value) || 0)}
              min="0"
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-600">RPO</label>
            <Input
              type="number"
              value={rpoHours}
              onChange={(e) => setRpoHours(parseInt(e.target.value) || 0)}
              min="0"
              disabled={!isEditable}
            />
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        {isEditable && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {/* Send Back Dialog */}
      <Dialog open={isSendBackDialogOpen} onOpenChange={setIsSendBackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Back for Revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Comment *</label>
              <Textarea
                value={sendBackComment}
                onChange={(e) => setSendBackComment(e.target.value)}
                placeholder="Enter reason for sending back..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendBackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendBack} disabled={saving || !sendBackComment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {saving ? "Sending..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>BIA Comments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            {biaComments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No comments yet</p>
            ) : (
              biaComments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{comment.createdByName}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      comment.action === "Approve" ? "bg-success-light text-success-dark" :
                      comment.action === "SendBack" ? "bg-error-light text-error-dark" :
                      "bg-info-light text-info-dark"
                    }`}>
                      {comment.action === "SendBack" ? "Sent Back" : comment.action}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{comment.comment}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCommentsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
