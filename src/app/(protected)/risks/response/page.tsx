"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useUserRoles, usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan: string | null;
  treatmentDueDate: string | null;
  likelihood: number;
  impact: number;
  owner: { fullName: string } | null;
  assessmentStatus?: string;
  responseStatus?: string; // Separate status for Risk Response Strategy workflow
  department?: { id: string; name: string } | null;
}

// Horizontal Progress Bar component matching website
function ProgressBar({
  total,
  completed,
  label
}: {
  total: number;
  completed: number;
  label: string;
}) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="h-3 bg-gray-200 rounded-sm overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300"></div>
            <span>Total</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500"></div>
            <span>{label}</span>
          </div>
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <span className="text-sm">{completed}/{total}</span>
        <br />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export default function RiskResponsePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { canEdit, canApprove } = usePermissions('risk.response');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is DepartmentReviewer or DepartmentContributor (department-scoped)
  const isDepartmentRole = userRoles.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  );
  const userDepartmentId = session?.user?.departmentId;

  // Filters - Default to first option (no "all" option per source system)
  const [strategyFilter, setStrategyFilter] = useState("Treat");
  const [progressFilter, setProgressFilter] = useState("Completed");

  // Dialog states
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      const response = await fetch("/api/risks");
      if (response.ok) {
        const data = await response.json();
        // Only show risks that have been assessed (have a response strategy or are in progress)
        const assessedRisks = (data.data || []).filter((risk: Risk) =>
          risk.responseStrategy || risk.assessmentStatus === "Completed" || risk.assessmentStatus === "In-Progress"
        );
        setRisks(assessedRisks.length > 0 ? assessedRisks : data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (risk: Risk) => {
    router.push(`/risks/response/${risk.id}`);
  };

  // Handle Respond action - changes responseStatus from Open to In-Progress
  const handleRespond = async (risk: Risk, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(risk.id);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "In-Progress" }),
      });
      if (response.ok) {
        // Update local state and navigate to detail
        setRisks(prev => prev.map(r =>
          r.id === risk.id ? { ...r, responseStatus: "In-Progress" } : r
        ));
        router.push(`/risks/response/${risk.id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("PATCH failed:", response.status, errorData);
        alert(`Failed to update: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to respond:", error);
      alert("Network error: Failed to respond");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Submit for Approval action
  const handleSubmitForApproval = async (risk: Risk, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(risk.id);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "Awaiting Approval" }),
      });
      if (response.ok) {
        setSuccessMessage("Risk Submit for Approval Successfully !");
        setSuccessDialogOpen(true);
        // Update local state
        setRisks(prev => prev.map(r =>
          r.id === risk.id ? { ...r, responseStatus: "Awaiting Approval" } : r
        ));
      }
    } catch (error) {
      console.error("Failed to submit for approval:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Approve action
  const handleApprove = async (risk: Risk, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(risk.id);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "Completed" }),
      });
      if (response.ok) {
        setSuccessMessage("Risk Approved Successfully !");
        setSuccessDialogOpen(true);
        // Update local state
        setRisks(prev => prev.map(r =>
          r.id === risk.id ? { ...r, responseStatus: "Completed" } : r
        ));
      }
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Normalize status to handle variations (e.g., "In Progress" vs "In-Progress")
  const normalizeStatus = (status: string): string => {
    const normalized = status.toLowerCase().replace(/\s+/g, '-');
    if (normalized === 'in-progress') return 'In-Progress';
    if (normalized === 'awaiting-approval') return 'Awaiting Approval';
    if (normalized === 'completed' || normalized === 'closed') return 'Completed';
    if (normalized === 'sent-back') return 'Sent Back';
    if (normalized === 'open') return 'Open';
    return status;
  };

  // Get action buttons based on risk responseStatus - matching source system exactly
  // Permission-gated: Submit for Approval requires edit, Approve requires approve permission
  const getActionButtons = (risk: Risk) => {
    // Use responseStatus for Risk Response Strategy workflow (separate from assessmentStatus)
    const rawStatus = risk.responseStatus || "Open";
    const status = normalizeStatus(rawStatus);
    const isLoading = actionLoading === risk.id;

    switch (status) {
      case "Open":
        // Open status: "Respond" button (changes status to In-Progress)
        return canEdit ? (
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={(e) => handleRespond(risk, e)}
            disabled={isLoading}
          >
            {isLoading ? "..." : "Respond"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
            onClick={() => openDetail(risk)}
          >
            View
          </Button>
        );
      case "In-Progress":
        // In-Progress status: "Submit for Approval" (if canEdit) + "Resume" buttons
        return (
          <div className="flex gap-2">
            {canEdit && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={(e) => handleSubmitForApproval(risk, e)}
                disabled={isLoading}
              >
                {isLoading ? "..." : "Submit for Approval"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
              onClick={() => openDetail(risk)}
            >
              Resume
            </Button>
          </div>
        );
      case "Sent Back":
        // Sent Back status: "Resume" button to view and resubmit (if canEdit)
        return canEdit ? (
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => openDetail(risk)}
          >
            Resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
            onClick={() => openDetail(risk)}
          >
            View
          </Button>
        );
      case "Awaiting Approval":
        // Awaiting Approval status: "Approve" (if canApprove) + "View" buttons
        return (
          <div className="flex gap-2">
            {canApprove && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={(e) => handleApprove(risk, e)}
                disabled={isLoading}
              >
                {isLoading ? "..." : "Approve"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
              onClick={() => openDetail(risk)}
            >
              View
            </Button>
          </div>
        );
      case "Completed":
        // Completed status: "View" button only
        return (
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={() => openDetail(risk)}
          >
            View
          </Button>
        );
      default:
        // Default fallback - treat as Open
        return canEdit ? (
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={(e) => handleRespond(risk, e)}
            disabled={isLoading}
          >
            {isLoading ? "..." : "Respond"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
            onClick={() => openDetail(risk)}
          >
            View
          </Button>
        );
    }
  };

  // Filter risks based on strategy (no "all" option per source system)
  // First apply department filtering for department-scoped roles
  const departmentFilteredRisks = isDepartmentRole && userDepartmentId
    ? risks.filter((risk) => risk.department?.id === userDepartmentId)
    : risks;

  const filteredByStrategy = departmentFilteredRisks.filter((risk) => risk.responseStrategy === strategyFilter);

  // Get normalized responseStatus for a risk (for Risk Response Strategy workflow)
  const getRiskStatus = (risk: Risk) => {
    const rawStatus = risk.responseStatus || "Open";
    return normalizeStatus(rawStatus);
  };

  // Filter risks based on progress status (no "all" option per source system)
  const filteredByProgress = filteredByStrategy.filter((risk) => {
    const status = getRiskStatus(risk);
    return status === progressFilter;
  });

  // Calculate stats for strategy card
  // Background bar = total risks with selected strategy
  // Foreground bar = closed/completed risks with selected strategy
  const strategyTotal = filteredByStrategy.length;
  const strategyClosed = filteredByStrategy.filter(r => {
    const status = getRiskStatus(r);
    return status === "Completed" || r.status === "Closed";
  }).length;

  // Calculate stats for progress card
  // Background bar = total risks with selected strategy
  // Foreground bar = risks with selected status
  const progressTotal = strategyTotal; // Total from selected strategy
  const progressCount = filteredByProgress.length; // Risks matching selected status

  // Get progress label based on filter selection
  const getProgressLabel = () => {
    switch (progressFilter) {
      case "Open": return "Open";
      case "In-Progress": return "InProgress";
      case "Completed": return "Completed";
      case "Awaiting Approval": return "Awaiting Approval";
      case "Sent Back": return "Sent Back";
      default: return progressFilter;
    }
  };

  // Display risks filtered by strategy only (list shows all statuses for selected strategy)
  const displayRisks = filteredByStrategy;

  const clearStrategyFilter = () => setStrategyFilter("Treat");
  const clearProgressFilter = () => setProgressFilter("Completed");

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Risk Response Strategy" description="Risk Management" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Risk Response Strategy" description="Risk Management" />

      {/* Summary Cards with Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Response Strategy Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Risk Response Strategy</span>
              <div className="flex items-center border rounded">
                <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                  <SelectTrigger className="w-32 h-8 border-0">
                    <SelectValue placeholder="Strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                    <SelectItem value="Avoid">Avoid</SelectItem>
                    <SelectItem value="Accept">Accept</SelectItem>
                    <SelectItem value="Treat">Treat</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 border-l"
                  onClick={clearStrategyFilter}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ProgressBar
              total={strategyTotal}
              completed={strategyClosed}
              label="Closed"
            />
          </CardContent>
        </Card>

        {/* Risk Response Progress Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Risk Response Progress</span>
              <div className="flex items-center border rounded">
                <Select value={progressFilter} onValueChange={setProgressFilter}>
                  <SelectTrigger className="w-40 h-8 border-0">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In-Progress">In-Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Awaiting Approval">Awaiting Approval</SelectItem>
                    <SelectItem value="Sent Back">Sent Back</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 border-l"
                  onClick={clearProgressFilter}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ProgressBar
              total={progressTotal}
              completed={progressCount}
              label={getProgressLabel()}
            />
          </CardContent>
        </Card>
      </div>

      {/* Risk List */}
      <div className="space-y-3">
        {displayRisks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No risks found
            </CardContent>
          </Card>
        ) : (
          displayRisks.map((risk) => (
            <Card key={risk.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{risk.riskId}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="font-medium">{risk.name}</span>
                    </div>
                  </div>
                  {getActionButtons(risk)}
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Residual Risk Rating</p>
                    <span className={cn(
                      "text-sm font-medium",
                      risk.riskRating === "Low Risk" && "text-green-600",
                      risk.riskRating === "High" && "text-orange-600",
                      risk.riskRating === "Very high" && "text-red-600",
                      risk.riskRating === "Catastrophic" && "text-red-800"
                    )}>
                      {risk.riskRating || "-"}
                    </span>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk Priority</p>
                    <p className="font-medium"></p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk DueDate</p>
                    <p className="font-medium">
                      {risk.treatmentDueDate
                        ? new Date(risk.treatmentDueDate).toLocaleDateString("en-GB")
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Response Status</p>
                    <span className="text-sm font-medium">
                      {risk.responseStatus || "Open"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Success Dialog */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Information</AlertDialogTitle>
            <AlertDialogDescription>
              {successMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSuccessDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
