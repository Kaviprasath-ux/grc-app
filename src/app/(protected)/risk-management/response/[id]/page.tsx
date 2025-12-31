"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, DollarSign, CalendarDays, Target, TrendingDown, Save } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  residualRiskRating: number | null;
  inherentRiskRating: number | null;
  controlRating: number | null;
  likelihoodScore: number | null;
  impactScore: number | null;
  dueDate: string | null;
  budgetAllocated: number | null;
  budgetUsed: number | null;
  assessmentDate: string | null;
  nextReviewDate: string | null;
  owner: { fullName: string } | null;
  category: { name: string } | null;
  riskControls: {
    control: { id: string; controlCode: string; name: string; description: string | null };
    isPlanned: boolean;
    effectiveness: number | null;
  }[];
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
}

const ratingColors: Record<string, string> = {
  "Low Risk": "bg-green-500",
  "High": "bg-orange-500",
  "very high": "bg-yellow-500",
  "Catastrophic": "bg-red-500",
};

const strategyOptions = ["Accept", "Avoid", "Transfer", "Treat"];

export default function RiskResponseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [responseStrategy, setResponseStrategy] = useState<string>("");
  const [budgetAllocated, setBudgetAllocated] = useState<string>("");
  const [budgetUsed, setBudgetUsed] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [nextReviewDate, setNextReviewDate] = useState<string>("");

  // Dialogs
  const [isChooseControlOpen, setIsChooseControlOpen] = useState(false);
  const [isAddControlOpen, setIsAddControlOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<string>("");

  // New control form
  const [newControlCode, setNewControlCode] = useState("");
  const [newControlName, setNewControlName] = useState("");
  const [newControlDescription, setNewControlDescription] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [riskRes, controlsRes] = await Promise.all([
          fetch(`/api/risks/${resolvedParams.id}`),
          fetch("/api/controls"),
        ]);

        const riskData = await riskRes.json();
        setRisk(riskData);
        const controlsData = await controlsRes.json();
        setControls(Array.isArray(controlsData) ? controlsData : []);

        // Initialize form state
        setResponseStrategy(riskData.responseStrategy || "");
        setBudgetAllocated(riskData.budgetAllocated?.toString() || "");
        setBudgetUsed(riskData.budgetUsed?.toString() || "");
        setDueDate(riskData.dueDate ? new Date(riskData.dueDate).toISOString().split('T')[0] : "");
        setNextReviewDate(riskData.nextReviewDate ? new Date(riskData.nextReviewDate).toISOString().split('T')[0] : "");
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, [resolvedParams.id]);

  const getRatingFromScore = (score: number) => {
    if (score <= 10) return "Low Risk";
    if (score <= 50) return "High";
    if (score <= 99) return "very high";
    return "Catastrophic";
  };

  const handleSave = async () => {
    if (!risk) return;
    setSaving(true);

    try {
      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseStrategy,
          budgetAllocated: budgetAllocated ? parseFloat(budgetAllocated) : null,
          budgetUsed: budgetUsed ? parseFloat(budgetUsed) : null,
          dueDate: dueDate || null,
          nextReviewDate: nextReviewDate || null,
        }),
      });

      // Refresh risk data
      const res = await fetch(`/api/risks/${risk.id}`);
      setRisk(await res.json());
    } catch (error) {
      console.error("Error saving:", error);
    }
    setSaving(false);
  };

  const addPlannedControl = async () => {
    if (!risk || !selectedControlId) return;

    const existingControlIds = risk.riskControls.filter(rc => !rc.isPlanned).map(rc => rc.control.id);
    const plannedControlIds = [...risk.riskControls.filter(rc => rc.isPlanned).map(rc => rc.control.id), selectedControlId];

    await fetch(`/api/risks/${risk.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        controlIds: existingControlIds,
        plannedControlIds,
      }),
    });

    // Refresh
    const res = await fetch(`/api/risks/${risk.id}`);
    setRisk(await res.json());
    setIsChooseControlOpen(false);
    setSelectedControlId("");
  };

  const addNewControl = async () => {
    if (!risk || !newControlCode || !newControlName) return;

    try {
      // Create new control
      const controlRes = await fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlCode: newControlCode,
          name: newControlName,
          description: newControlDescription,
        }),
      });
      const newControl = await controlRes.json();

      // Add as planned control
      const existingControlIds = risk.riskControls.filter(rc => !rc.isPlanned).map(rc => rc.control.id);
      const plannedControlIds = [...risk.riskControls.filter(rc => rc.isPlanned).map(rc => rc.control.id), newControl.id];

      await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlIds: existingControlIds,
          plannedControlIds,
        }),
      });

      // Refresh
      const res = await fetch(`/api/risks/${risk.id}`);
      setRisk(await res.json());
      const controlsListRes = await fetch("/api/controls");
      setControls(await controlsListRes.json());

      setIsAddControlOpen(false);
      setNewControlCode("");
      setNewControlName("");
      setNewControlDescription("");
    } catch (error) {
      console.error("Error adding control:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Risk not found</p>
        <Button className="mt-4" onClick={() => router.push("/risk-management/response")}>
          Back to Response List
        </Button>
      </div>
    );
  }

  const daysRemaining = risk.dueDate
    ? Math.max(0, Math.ceil((new Date(risk.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const budgetRemaining = (parseFloat(budgetAllocated) || 0) - (parseFloat(budgetUsed) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Risk Response - ${risk.riskId}`}
        description={risk.name}
        actions={[
          {
            label: "Back",
            onClick: () => router.push("/risk-management/response"),
            variant: "outline" as const,
            icon: ArrowLeft,
          },
          {
            label: saving ? "Saving..." : "Save",
            onClick: handleSave,
            variant: "default" as const,
            icon: Save,
          },
        ]}
      />

      {/* Dashboard Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Risk Treatment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {risk.riskControls.filter(rc => rc.isPlanned).length} / {risk.riskControls.length}
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <p>Allocated: ${parseFloat(budgetAllocated || "0").toLocaleString()}</p>
              <p>Used: ${parseFloat(budgetUsed || "0").toLocaleString()}</p>
              <p className={budgetRemaining >= 0 ? "text-green-600" : "text-red-600"}>
                Remaining: ${budgetRemaining.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Days Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {daysRemaining !== null ? daysRemaining : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Residual Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={ratingColors[getRatingFromScore(risk.residualRiskRating || 0)]}>
              {getRatingFromScore(risk.residualRiskRating || 0)}
            </Badge>
            <p className="text-xs mt-1">{risk.residualRiskRating?.toFixed(2) || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Planned Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-green-500">Low Risk</Badge>
            <p className="text-xs mt-1">Target</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Risk Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold">{risk.inherentRiskRating?.toFixed(1) || 0}</div>
                  <p className="text-sm text-muted-foreground mt-1">Inherent Risk</p>
                  <Badge className={ratingColors[getRatingFromScore(risk.inherentRiskRating || 0)]} >
                    {getRatingFromScore(risk.inherentRiskRating || 0)}
                  </Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold">{risk.residualRiskRating?.toFixed(1) || 0}</div>
                  <p className="text-sm text-muted-foreground mt-1">Residual Risk</p>
                  <Badge className={ratingColors[getRatingFromScore(risk.residualRiskRating || 0)]}>
                    {getRatingFromScore(risk.residualRiskRating || 0)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Control Effectiveness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-32 h-32 mx-auto">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      className="text-muted"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={`${(risk.controlRating || 0) * 3.52} 352`}
                      className="text-primary"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{risk.controlRating || 0}%</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Overall Effectiveness</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Details Form */}
      <Card>
        <CardHeader>
          <CardTitle>Response Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Risk Response Strategy</Label>
              <Select value={responseStrategy} onValueChange={setResponseStrategy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategyOptions.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Badge variant="outline" className="text-lg px-4 py-2">{risk.status}</Badge>
            </div>
            <div className="space-y-2">
              <Label>Budget Allocated ($)</Label>
              <Input
                type="number"
                value={budgetAllocated}
                onChange={(e) => setBudgetAllocated(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Budget Used ($)</Label>
              <Input
                type="number"
                value={budgetUsed}
                onChange={(e) => setBudgetUsed(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Next Review Date</Label>
              <Input
                type="date"
                value={nextReviewDate}
                onChange={(e) => setNextReviewDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Info */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Risk ID</Label>
              <p className="font-medium">{risk.riskId}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Category</Label>
              <p className="font-medium">{risk.category?.name || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Owner</Label>
              <p className="font-medium">{risk.owner?.fullName || "-"}</p>
            </div>
            <div className="space-y-1 col-span-3">
              <Label className="text-muted-foreground">Description</Label>
              <p>{risk.description || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Likelihood Score</Label>
              <p className="font-medium">{risk.likelihoodScore || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Impact Score</Label>
              <p className="font-medium">{risk.impactScore || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Assessment Date</Label>
              <p className="font-medium">{risk.assessmentDate ? new Date(risk.assessmentDate).toLocaleDateString() : "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Controls</CardTitle>
        </CardHeader>
        <CardContent>
          {risk.riskControls.filter(rc => !rc.isPlanned).length > 0 ? (
            <Accordion type="single" collapsible>
              {risk.riskControls.filter(rc => !rc.isPlanned).map(rc => (
                <AccordionItem key={rc.control.id} value={rc.control.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span>{rc.control.controlCode} - {rc.control.name}</span>
                      <Badge variant="secondary">{rc.effectiveness || 0}% effective</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">{rc.control.description || "No description"}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-muted-foreground">No existing controls linked to this risk</p>
          )}
        </CardContent>
      </Card>

      {/* Planned Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Planned Controls</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsAddControlOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add New Control
            </Button>
            <Button onClick={() => setIsChooseControlOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Choose Existing Control
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {risk.riskControls.filter(rc => rc.isPlanned).length > 0 ? (
            <div className="space-y-2">
              {risk.riskControls.filter(rc => rc.isPlanned).map(rc => (
                <div key={rc.control.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <span className="font-medium">{rc.control.controlCode} - {rc.control.name}</span>
                    <p className="text-sm text-muted-foreground">{rc.control.description}</p>
                  </div>
                  <Badge variant="secondary">Planned</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No planned controls. Add controls to treat this risk.</p>
          )}
        </CardContent>
      </Card>

      {/* Choose Existing Control Dialog */}
      <Dialog open={isChooseControlOpen} onOpenChange={setIsChooseControlOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Existing Control</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Control</Label>
              <Select value={selectedControlId} onValueChange={setSelectedControlId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a control" />
                </SelectTrigger>
                <SelectContent>
                  {controls
                    .filter(c => !risk.riskControls.some(rc => rc.control.id === c.id))
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.controlCode} - {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChooseControlOpen(false)}>Cancel</Button>
            <Button onClick={addPlannedControl} disabled={!selectedControlId}>Add Control</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Control Dialog */}
      <Dialog open={isAddControlOpen} onOpenChange={setIsAddControlOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Control</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Control Code *</Label>
              <Input
                value={newControlCode}
                onChange={(e) => setNewControlCode(e.target.value)}
                placeholder="e.g., CTRL-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Control Name *</Label>
              <Input
                value={newControlName}
                onChange={(e) => setNewControlName(e.target.value)}
                placeholder="Enter control name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newControlDescription}
                onChange={(e) => setNewControlDescription(e.target.value)}
                placeholder="Enter control description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddControlOpen(false)}>Cancel</Button>
            <Button onClick={addNewControl} disabled={!newControlCode || !newControlName}>
              Create & Add Control
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
