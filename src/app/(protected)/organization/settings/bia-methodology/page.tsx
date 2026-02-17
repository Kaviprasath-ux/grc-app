"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home, Plus, Pencil, Trash2, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { isValidName, isValidNumber } from "@/lib/validations";

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
  const { t } = useLanguage();
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

  // Validation error states
  const [rangeFormErrors, setRangeFormErrors] = useState<{
    label?: string;
    lowValue?: string;
    highValue?: string;
    overlap?: string;
  }>({});

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
    if (!isValidName(ratingForm.label)) {
      alert(t("Only letters, numbers, spaces, and hyphens are allowed"));
      return;
    }
    if (!isValidNumber(ratingForm.score)) {
      alert(t("Please enter a valid number"));
      return;
    }
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
    if (!isValidName(ratingForm.label)) {
      alert(t("Only letters, numbers, spaces, and hyphens are allowed"));
      return;
    }
    if (!isValidNumber(ratingForm.score)) {
      alert(t("Please enter a valid number"));
      return;
    }
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

  // Validate range form and check for overlaps
  const validateRangeForm = (excludeId?: string): boolean => {
    const errors: typeof rangeFormErrors = {};

    if (!rangeForm.label.trim()) {
      errors.label = t("Criticality Label is required");
    } else if (!isValidName(rangeForm.label)) {
      errors.label = t("Only letters, numbers, spaces, and hyphens are allowed");
    }

    if (!isValidNumber(rangeForm.lowValue)) {
      errors.lowValue = t("Please enter a valid number");
    } else if (rangeForm.lowValue < 0) {
      errors.lowValue = t("Min Score cannot be negative");
    }

    if (!isValidNumber(rangeForm.highValue)) {
      errors.highValue = t("Please enter a valid number");
    } else if (rangeForm.highValue < 0) {
      errors.highValue = t("Max Score cannot be negative");
    }

    if (rangeForm.lowValue > rangeForm.highValue) {
      errors.highValue = t("Max Score must be greater than or equal to Min Score");
    }

    // Check for overlapping ranges (client-side)
    const existingRanges = scoringRanges.filter(r => r.id !== excludeId);
    for (const existing of existingRanges) {
      const existingLow = existing.lowValue;
      const existingHigh = existing.highValue ?? Number.MAX_SAFE_INTEGER;
      const newLow = rangeForm.lowValue;
      const newHigh = rangeForm.highValue;

      // Two ranges overlap if: newLow <= existingHigh AND newHigh >= existingLow
      if (newLow <= existingHigh && newHigh >= existingLow) {
        const existingHighDisplay = existing.highValue !== null ? existing.highValue : "∞";
        errors.overlap = `${t("Range")} ${newLow}-${newHigh} ${t("overlaps with")} "${existing.label}" (${existingLow}-${existingHighDisplay})`;
        break;
      }
    }

    setRangeFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Range CRUD handlers
  const handleAddRange = async () => {
    if (!validateRangeForm()) return;

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
        setRangeFormErrors({ overlap: error.error || "Failed to create range" });
      }
    } catch (error) {
      console.error("Error creating range:", error);
      setRangeFormErrors({ overlap: "Failed to create range. Please try again." });
    }
  };

  const handleEditRange = async () => {
    if (!editingRange) return;
    if (!validateRangeForm(editingRange.id)) return;

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
        setRangeFormErrors({ overlap: error.error || "Failed to update range" });
      }
    } catch (error) {
      console.error("Error updating range:", error);
      setRangeFormErrors({ overlap: "Failed to update range. Please try again." });
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
    setRangeFormErrors({});
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
      header: t("Rating Label"),
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
      header: t("Score Value"),
      cell: ({ row }) => row.getValue("score"),
    },
    {
      accessorKey: "description",
      header: t("Description"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm truncate max-w-[300px] block">
          {row.getValue("description") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
          {row.getValue("isActive") ? t("Active") : t("Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
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
      header: t("Criticality Label"),
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
      header: t("Min Score"),
      cell: ({ row }) => row.getValue("lowValue"),
    },
    {
      accessorKey: "highValue",
      header: t("Max Score"),
      cell: ({ row }) => row.getValue("highValue") ?? t("No limit"),
    },
    {
      id: "actions",
      header: t("Actions"),
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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/organization/settings" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/organization/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("BIA Methodology")}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("Back")}
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">{t("Organization Settings")}</p>
          <h1 className="text-xl sm:text-2xl font-semibold">{t("BIA Methodology")}</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="ratings">{t("Rating Methodology")}</TabsTrigger>
          <TabsTrigger value="scoring">{t("Scoring Configuration")}</TabsTrigger>
        </TabsList>

        {/* Rating Methodology Tab */}
        <TabsContent value="ratings" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search ratings...")}
                value={searchRatings}
                onChange={(e) => setSearchRatings(e.target.value)}
                className="pl-10 w-full sm:w-[250px]"
              />
            </div>
            <Button onClick={() => setIsAddRatingOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("Add Rating")}
            </Button>
          </div>

          {loadingRatings ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">{t("Loading...")}</p>
            </div>
          ) : (
            <DataGrid columns={ratingColumns} data={filteredRatings} searchPlaceholder={t("Search...")} />
          )}
        </TabsContent>

        {/* Scoring Configuration Tab */}
        <TabsContent value="scoring" className="space-y-6">
          {/* Calculation Type Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("Calculation Type")}
              </CardTitle>
              <CardDescription>
                {t("Configure how the BIA impact rating is calculated from individual category scores")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingConfig ? (
                <p className="text-muted-foreground">{t("Loading...")}</p>
              ) : (
                <div className="space-y-4">
                  <Select
                    value={scoringConfig?.calculationType || "High of all"}
                    onValueChange={updateScoringConfig}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder={t("Select calculation type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High of all">{t("High of all (Maximum)")}</SelectItem>
                      <SelectItem value="Addition of all">{t("Addition of all (Sum)")}</SelectItem>
                      <SelectItem value="Product of all">{t("Product of all (Multiply)")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {scoringConfig?.calculationType === "High of all" &&
                      t("The highest score among all categories will be used as the impact rating.")}
                    {scoringConfig?.calculationType === "Addition of all" &&
                      t("All category scores will be added together for the impact rating.")}
                    {scoringConfig?.calculationType === "Product of all" &&
                      t("All category scores will be multiplied together for the impact rating.")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scoring Ranges Card */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>{t("Criticality Ranges")}</CardTitle>
                <CardDescription>
                  {t("Define score ranges to determine process criticality levels")}
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddRangeOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {t("Add Range")}
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRanges ? (
                <p className="text-muted-foreground">{t("Loading...")}</p>
              ) : (
                <DataGrid columns={rangeColumns} data={scoringRanges} searchPlaceholder={t("Search...")} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Rating Dialog */}
      <Dialog open={isAddRatingOpen} onOpenChange={setIsAddRatingOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add BIA Rating")}</DialogTitle>
            <DialogDescription>{t("Define a new rating level for BIA assessments")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ratingLabel">{t("Rating Label")} *</Label>
              <Input
                id="ratingLabel"
                value={ratingForm.label}
                onChange={(e) => setRatingForm({ ...ratingForm, label: e.target.value })}
                placeholder={t("e.g., High, Medium, Low")}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ratingScore">{t("Score Value")} *</Label>
                <Input
                  id="ratingScore"
                  type="number"
                  value={ratingForm.score}
                  onChange={(e) => setRatingForm({ ...ratingForm, score: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratingColor">{t("Color")}</Label>
                <Input
                  id="ratingColor"
                  type="color"
                  value={ratingForm.color}
                  onChange={(e) => setRatingForm({ ...ratingForm, color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratingDescription">{t("Description")}</Label>
              <Input
                id="ratingDescription"
                value={ratingForm.description}
                onChange={(e) => setRatingForm({ ...ratingForm, description: e.target.value })}
                placeholder={t("Impact description for this rating")}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ratingActive"
                checked={ratingForm.isActive}
                onCheckedChange={(checked) => setRatingForm({ ...ratingForm, isActive: checked })}
              />
              <Label htmlFor="ratingActive">{t("Active")}</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsAddRatingOpen(false); resetRatingForm(); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddRating}>{t("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rating Dialog */}
      <Dialog open={isEditRatingOpen} onOpenChange={setIsEditRatingOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Edit BIA Rating")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("Rating Label")} *</Label>
              <Input
                value={ratingForm.label}
                onChange={(e) => setRatingForm({ ...ratingForm, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Score Value")} *</Label>
                <Input
                  type="number"
                  value={ratingForm.score}
                  onChange={(e) => setRatingForm({ ...ratingForm, score: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Color")}</Label>
                <Input
                  type="color"
                  value={ratingForm.color}
                  onChange={(e) => setRatingForm({ ...ratingForm, color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("Description")}</Label>
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
              <Label>{t("Active")}</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsEditRatingOpen(false); setEditingRating(null); resetRatingForm(); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditRating}>{t("Save Changes")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rating Dialog */}
      <Dialog open={isDeleteRatingOpen} onOpenChange={setIsDeleteRatingOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Confirm Delete")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this rating? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeleteRatingOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteRating}>{t("Delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Range Dialog */}
      <Dialog open={isAddRangeOpen} onOpenChange={(open) => { setIsAddRangeOpen(open); if (!open) resetRangeForm(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Scoring Range")}</DialogTitle>
            <DialogDescription>{t("Define a criticality level based on score range")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("Criticality Label")} *</Label>
              <Input
                value={rangeForm.label}
                onChange={(e) => {
                  setRangeForm({ ...rangeForm, label: e.target.value });
                  if (rangeFormErrors.label) setRangeFormErrors({ ...rangeFormErrors, label: undefined });
                }}
                placeholder={t("e.g., Critical, High, Medium, Low")}
                className={rangeFormErrors.label ? "border-red-500" : ""}
              />
              {rangeFormErrors.label && (
                <p className="text-sm text-red-500">{rangeFormErrors.label}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Min Score")} *</Label>
                <Input
                  type="number"
                  min="0"
                  value={rangeForm.lowValue}
                  onChange={(e) => {
                    setRangeForm({ ...rangeForm, lowValue: parseInt(e.target.value) || 0 });
                    if (rangeFormErrors.lowValue || rangeFormErrors.overlap) {
                      setRangeFormErrors({ ...rangeFormErrors, lowValue: undefined, overlap: undefined });
                    }
                  }}
                  className={rangeFormErrors.lowValue ? "border-red-500" : ""}
                />
                {rangeFormErrors.lowValue && (
                  <p className="text-sm text-red-500">{rangeFormErrors.lowValue}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("Max Score")} *</Label>
                <Input
                  type="number"
                  min="0"
                  value={rangeForm.highValue}
                  onChange={(e) => {
                    setRangeForm({ ...rangeForm, highValue: parseInt(e.target.value) || 0 });
                    if (rangeFormErrors.highValue || rangeFormErrors.overlap) {
                      setRangeFormErrors({ ...rangeFormErrors, highValue: undefined, overlap: undefined });
                    }
                  }}
                  className={rangeFormErrors.highValue ? "border-red-500" : ""}
                />
                {rangeFormErrors.highValue && (
                  <p className="text-sm text-red-500">{rangeFormErrors.highValue}</p>
                )}
              </div>
            </div>
            {rangeFormErrors.overlap && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{rangeFormErrors.overlap}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("Color")}</Label>
              <Input
                type="color"
                value={rangeForm.color}
                onChange={(e) => setRangeForm({ ...rangeForm, color: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsAddRangeOpen(false); resetRangeForm(); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddRange}>{t("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Range Dialog */}
      <Dialog open={isEditRangeOpen} onOpenChange={(open) => { setIsEditRangeOpen(open); if (!open) { setEditingRange(null); resetRangeForm(); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Edit Scoring Range")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("Criticality Label")} *</Label>
              <Input
                value={rangeForm.label}
                onChange={(e) => {
                  setRangeForm({ ...rangeForm, label: e.target.value });
                  if (rangeFormErrors.label) setRangeFormErrors({ ...rangeFormErrors, label: undefined });
                }}
                className={rangeFormErrors.label ? "border-red-500" : ""}
              />
              {rangeFormErrors.label && (
                <p className="text-sm text-red-500">{rangeFormErrors.label}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Min Score")} *</Label>
                <Input
                  type="number"
                  min="0"
                  value={rangeForm.lowValue}
                  onChange={(e) => {
                    setRangeForm({ ...rangeForm, lowValue: parseInt(e.target.value) || 0 });
                    if (rangeFormErrors.lowValue || rangeFormErrors.overlap) {
                      setRangeFormErrors({ ...rangeFormErrors, lowValue: undefined, overlap: undefined });
                    }
                  }}
                  className={rangeFormErrors.lowValue ? "border-red-500" : ""}
                />
                {rangeFormErrors.lowValue && (
                  <p className="text-sm text-red-500">{rangeFormErrors.lowValue}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("Max Score")} *</Label>
                <Input
                  type="number"
                  min="0"
                  value={rangeForm.highValue}
                  onChange={(e) => {
                    setRangeForm({ ...rangeForm, highValue: parseInt(e.target.value) || 0 });
                    if (rangeFormErrors.highValue || rangeFormErrors.overlap) {
                      setRangeFormErrors({ ...rangeFormErrors, highValue: undefined, overlap: undefined });
                    }
                  }}
                  className={rangeFormErrors.highValue ? "border-red-500" : ""}
                />
                {rangeFormErrors.highValue && (
                  <p className="text-sm text-red-500">{rangeFormErrors.highValue}</p>
                )}
              </div>
            </div>
            {rangeFormErrors.overlap && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{rangeFormErrors.overlap}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("Color")}</Label>
              <Input
                type="color"
                value={rangeForm.color}
                onChange={(e) => setRangeForm({ ...rangeForm, color: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsEditRangeOpen(false); setEditingRange(null); resetRangeForm(); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditRange}>{t("Save Changes")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Range Dialog */}
      <Dialog open={isDeleteRangeOpen} onOpenChange={setIsDeleteRangeOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Confirm Delete")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this scoring range? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeleteRangeOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteRange}>{t("Delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
