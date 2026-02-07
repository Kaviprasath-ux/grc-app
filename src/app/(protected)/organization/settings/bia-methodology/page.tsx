"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Settings } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

interface BIARating {
  id: string;
  label: string;
  score: number;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface BIAScoringRange {
  id: string;
  label: string;
  lowValue: number;
  highValue: number | null;
  color: string | null;
  calculationType: string;
  sortOrder: number;
}

interface BIAScoringConfig {
  id: string;
  calculationType: string;
  isActive: boolean;
}

export default function BIAMethodologyPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("ratings");

  // Ratings state
  const [ratings, setRatings] = useState<BIARating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(true);
  const [searchRatings, setSearchRatings] = useState("");

  // Scoring config state
  const [scoringConfig, setScoringConfig] = useState<BIAScoringConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Scoring ranges state
  const [scoringRanges, setScoringRanges] = useState<BIAScoringRange[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(true);

  // Dialog states
  const [isAddRatingOpen, setIsAddRatingOpen] = useState(false);
  const [isEditRatingOpen, setIsEditRatingOpen] = useState(false);
  const [isDeleteRatingOpen, setIsDeleteRatingOpen] = useState(false);
  const [editingRating, setEditingRating] = useState<BIARating | null>(null);
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);

  const [isAddRangeOpen, setIsAddRangeOpen] = useState(false);
  const [isEditRangeOpen, setIsEditRangeOpen] = useState(false);
  const [isDeleteRangeOpen, setIsDeleteRangeOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<BIAScoringRange | null>(null);
  const [deletingRangeId, setDeletingRangeId] = useState<string | null>(null);

  // Form states
  const [ratingForm, setRatingForm] = useState({
    label: "",
    score: 0,
    description: "",
    color: "#3b82f6",
    sortOrder: 0,
    isActive: true,
  });

  const [rangeForm, setRangeForm] = useState({
    label: "",
    lowValue: 0,
    highValue: 100,
    color: "#3b82f6",
    sortOrder: 0,
  });

  useEffect(() => {
    fetchRatings();
    fetchScoringConfig();
    fetchScoringRanges();
  }, []);

  const fetchRatings = async () => {
    try {
      const res = await fetch("/api/bia/ratings");
      if (res.ok) {
        const data = await res.json();
        setRatings(data);
      }
    } catch (error) {
      console.error("Error fetching BIA ratings:", error);
    } finally {
      setLoadingRatings(false);
    }
  };

  const fetchScoringConfig = async () => {
    try {
      const res = await fetch("/api/bia/scoring-config");
      if (res.ok) {
        const data = await res.json();
        setScoringConfig(data);
      }
    } catch (error) {
      console.error("Error fetching scoring config:", error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchScoringRanges = async () => {
    try {
      const calcType = scoringConfig?.calculationType || "High of all";
      const res = await fetch(`/api/bia/scoring-ranges?calculationType=${encodeURIComponent(calcType)}`);
      if (res.ok) {
        const data = await res.json();
        setScoringRanges(data);
      }
    } catch (error) {
      console.error("Error fetching scoring ranges:", error);
    } finally {
      setLoadingRanges(false);
    }
  };

  const updateScoringConfig = async (calculationType: string) => {
    try {
      const res = await fetch("/api/bia/scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calculationType }),
      });
      if (res.ok) {
        const data = await res.json();
        setScoringConfig(data);
        fetchScoringRanges();
      }
    } catch (error) {
      console.error("Error updating scoring config:", error);
    }
  };

  // Rating CRUD handlers
  const handleAddRating = async () => {
    if (!ratingForm.label.trim()) return;
    try {
      const res = await fetch("/api/bia/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratingForm),
      });
      if (res.ok) {
        await fetchRatings();
        setIsAddRatingOpen(false);
        resetRatingForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create rating");
      }
    } catch (error) {
      console.error("Error creating rating:", error);
    }
  };

  const handleEditRating = async () => {
    if (!editingRating || !ratingForm.label.trim()) return;
    try {
      const res = await fetch(`/api/bia/ratings/${editingRating.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratingForm),
      });
      if (res.ok) {
        await fetchRatings();
        setIsEditRatingOpen(false);
        setEditingRating(null);
        resetRatingForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update rating");
      }
    } catch (error) {
      console.error("Error updating rating:", error);
    }
  };

  const handleDeleteRating = async () => {
    if (!deletingRatingId) return;
    try {
      const res = await fetch(`/api/bia/ratings/${deletingRatingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchRatings();
        setIsDeleteRatingOpen(false);
        setDeletingRatingId(null);
      }
    } catch (error) {
      console.error("Error deleting rating:", error);
    }
  };

  // Range CRUD handlers
  const handleAddRange = async () => {
    if (!rangeForm.label.trim()) return;
    try {
      const res = await fetch("/api/bia/scoring-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rangeForm,
          calculationType: scoringConfig?.calculationType || "High of all",
        }),
      });
      if (res.ok) {
        await fetchScoringRanges();
        setIsAddRangeOpen(false);
        resetRangeForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create range");
      }
    } catch (error) {
      console.error("Error creating range:", error);
    }
  };

  const handleEditRange = async () => {
    if (!editingRange || !rangeForm.label.trim()) return;
    try {
      const res = await fetch(`/api/bia/scoring-ranges/${editingRange.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rangeForm,
          calculationType: scoringConfig?.calculationType || "High of all",
        }),
      });
      if (res.ok) {
        await fetchScoringRanges();
        setIsEditRangeOpen(false);
        setEditingRange(null);
        resetRangeForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update range");
      }
    } catch (error) {
      console.error("Error updating range:", error);
    }
  };

  const handleDeleteRange = async () => {
    if (!deletingRangeId) return;
    try {
      const res = await fetch(`/api/bia/scoring-ranges/${deletingRangeId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchScoringRanges();
        setIsDeleteRangeOpen(false);
        setDeletingRangeId(null);
      }
    } catch (error) {
      console.error("Error deleting range:", error);
    }
  };

  const resetRatingForm = () => {
    setRatingForm({
      label: "",
      score: 0,
      description: "",
      color: "#3b82f6",
      sortOrder: 0,
      isActive: true,
    });
  };

  const resetRangeForm = () => {
    setRangeForm({
      label: "",
      lowValue: 0,
      highValue: 100,
      color: "#3b82f6",
      sortOrder: 0,
    });
  };

  const openEditRatingDialog = (item: BIARating) => {
    setEditingRating(item);
    setRatingForm({
      label: item.label,
      score: item.score,
      description: item.description || "",
      color: item.color || "#3b82f6",
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    setIsEditRatingOpen(true);
  };

  const openEditRangeDialog = (item: BIAScoringRange) => {
    setEditingRange(item);
    setRangeForm({
      label: item.label,
      lowValue: item.lowValue,
      highValue: item.highValue || 100,
      color: item.color || "#3b82f6",
      sortOrder: item.sortOrder,
    });
    setIsEditRangeOpen(true);
  };

  const filteredRatings = ratings.filter((item) =>
    item.label.toLowerCase().includes(searchRatings.toLowerCase())
  );

  const ratingColumns: ColumnDef<BIARating>[] = [
    {
      accessorKey: "label",
      header: "Rating Label",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: row.original.color || "#3b82f6" }}
          />
          <span className="font-medium">{row.getValue("label")}</span>
        </div>
      ),
    },
    {
      accessorKey: "score",
      header: "Score Value",
      cell: ({ row }) => row.getValue("score"),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm truncate max-w-[300px] block">
          {row.getValue("description") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
          {row.getValue("isActive") ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditRatingDialog(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeletingRatingId(row.original.id);
              setIsDeleteRatingOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const rangeColumns: ColumnDef<BIAScoringRange>[] = [
    {
      accessorKey: "label",
      header: "Criticality Label",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: row.original.color || "#3b82f6" }}
          />
          <span className="font-medium">{row.getValue("label")}</span>
        </div>
      ),
    },
    {
      accessorKey: "lowValue",
      header: "Min Score",
      cell: ({ row }) => row.getValue("lowValue"),
    },
    {
      accessorKey: "highValue",
      header: "Max Score",
      cell: ({ row }) => row.getValue("highValue") ?? "No limit",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditRangeDialog(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeletingRangeId(row.original.id);
              setIsDeleteRangeOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Organization Settings</p>
          <h1 className="text-2xl font-semibold">BIA Methodology</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ratings">Rating Methodology</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Configuration</TabsTrigger>
        </TabsList>

        {/* Rating Methodology Tab */}
        <TabsContent value="ratings" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ratings..."
                value={searchRatings}
                onChange={(e) => setSearchRatings(e.target.value)}
                className="pl-10 w-[250px]"
              />
            </div>
            <Button onClick={() => setIsAddRatingOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rating
            </Button>
          </div>

          {loadingRatings ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <DataGrid columns={ratingColumns} data={filteredRatings} searchPlaceholder="Search..." />
          )}
        </TabsContent>

        {/* Scoring Configuration Tab */}
        <TabsContent value="scoring" className="space-y-6">
          {/* Calculation Type Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Calculation Type
              </CardTitle>
              <CardDescription>
                Configure how the BIA impact rating is calculated from individual category scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingConfig ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-4">
                  <Select
                    value={scoringConfig?.calculationType || "High of all"}
                    onValueChange={updateScoringConfig}
                  >
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Select calculation type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High of all">High of all (Maximum)</SelectItem>
                      <SelectItem value="Addition of all">Addition of all (Sum)</SelectItem>
                      <SelectItem value="Product of all">Product of all (Multiply)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {scoringConfig?.calculationType === "High of all" &&
                      "The highest score among all categories will be used as the impact rating."}
                    {scoringConfig?.calculationType === "Addition of all" &&
                      "All category scores will be added together for the impact rating."}
                    {scoringConfig?.calculationType === "Product of all" &&
                      "All category scores will be multiplied together for the impact rating."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scoring Ranges Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Criticality Ranges</CardTitle>
                <CardDescription>
                  Define score ranges to determine process criticality levels
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddRangeOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Range
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRanges ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <DataGrid columns={rangeColumns} data={scoringRanges} searchPlaceholder="Search..." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Rating Dialog */}
      <Dialog open={isAddRatingOpen} onOpenChange={setIsAddRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add BIA Rating</DialogTitle>
            <DialogDescription>Define a new rating level for BIA assessments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ratingLabel">Rating Label *</Label>
              <Input
                id="ratingLabel"
                value={ratingForm.label}
                onChange={(e) => setRatingForm({ ...ratingForm, label: e.target.value })}
                placeholder="e.g., High, Medium, Low"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ratingScore">Score Value *</Label>
                <Input
                  id="ratingScore"
                  type="number"
                  value={ratingForm.score}
                  onChange={(e) => setRatingForm({ ...ratingForm, score: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratingColor">Color</Label>
                <Input
                  id="ratingColor"
                  type="color"
                  value={ratingForm.color}
                  onChange={(e) => setRatingForm({ ...ratingForm, color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratingDescription">Description</Label>
              <Input
                id="ratingDescription"
                value={ratingForm.description}
                onChange={(e) => setRatingForm({ ...ratingForm, description: e.target.value })}
                placeholder="Impact description for this rating"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ratingActive"
                checked={ratingForm.isActive}
                onCheckedChange={(checked) => setRatingForm({ ...ratingForm, isActive: checked })}
              />
              <Label htmlFor="ratingActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddRatingOpen(false); resetRatingForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddRating}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rating Dialog */}
      <Dialog open={isEditRatingOpen} onOpenChange={setIsEditRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit BIA Rating</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rating Label *</Label>
              <Input
                value={ratingForm.label}
                onChange={(e) => setRatingForm({ ...ratingForm, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Score Value *</Label>
                <Input
                  type="number"
                  value={ratingForm.score}
                  onChange={(e) => setRatingForm({ ...ratingForm, score: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={ratingForm.color}
                  onChange={(e) => setRatingForm({ ...ratingForm, color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={ratingForm.description}
                onChange={(e) => setRatingForm({ ...ratingForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={ratingForm.isActive}
                onCheckedChange={(checked) => setRatingForm({ ...ratingForm, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditRatingOpen(false); setEditingRating(null); resetRatingForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditRating}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rating Dialog */}
      <Dialog open={isDeleteRatingOpen} onOpenChange={setIsDeleteRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rating? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteRatingOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRating}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Range Dialog */}
      <Dialog open={isAddRangeOpen} onOpenChange={setIsAddRangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Scoring Range</DialogTitle>
            <DialogDescription>Define a criticality level based on score range</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Criticality Label *</Label>
              <Input
                value={rangeForm.label}
                onChange={(e) => setRangeForm({ ...rangeForm, label: e.target.value })}
                placeholder="e.g., Critical, High, Medium, Low"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Score *</Label>
                <Input
                  type="number"
                  value={rangeForm.lowValue}
                  onChange={(e) => setRangeForm({ ...rangeForm, lowValue: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  value={rangeForm.highValue}
                  onChange={(e) => setRangeForm({ ...rangeForm, highValue: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                type="color"
                value={rangeForm.color}
                onChange={(e) => setRangeForm({ ...rangeForm, color: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddRangeOpen(false); resetRangeForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddRange}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Range Dialog */}
      <Dialog open={isEditRangeOpen} onOpenChange={setIsEditRangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Scoring Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Criticality Label *</Label>
              <Input
                value={rangeForm.label}
                onChange={(e) => setRangeForm({ ...rangeForm, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Score *</Label>
                <Input
                  type="number"
                  value={rangeForm.lowValue}
                  onChange={(e) => setRangeForm({ ...rangeForm, lowValue: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  value={rangeForm.highValue}
                  onChange={(e) => setRangeForm({ ...rangeForm, highValue: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                type="color"
                value={rangeForm.color}
                onChange={(e) => setRangeForm({ ...rangeForm, color: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditRangeOpen(false); setEditingRange(null); resetRangeForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditRange}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Range Dialog */}
      <Dialog open={isDeleteRangeOpen} onOpenChange={setIsDeleteRangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this scoring range? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteRangeOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRange}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
