"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
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
        <div className="h-3 bg-slate-200 rounded-sm overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-slate-300"></div>
            <span>Total</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary-500"></div>
            <span>{label}</span>
          </div>
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <span className="text-sm text-slate-700">{completed}/{total}</span>
        <br />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
    </div>
  );
}

export default function RiskResponsePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRiskDashboard = searchParams.get("from") === "risk-dashboard";
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { canEdit, canApprove } = usePermissions('risk.response');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is DepartmentReviewer or DepartmentContributor (department-scoped)
  const isDepartmentRole = userRoles.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  );
  const isDepartmentReviewer = userRoles.includes("DepartmentReviewer");
  const userDepartmentId = session?.user?.departmentId;

  // Filters - "all" shows all items without filtering
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");

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
        // In-Progress status: "Resume" button only (Submit for Approval is in details page)
        return (
          <Button
            size="sm"
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
            onClick={() => openDetail(risk)}
          >
            Resume
          </Button>
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

  // DepartmentReviewer only sees items with "Awaiting Approval", "Sent Back", or "Completed" status
  const reviewerFilteredRisks = isDepartmentReviewer
    ? departmentFilteredRisks.filter((risk) => {
        const status = normalizeStatus(risk.responseStatus || "Open");
        return status === "Awaiting Approval" || status === "Sent Back" || status === "Completed";
      })
    : departmentFilteredRisks;

  const filteredByStrategy = strategyFilter === "all"
    ? reviewerFilteredRisks
    : reviewerFilteredRisks.filter((risk) => risk.responseStrategy === strategyFilter);

  // Get normalized responseStatus for a risk (for Risk Response Strategy workflow)
  const getRiskStatus = (risk: Risk) => {
    const rawStatus = risk.responseStatus || "Open";
    return normalizeStatus(rawStatus);
  };

  // Filter risks based on progress status ("all" shows all items)
  const filteredByProgress = progressFilter === "all"
    ? filteredByStrategy
    : filteredByStrategy.filter((risk) => {
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
      case "all": return "All";
      case "Open": return "Open";
      case "In-Progress": return "InProgress";
      case "Completed": return "Completed";
      case "Awaiting Approval": return "Awaiting Approval";
      case "Sent Back": return "Sent Back";
      default: return progressFilter;
    }
  };

  // Display risks filtered by both strategy and progress status
  const displayRisks = filteredByProgress;

  if (loading) {
    return (
      <div className="space-y-6">
        {fromRiskDashboard && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/risks/dashboard")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Risk Dashboard
          </Button>
        )}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">Risk Response Strategy</h1>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {fromRiskDashboard && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/risks/dashboard")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Risk Dashboard
        </Button>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Risk Response Strategy</h1>
      </div>

      {/* Summary Cards with Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Response Strategy Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-slate-700">Risk Response Strategy</span>
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger className="w-32 h-8 bg-white">
                <SelectValue placeholder="Strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Transfer">Transfer</SelectItem>
                <SelectItem value="Avoid">Avoid</SelectItem>
                <SelectItem value="Accept">Accept</SelectItem>
                <SelectItem value="Treat">Treat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ProgressBar
            total={strategyTotal}
            completed={strategyClosed}
            label="Closed"
          />
        </div>

        {/* Risk Response Progress Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-slate-700">Risk Response Progress</span>
            <Select value={progressFilter} onValueChange={setProgressFilter}>
              <SelectTrigger className="w-40 h-8 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {/* DepartmentReviewer only sees Awaiting Approval, Sent Back, and Completed */}
                {!isDepartmentReviewer && <SelectItem value="Open">Open</SelectItem>}
                {!isDepartmentReviewer && <SelectItem value="In-Progress">In-Progress</SelectItem>}
                <SelectItem value="Awaiting Approval">Awaiting Approval</SelectItem>
                <SelectItem value="Sent Back">Sent Back</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ProgressBar
            total={progressTotal}
            completed={progressCount}
            label={getProgressLabel()}
          />
        </div>
      </div>

      {/* Risk List Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="h-12 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-slate-700 font-medium">Risk ID</TableHead>
              <TableHead className="text-slate-700 font-medium">Risk Name</TableHead>
              <TableHead className="text-slate-700 font-medium">Residual Risk Rating</TableHead>
              <TableHead className="text-slate-700 font-medium">Risk Priority</TableHead>
              <TableHead className="text-slate-700 font-medium">Risk Due Date</TableHead>
              <TableHead className="text-slate-700 font-medium">Response Status</TableHead>
              <TableHead className="text-slate-700 font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRisks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No risks found
                </TableCell>
              </TableRow>
            ) : (
              displayRisks.map((risk) => (
                <TableRow key={risk.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="py-3 font-medium text-primary-600">{risk.riskId}</TableCell>
                  <TableCell className="py-3 text-slate-800">{risk.name}</TableCell>
                  <TableCell className="py-3">
                    <span className={cn(
                      "text-sm font-medium",
                      risk.riskRating === "Low Risk" && "text-green-600",
                      risk.riskRating === "High" && "text-orange-600",
                      risk.riskRating === "Very high" && "text-red-600",
                      risk.riskRating === "Catastrophic" && "text-red-800"
                    )}>
                      {risk.riskRating || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-slate-600">-</TableCell>
                  <TableCell className="py-3 text-slate-600">
                    {risk.treatmentDueDate
                      ? new Date(risk.treatmentDueDate).toLocaleDateString("en-GB")
                      : "-"}
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      (risk.responseStatus || "Open") === "Completed" && "bg-green-100 text-green-800",
                      (risk.responseStatus || "Open") === "Awaiting Approval" && "bg-purple-100 text-purple-800",
                      (risk.responseStatus || "Open") === "In-Progress" && "bg-yellow-100 text-yellow-800",
                      (risk.responseStatus || "Open") === "Sent Back" && "bg-red-100 text-red-800",
                      (risk.responseStatus || "Open") === "Open" && "bg-blue-100 text-blue-800"
                    )}>
                      {risk.responseStatus || "Open"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    {getActionButtons(risk)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Success Dialog */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle>Information</AlertDialogTitle>
            <AlertDialogDescription>
              {successMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <AlertDialogAction onClick={() => setSuccessDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
