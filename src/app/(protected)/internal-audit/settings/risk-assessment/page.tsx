"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RiskFactor {
  id: string;
  label: string;
}

interface Probability {
  id: string;
  label: string;
  value: number;
}

interface Impact {
  id: string;
  label: string;
  value: number;
}

interface ScoringRange {
  id: string;
  label: string;
  lowValue: number;
  highValue: number | null;
  calculationType: string;
}

interface ScoringConfig {
  id: string;
  probabilityImpactCalcType: string;
  riskRatingCalcType: string;
}

const CALCULATION_TYPES = [
  { value: "High of all", label: "High of all" },
  { value: "Addition of all", label: "Addition of all" },
  { value: "Product of all", label: "Product of all" },
];

export default function RiskAssessmentConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Data states
  const [factors, setFactors] = useState<RiskFactor[]>([]);
  const [probabilities, setProbabilities] = useState<Probability[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [scoringRanges, setScoringRanges] = useState<ScoringRange[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig | null>(null);

  // Sort states
  const [factorSortOrder, setFactorSortOrder] = useState<"asc" | "desc">("asc");
  const [probabilitySortOrder, setProbabilitySortOrder] = useState<"asc" | "desc">("asc");
  const [impactSortOrder, setImpactSortOrder] = useState<"asc" | "desc">("asc");
  const [scoringRangeSortOrder, setScoringRangeSortOrder] = useState<"asc" | "desc">("asc");

  // Dialog states
  const [dialogType, setDialogType] = useState<"factor" | "probability" | "impact" | "scoringRange" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; item: any } | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [factorsRes, probabilitiesRes, impactsRes, scoringRangesRes, configRes] = await Promise.all([
        fetch("/api/internal-audit/risk-factors"),
        fetch("/api/internal-audit/probability"),
        fetch("/api/internal-audit/impact"),
        fetch("/api/internal-audit/scoring-ranges"),
        fetch("/api/internal-audit/scoring-config"),
      ]);

      if (factorsRes.ok) setFactors(await factorsRes.json());
      if (probabilitiesRes.ok) setProbabilities(await probabilitiesRes.json());
      if (impactsRes.ok) setImpacts(await impactsRes.json());
      if (scoringRangesRes.ok) setScoringRanges(await scoringRangesRes.json());
      if (configRes.ok) setScoringConfig(await configRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sort handlers
  const handleSortFactors = () => {
    const newOrder = factorSortOrder === "asc" ? "desc" : "asc";
    setFactorSortOrder(newOrder);
    const sorted = [...factors].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setFactors(sorted);
  };

  const handleSortProbabilities = () => {
    const newOrder = probabilitySortOrder === "asc" ? "desc" : "asc";
    setProbabilitySortOrder(newOrder);
    const sorted = [...probabilities].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setProbabilities(sorted);
  };

  const handleSortImpacts = () => {
    const newOrder = impactSortOrder === "asc" ? "desc" : "asc";
    setImpactSortOrder(newOrder);
    const sorted = [...impacts].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setImpacts(sorted);
  };

  const handleSortScoringRanges = () => {
    const newOrder = scoringRangeSortOrder === "asc" ? "desc" : "asc";
    setScoringRangeSortOrder(newOrder);
    const sorted = [...scoringRanges].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setScoringRanges(sorted);
  };

  // Dialog handlers
  const openAddDialog = (type: "factor" | "probability" | "impact" | "scoringRange") => {
    setDialogType(type);
    setEditItem(null);
    if (type === "factor") {
      setFormData({ label: "" });
    } else if (type === "probability" || type === "impact") {
      setFormData({ label: "", value: 0 });
    } else if (type === "scoringRange") {
      setFormData({ label: "", lowValue: 0, highValue: 0 });
    }
    setDialogOpen(true);
  };

  const openEditDialog = (type: "factor" | "probability" | "impact" | "scoringRange", item: any) => {
    setDialogType(type);
    setEditItem(item);
    if (type === "factor") {
      setFormData({ label: item.label });
    } else if (type === "probability" || type === "impact") {
      setFormData({ label: item.label, value: item.value });
    } else if (type === "scoringRange") {
      setFormData({ label: item.label, lowValue: item.lowValue, highValue: item.highValue || 0 });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.label?.trim()) return;

    setSaving(true);
    try {
      let url = "";
      let method = editItem ? "PUT" : "POST";
      let body: any = {};

      switch (dialogType) {
        case "factor":
          url = editItem ? `/api/internal-audit/risk-factors/${editItem.id}` : "/api/internal-audit/risk-factors";
          body = { label: formData.label };
          break;
        case "probability":
          url = editItem ? `/api/internal-audit/probability/${editItem.id}` : "/api/internal-audit/probability";
          body = { label: formData.label, value: Number(formData.value) || 0 };
          break;
        case "impact":
          url = editItem ? `/api/internal-audit/impact/${editItem.id}` : "/api/internal-audit/impact";
          body = { label: formData.label, value: Number(formData.value) || 0 };
          break;
        case "scoringRange":
          url = editItem ? `/api/internal-audit/scoring-ranges/${editItem.id}` : "/api/internal-audit/scoring-ranges";
          body = {
            label: formData.label,
            lowValue: Number(formData.lowValue) || 0,
            highValue: Number(formData.highValue) || 0,
            calculationType: scoringConfig?.riskRatingCalcType || "High of all",
          };
          break;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchAllData();
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (type: string, item: any) => {
    setItemToDelete({ type, item });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      let url = "";
      switch (itemToDelete.type) {
        case "factor":
          url = `/api/internal-audit/risk-factors/${itemToDelete.item.id}`;
          break;
        case "probability":
          url = `/api/internal-audit/probability/${itemToDelete.item.id}`;
          break;
        case "impact":
          url = `/api/internal-audit/impact/${itemToDelete.item.id}`;
          break;
        case "scoringRange":
          url = `/api/internal-audit/scoring-ranges/${itemToDelete.item.id}`;
          break;
      }

      const response = await fetch(url, { method: "DELETE" });

      if (response.ok) {
        fetchAllData();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleConfigChange = async (field: string, value: string) => {
    try {
      const response = await fetch("/api/internal-audit/scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const updated = await response.json();
        setScoringConfig(updated);
      }
    } catch (error) {
      console.error("Failed to update config:", error);
    }
  };

  const getDialogTitle = () => {
    switch (dialogType) {
      case "factor": return editItem ? "Edit Factor" : "Add Factor";
      case "probability": return editItem ? "Edit Probability" : "Add Probability";
      case "impact": return editItem ? "Edit Impact" : "Add Impact";
      case "scoringRange": return editItem ? "Edit Risk Score Range" : "Add Scoring Range";
      default: return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/internal-audit/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Risk Assessment</h1>
            <p className="text-gray-600">Configure risk assessment methodology</p>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-card rounded-lg border">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Risk Assessment Configuration</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Factors Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Factors</h3>
              <Button size="sm" onClick={() => openAddDialog("factor")}>
                <Plus className="h-4 w-4 mr-2" />
                New Risk Factor
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={handleSortFactors} className="flex items-center gap-2 -ml-4">
                      Label
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factors.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("factor", item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog("factor", item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {factors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                      No factors found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Probability Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Probability</h3>
              <Button size="sm" onClick={() => openAddDialog("probability")}>
                <Plus className="h-4 w-4 mr-2" />
                New Probability
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={handleSortProbabilities} className="flex items-center gap-2 -ml-4">
                      Label
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {probabilities.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.value}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("probability", item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog("probability", item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {probabilities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      No probabilities found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Impact Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Impact</h3>
              <Button size="sm" onClick={() => openAddDialog("impact")}>
                <Plus className="h-4 w-4 mr-2" />
                New Impact
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={handleSortImpacts} className="flex items-center gap-2 -ml-4">
                      Label
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impacts.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.value}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("impact", item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog("impact", item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {impacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      No impacts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Scoring Configuration Section */}
          <div className="border rounded-lg p-4 space-y-6">
            {/* Probability-Impact Scoring Calculation */}
            <div>
              <h3 className="text-lg font-medium mb-4">Probability-Impact Scoring Calculation</h3>
              <div className="space-y-2">
                <Label>Calculation Type</Label>
                <Select
                  value={scoringConfig?.probabilityImpactCalcType || "Product of all"}
                  onValueChange={(value) => handleConfigChange("probabilityImpactCalcType", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALCULATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Risk Rating Scoring Calculation */}
            <div>
              <h3 className="text-lg font-medium mb-4">Risk Rating Scoring Calculation</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Calculation Type</Label>
                  <Select
                    value={scoringConfig?.riskRatingCalcType || "Product of all"}
                    onValueChange={(value) => handleConfigChange("riskRatingCalcType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALCULATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Scoring Range */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Scoring Range</Label>
                    <Button size="sm" variant="outline" onClick={() => openAddDialog("scoringRange")}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Scoring Calculation
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" onClick={handleSortScoringRanges} className="flex items-center gap-2 -ml-4">
                            Label
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>Low</TableHead>
                        {scoringConfig?.riskRatingCalcType !== "High of all" && (
                          <TableHead>High</TableHead>
                        )}
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scoringRanges
                        .filter((item) => item.calculationType === scoringConfig?.riskRatingCalcType)
                        .map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.label}</TableCell>
                            <TableCell>{item.lowValue}</TableCell>
                            {scoringConfig?.riskRatingCalcType !== "High of all" && (
                              <TableCell>{item.highValue ?? "-"}</TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog("scoringRange", item)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openDeleteDialog("scoringRange", item)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      {scoringRanges.filter((item) => item.calculationType === scoringConfig?.riskRatingCalcType).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={scoringConfig?.riskRatingCalcType === "High of all" ? 3 : 4} className="text-center py-4 text-muted-foreground">
                            No scoring ranges found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={formData.label || ""}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Enter label"
                className="mt-2"
                autoFocus
              />
            </div>
            {(dialogType === "probability" || dialogType === "impact") && (
              <div>
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value || 0}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Enter value"
                  className="mt-2"
                />
              </div>
            )}
            {dialogType === "scoringRange" && (
              <>
                <div>
                  <Label htmlFor="lowValue">Lowest Value</Label>
                  <Input
                    id="lowValue"
                    type="number"
                    value={formData.lowValue || 0}
                    onChange={(e) => setFormData({ ...formData, lowValue: e.target.value })}
                    placeholder="Enter lowest value"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="highValue">Highest Value</Label>
                  <Input
                    id="highValue"
                    type="number"
                    value={formData.highValue || 0}
                    onChange={(e) => setFormData({ ...formData, highValue: e.target.value })}
                    placeholder="Enter highest value"
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.label?.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>OK</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
