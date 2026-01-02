"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, Plus } from "lucide-react";
import { AddControlDialog } from "@/components/risks/add-control-dialog";
import { ChooseControlDialog } from "@/components/risks/choose-control-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
}

interface Control {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  effectiveness: number;
}

interface PlannedControl {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  domain?: string;
  functionalGrouping?: string;
}

export default function RiskViewPage() {
  const params = useParams();
  const router = useRouter();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [controls, setControls] = useState<Control[]>([]);
  const [expandedControls, setExpandedControls] = useState<string[]>([]);
  const [plannedControls, setPlannedControls] = useState<PlannedControl[]>([]);
  const [expandedPlannedControls, setExpandedPlannedControls] = useState<string[]>([]);
  const [addControlOpen, setAddControlOpen] = useState(false);
  const [chooseControlOpen, setChooseControlOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchRisk(params.id as string);
      fetchPlannedControls(params.id as string);
    }
  }, [params.id]);

  const fetchPlannedControls = async (riskId: string) => {
    try {
      const response = await fetch(`/api/risks/${riskId}/planned-controls`);
      if (response.ok) {
        const data = await response.json();
        setPlannedControls(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch planned controls:", error);
    }
  };

  const handleControlAdded = (control: PlannedControl) => {
    setPlannedControls(prev => [...prev, control]);
  };

  const togglePlannedControl = (id: string) => {
    setExpandedPlannedControls(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSubmitForApproval = async () => {
    if (!risk) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Awaiting Approval",
        }),
      });

      if (response.ok) {
        setSuccessDialogOpen(true);
        // Update local state
        setRisk(prev => prev ? { ...prev, status: "Awaiting Approval" } : null);
      }
    } catch (error) {
      console.error("Failed to submit for approval:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchRisk = async (id: string) => {
    try {
      const response = await fetch(`/api/risks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRisk(data);
        // Fetch controls for this risk (mock for now)
        setControls([
          {
            id: "1",
            controlId: "RSK-01.1",
            name: "Risk Framing",
            description: "Mechanisms exist to identify: \u25aa Assumptions affecting risk assessments, risk response and risk monitoring; \u25aa Constraints affecting risk assessments, risk response and risk monitoring; \u25aa The organizational risk tolerance; and \u25aa Priorities, benefits and trade-offs considered by the organization for managing risk.",
            effectiveness: 20,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch risk:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleControl = (id: string) => {
    setExpandedControls(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Calculate days remaining
  const getDaysRemaining = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Get likelihood/impact labels
  const getLikelihoodLabel = (value: number) => {
    if (value >= 8) return "High";
    if (value >= 5) return "Moderate";
    return "Rare";
  };

  const getImpactLabel = (value: number) => {
    if (value >= 8) return "High impact";
    if (value >= 5) return "Moderate";
    return "Low";
  };

  // Get risk rating color
  const getRiskRatingColor = (rating: string) => {
    switch (rating) {
      case "Low Risk": return "text-green-600";
      case "High": return "text-orange-600";
      case "Very high": return "text-red-600";
      case "Catastrophic": return "text-red-800";
      default: return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="link" className="p-0 h-auto" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span>|</span>
          <span className="font-medium text-primary">Risk View</span>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Risk not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(risk.treatmentDueDate);

  return (
    <div className="space-y-6">
      {/* Header with Back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="link" className="p-0 h-auto text-muted-foreground" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-muted-foreground">|</span>
          <span className="font-semibold text-primary text-lg">Risk View</span>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90"
          onClick={handleSubmitForApproval}
          disabled={submitting || risk?.status === "Awaiting Approval"}
        >
          {submitting ? "Submitting..." : "Submit for Approval"}
        </Button>
      </div>

      {/* Charts - 2x2 Grid Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Risk Treatment - Donut Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary font-semibold">Risk Treatment</CardTitle>
          </CardHeader>
          <CardContent>
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Completed", value: 0 },
                            { name: "Remaining", value: 100 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={50}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell fill="#3B82F6" />
                          <Cell fill="#E5E7EB" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className="text-lg font-bold">100%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                      <span>Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-200 rounded-sm"></div>
                      <span>Total</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Budget Allocation Vs Used */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary font-semibold">Budget Allocation Vs Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex flex-col justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Allocated</p>
                <p className="text-3xl font-bold">0</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500"></div>
                  <span>Used - 0</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-200"></div>
                  <span>Remaining - 0</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Days Remaining - Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary font-semibold">Days Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              <div className="w-full">
                {/* Simple bar representation */}
                <div className="flex items-end justify-center gap-1 h-32">
                  {[0, 2, 4, 6].map((val, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-8 bg-blue-500 rounded-t",
                        daysRemaining >= val ? "opacity-100" : "opacity-30"
                      )}
                      style={{ height: `${(val + 1) * 15}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-center gap-1 mt-2 text-xs text-muted-foreground">
                  <span className="w-8 text-center">0</span>
                  <span className="w-8 text-center">2</span>
                  <span className="w-8 text-center">4</span>
                  <span className="w-8 text-center">6</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Residual Risk Rating */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary font-semibold">Residual Risk Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex flex-col justify-between">
              {/* Gauge-like display */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-orange-500 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                </div>
                <span className={cn("text-lg font-semibold", getRiskRatingColor(risk.riskRating))}>
                  {risk.riskRating} (35.00)
                </span>
              </div>

              {/* Planned Residual Risk Rating */}
              <div className="border-t pt-4">
                <p className="text-sm text-primary font-medium mb-2">Planned Residual Risk Rating</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-orange-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  </div>
                  <span className={cn("font-semibold", getRiskRatingColor(risk.riskRating))}>
                    {risk.riskRating} (35.00)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Details */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-lg text-primary">{risk.riskId}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium text-lg">{risk.name}</span>
          </div>
          <p className="text-muted-foreground mb-6">{risk.description}</p>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Risk Owner</p>
              <p className="font-medium">{risk.owner?.fullName || "No items found"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Likelihood</p>
              <p className="font-medium">{getLikelihoodLabel(risk.likelihood)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Impact</p>
              <p className="font-medium">{getImpactLabel(risk.impact)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Inherent Risk Rating</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Residual Risk Rating</p>
              <span className={cn("font-medium", getRiskRatingColor(risk.riskRating))}>
                {risk.riskRating}
              </span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Control Rating</p>
              <p className="font-medium">-</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Risk Response Strategy</p>
              <p className="font-medium">{risk.responseStrategy || "Treat"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assessment Date</p>
              <p className="font-medium">{new Date().toLocaleDateString("en-GB")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Review Date</p>
              <p className="font-medium">-</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Controls */}
      <div>
        <p className="text-muted-foreground mb-3">Existing Controls</p>
        <div className="space-y-2">
          {controls.map((control) => (
            <Card key={control.id}>
              <Collapsible
                open={expandedControls.includes(control.id)}
                onOpenChange={() => toggleControl(control.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-4 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2">
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform text-muted-foreground",
                        expandedControls.includes(control.id) && "rotate-180"
                      )} />
                      <span>{control.controlId} - {control.name}</span>
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <p className="text-sm text-muted-foreground mb-4">{control.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Department</p>
                          <p className="text-sm font-medium">Assigned To:</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{control.effectiveness}%</p>
                          <p className="text-sm text-muted-foreground">partially effective</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      </div>

      {/* Planned Controls */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-primary font-medium">Planned Controls</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddControlOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add New Control
            </Button>
            <Button variant="outline" size="sm" onClick={() => setChooseControlOpen(true)}>
              Choose Control
            </Button>
          </div>
        </div>
        {plannedControls.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-center text-muted-foreground">
              No items found
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {plannedControls.map((control) => (
              <Card key={control.id}>
                <Collapsible
                  open={expandedPlannedControls.includes(control.id)}
                  onOpenChange={() => togglePlannedControl(control.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-4 h-auto hover:bg-transparent">
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform text-muted-foreground",
                          expandedPlannedControls.includes(control.id) && "rotate-180"
                        )} />
                        <span>{control.controlId} - {control.name}</span>
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <p className="text-sm text-muted-foreground mb-4">{control.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          {control.domain && (
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {control.domain}
                            </span>
                          )}
                          {control.functionalGrouping && (
                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                              {control.functionalGrouping}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddControlDialog
        open={addControlOpen}
        onOpenChange={setAddControlOpen}
        onControlAdded={handleControlAdded}
        riskId={params.id as string}
      />
      <ChooseControlDialog
        open={chooseControlOpen}
        onOpenChange={setChooseControlOpen}
        onControlSelected={handleControlAdded}
        riskId={params.id as string}
      />

      {/* Success Dialog */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Information</AlertDialogTitle>
            <AlertDialogDescription>
              Risk Submit for Approval Successfully!
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
