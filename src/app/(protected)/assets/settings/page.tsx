"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, Upload, Download, FolderTree, Clock, Settings2, Lock, CheckCircle, RefreshCw, Layers, FolderOpen, Group, Home, ChevronRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";

interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  status: string;
  _count?: { subCategories: number; assets: number };
}

interface AssetSubCategory {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  category: AssetCategory;
  status: string;
  _count?: { assets: number };
}

interface AssetGroup {
  id: string;
  name: string;
  description: string | null;
  _count?: { assets: number };
}

interface AssetLifecycleStatus {
  id: string;
  name: string;
  description: string | null;
  order: number;
  _count?: { assets: number };
}

interface AssetSensitivity {
  id: string;
  name: string;
  description: string | null;
  _count?: { assets: number };
}

interface Asset {
  id: string;
  assetId: string;
  name: string;
  location: string | null;
  value: number | null;
  acquisitionDate: string | null;
  nextReviewDate: string | null;
  lifecycleStatus: AssetLifecycleStatus | null;
  sensitivity: AssetSensitivity | null;
}

interface CIARating {
  id: string;
  type: string; // Confidentiality, Integrity, Availability
  label: string; // high, medium, low
  value: number;
}

interface ScoringConfig {
  id: string;
  level: string;
  minScore: number;
  maxScore: number;
  color: string;
}

// Setting categories for block navigation (matching UAT: CIA, Asset, Lifecycle Status)
const settingCategoriesConfig = [
  {
    id: "cia",
    titleKey: "CIA",
    descriptionKey: "Configure CIA ratings and scoring",
    icon: Settings2,
  },
  {
    id: "asset",
    titleKey: "Asset",
    descriptionKey: "Manage asset entities and configurations",
    icon: FolderTree,
  },
  {
    id: "lifecycle",
    titleKey: "Lifecycle Status",
    descriptionKey: "Define asset lifecycle stages",
    icon: Clock,
  },
];

// Entity sub-categories for navigation (under Asset section - matching UAT)
const entitySubCategoriesConfig = [
  {
    id: "asset-list",
    titleKey: "Asset",
    descriptionKey: "View and manage all assets",
    icon: FolderOpen,
  },
  {
    id: "subcategories",
    titleKey: "Asset Sub Category",
    descriptionKey: "Sub-categories under main categories",
    icon: Layers,
  },
  {
    id: "groups",
    titleKey: "Asset Group",
    descriptionKey: "Logical groupings for assets",
    icon: Group,
  },
  {
    id: "categories",
    titleKey: "Asset Category",
    descriptionKey: "Top-level asset categories (e.g., Hardware, Software)",
    icon: FolderOpen,
  },
  {
    id: "sensitivity",
    titleKey: "Asset Sensitivity",
    descriptionKey: "Asset sensitivity levels",
    icon: Lock,
  },
];

const SCORING_CALCULATION_TYPES_CONFIG = [
  { value: "high_of_all", labelKey: "High of all" },
  { value: "addition_of_all", labelKey: "Addition of all" },
  { value: "product_of_all", labelKey: "Product of all" },
];

export default function AssetSettingsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [entitySubTab, setEntitySubTab] = useState<string | null>(null);

  // Translated arrays
  const settingCategories = settingCategoriesConfig.map(cat => ({
    ...cat,
    title: t(cat.titleKey),
    description: t(cat.descriptionKey),
  }));

  const entitySubCategories = entitySubCategoriesConfig.map(cat => ({
    ...cat,
    title: t(cat.titleKey),
    description: t(cat.descriptionKey),
  }));

  const SCORING_CALCULATION_TYPES = SCORING_CALCULATION_TYPES_CONFIG.map(type => ({
    ...type,
    label: t(type.labelKey),
  }));

  // Data states
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [subCategories, setSubCategories] = useState<AssetSubCategory[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [lifecycleStatuses, setLifecycleStatuses] = useState<AssetLifecycleStatus[]>([]);
  const [sensitivities, setSensitivities] = useState<AssetSensitivity[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ciaRatings, setCiaRatings] = useState<CIARating[]>([]);
  const [scoringCalculationType, setScoringCalculationType] = useState("high_of_all");
  const [highOfAllConfigs, setHighOfAllConfigs] = useState<ScoringConfig[]>([]);
  const [additionOfAllConfigs, setAdditionOfAllConfigs] = useState<ScoringConfig[]>([]);
  const [productOfAllConfigs, setProductOfAllConfigs] = useState<ScoringConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AssetCategory | AssetSubCategory | AssetGroup | AssetLifecycleStatus | null>(null);

  // CIA Rating dialog states
  const [isCiaAddOpen, setIsCiaAddOpen] = useState(false);
  const [isCiaEditOpen, setIsCiaEditOpen] = useState(false);
  const [isCiaDeleteOpen, setIsCiaDeleteOpen] = useState(false);
  const [selectedCiaRating, setSelectedCiaRating] = useState<CIARating | null>(null);
  const [ciaRatingType, setCiaRatingType] = useState<string>("Confidentiality");

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", status: "Active" });
  const [subCategoryForm, setSubCategoryForm] = useState({ name: "", description: "", categoryId: "", status: "Active" });
  const [groupForm, setGroupForm] = useState({ name: "", description: "", status: "Active", subCategoryId: "" });
  const [lifecycleForm, setLifecycleForm] = useState({ name: "", description: "", order: 0 });
  const [sensitivityForm, setSensitivityForm] = useState({ name: "", description: "" });
  const [assetForm, setAssetForm] = useState({
    name: "",
    assetId: "",
    location: "",
    value: 0,
    acquisitionDate: "",
    lifecycleStatusId: "",
    riskRating: "",
    lastRiskAssessment: "",
    auditTrail: "",
    nextReviewDate: "",
    sensitivityId: "",
    categoryId: "",
    subCategoryId: "",
    policies: "",
  });
  const [ciaRatingForm, setCiaRatingForm] = useState({ label: "", value: 0 });
  const [scoringConfigForm, setScoringConfigForm] = useState({ level: "", minScore: 0, maxScore: 0, color: "#000000" });
  const [isScoringAddOpen, setIsScoringAddOpen] = useState(false);
  const [isScoringEditOpen, setIsScoringEditOpen] = useState(false);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [isScoringDeleteOpen, setIsScoringDeleteOpen] = useState(false);
  const [selectedScoringConfig, setSelectedScoringConfig] = useState<ScoringConfig | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, subCatRes, groupRes, lifecycleRes, sensRes, assetRes, ciaRes, scoringConfigRes, scoringRangesRes] = await Promise.all([
        fetch("/api/asset-categories"),
        fetch("/api/asset-sub-categories"),
        fetch("/api/asset-groups"),
        fetch("/api/asset-lifecycle-statuses"),
        fetch("/api/asset-sensitivities"),
        fetch("/api/assets"),
        fetch("/api/cia-ratings"),
        fetch("/api/asset-scoring-config"),
        fetch("/api/asset-scoring-ranges"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (subCatRes.ok) setSubCategories(await subCatRes.json());
      if (groupRes.ok) setGroups(await groupRes.json());
      if (lifecycleRes.ok) setLifecycleStatuses(await lifecycleRes.json());
      if (sensRes.ok) setSensitivities(await sensRes.json());
      if (assetRes.ok) setAssets(await assetRes.json());
      if (ciaRes.ok) setCiaRatings(await ciaRes.json());

      // Load scoring configuration
      if (scoringConfigRes.ok) {
        const config = await scoringConfigRes.json();
        setScoringCalculationType(config.calculationType || "high_of_all");
      }

      // Load scoring ranges
      if (scoringRangesRes.ok) {
        const ranges = await scoringRangesRes.json();
        // Separate ranges by calculation type
        const highOfAll = ranges.filter((r: ScoringConfig & { calculationType: string }) => r.calculationType === "high_of_all")
          .map((r: ScoringConfig) => ({ id: r.id, level: r.level, minScore: r.minScore, maxScore: r.maxScore, color: r.color || "#000000" }));
        const additionOfAll = ranges.filter((r: ScoringConfig & { calculationType: string }) => r.calculationType === "addition_of_all")
          .map((r: ScoringConfig) => ({ id: r.id, level: r.level, minScore: r.minScore, maxScore: r.maxScore, color: r.color || "#000000" }));
        const productOfAll = ranges.filter((r: ScoringConfig & { calculationType: string }) => r.calculationType === "product_of_all")
          .map((r: ScoringConfig) => ({ id: r.id, level: r.level, minScore: r.minScore, maxScore: r.maxScore, color: r.color || "#000000" }));

        setHighOfAllConfigs(highOfAll);
        setAdditionOfAllConfigs(additionOfAll);
        setProductOfAllConfigs(productOfAll);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter CIA ratings by type
  const confidentialityRatings = ciaRatings.filter(r => r.type === "Confidentiality");
  const integrityRatings = ciaRatings.filter(r => r.type === "Integrity");
  const availabilityRatings = ciaRatings.filter(r => r.type === "Availability");

  // Category CRUD
  const handleAddCategory = async () => {
    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation
    if (!categoryForm.name.trim()) {
      errors.categoryName = t("Please enter category name");
    }
    if (!categoryForm.status) {
      errors.categoryStatus = t("Please select status");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

    try {
      const res = await fetch("/api/asset-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      if (res.ok) {
        const created = await res.json();
        setCategories([...categories, created]);
        setCategoryForm({ name: "", description: "", status: "Active" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleEditCategory = async () => {
    if (!selectedItem) return;

    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation
    if (!categoryForm.name.trim()) {
      errors.categoryName = t("Please enter category name");
    }
    if (!categoryForm.status) {
      errors.categoryStatus = t("Please select status");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

    try {
      const res = await fetch(`/api/asset-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setCategories(categories.map((c) => (c.id === updated.id ? updated : c)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories(categories.filter((c) => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  // SubCategory CRUD
  const handleAddSubCategory = async () => {
    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation
    if (!subCategoryForm.name.trim()) {
      errors.subCategoryName = t("Please enter sub category name");
    }
    if (!subCategoryForm.categoryId) {
      errors.subCategoryCategoryId = t("Please select category");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

    try {
      const res = await fetch("/api/asset-sub-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subCategoryForm),
      });
      if (res.ok) {
        const created = await res.json();
        setSubCategories([...subCategories, created]);
        setSubCategoryForm({ name: "", description: "", categoryId: "", status: "Active" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create sub-category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding sub-category:", error);
    }
  };

  const handleEditSubCategory = async () => {
    if (!selectedItem) return;

    const errors: { [key: string]: string } = {};

    if (!subCategoryForm.name.trim()) {
      errors.subCategoryName = t("Please enter sub category name");
    }
    if (!subCategoryForm.categoryId) {
      errors.subCategoryCategoryId = t("Please select category");
    }
    if (!subCategoryForm.status) {
      errors.subCategoryStatus = t("Please select status");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch(`/api/asset-sub-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subCategoryForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setSubCategories(subCategories.map((c) => (c.id === updated.id ? updated : c)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update sub-category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating sub-category:", error);
    }
  };

  const handleDeleteSubCategory = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-sub-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setSubCategories(subCategories.filter((c) => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete sub-category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting sub-category:", error);
    }
  };

  // Group CRUD
  const handleAddGroup = async () => {
    const errors: { [key: string]: string } = {};

    if (!groupForm.name.trim()) {
      errors.groupName = t("Please enter group name");
    }
    if (!groupForm.status) {
      errors.groupStatus = t("Please select status");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch("/api/asset-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      if (res.ok) {
        const created = await res.json();
        setGroups([...groups, created]);
        setGroupForm({ name: "", description: "", status: "Active", subCategoryId: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create group"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding group:", error);
    }
  };

  const handleEditGroup = async () => {
    if (!selectedItem) return;

    const errors: { [key: string]: string } = {};

    if (!groupForm.name.trim()) {
      errors.groupName = t("Please enter group name");
    }
    if (!groupForm.status) {
      errors.groupStatus = t("Please select status");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch(`/api/asset-groups/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setGroups(groups.map((g) => (g.id === updated.id ? updated : g)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update group"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating group:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-groups/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setGroups(groups.filter((g) => g.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete group"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  // Lifecycle Status CRUD
  const handleAddLifecycle = async () => {
    const errors: { [key: string]: string } = {};

    if (!lifecycleForm.name.trim()) {
      errors.lifecycleName = t("Please enter lifecycle name");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch("/api/asset-lifecycle-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lifecycleForm),
      });
      if (res.ok) {
        const created = await res.json();
        setLifecycleStatuses([...lifecycleStatuses, created]);
        setLifecycleForm({ name: "", description: "", order: 0 });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create lifecycle status"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding lifecycle status:", error);
    }
  };

  const handleEditLifecycle = async () => {
    if (!selectedItem) return;

    const errors: { [key: string]: string } = {};

    if (!lifecycleForm.name.trim()) {
      errors.lifecycleName = t("Please enter lifecycle name");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch(`/api/asset-lifecycle-statuses/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lifecycleForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setLifecycleStatuses(lifecycleStatuses.map((l) => (l.id === updated.id ? updated : l)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update lifecycle status"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating lifecycle status:", error);
    }
  };

  const handleDeleteLifecycle = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-lifecycle-statuses/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setLifecycleStatuses(lifecycleStatuses.filter((l) => l.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete lifecycle status"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting lifecycle status:", error);
    }
  };

  // Asset CRUD
  const handleAddAsset = async () => {
    const errors: { [key: string]: string } = {};

    if (!assetForm.name.trim()) {
      errors.assetName = t("Please enter asset name");
    }
    if (!assetForm.sensitivityId) {
      errors.assetSensitivityId = t("Please select asset sensitivity");
    }
    if (!assetForm.categoryId) {
      errors.assetCategoryId = t("Please select asset category");
    }
    if (!assetForm.subCategoryId) {
      errors.assetSubCategoryId = t("Please select asset sub category");
    }
    if (!assetForm.policies) {
      errors.assetPolicies = t("Please select policies");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetForm.name,
          assetId: assetForm.assetId,
          location: assetForm.location || null,
          value: assetForm.value || null,
          acquisitionDate: assetForm.acquisitionDate || null,
          lifecycleStatusId: assetForm.lifecycleStatusId || null,
          riskRating: assetForm.riskRating || null,
          lastRiskAssessment: assetForm.lastRiskAssessment || null,
          auditTrail: assetForm.auditTrail || null,
          nextReviewDate: assetForm.nextReviewDate || null,
          sensitivityId: assetForm.sensitivityId || null,
          categoryId: assetForm.categoryId || null,
          subCategoryId: assetForm.subCategoryId || null,
          policies: assetForm.policies || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAssets([...assets, created]);
        setAssetForm({
          name: "",
          assetId: "",
          location: "",
          value: 0,
          acquisitionDate: "",
          lifecycleStatusId: "",
          riskRating: "",
          lastRiskAssessment: "",
          auditTrail: "",
          nextReviewDate: "",
          sensitivityId: "",
          categoryId: "",
          subCategoryId: "",
          policies: "",
        });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create asset"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding asset:", error);
    }
  };

  // Sensitivity CRUD
  const handleAddSensitivity = async () => {
    const errors: { [key: string]: string } = {};

    if (!sensitivityForm.name.trim()) {
      errors.sensitivityName = t("Please enter sensitivity name");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch("/api/asset-sensitivities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sensitivityForm),
      });
      if (res.ok) {
        const created = await res.json();
        setSensitivities([...sensitivities, created]);
        setSensitivityForm({ name: "", description: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create sensitivity"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding sensitivity:", error);
    }
  };

  const handleEditSensitivity = async () => {
    if (!selectedItem) return;

    const errors: { [key: string]: string } = {};

    if (!sensitivityForm.name.trim()) {
      errors.sensitivityName = t("Please enter sensitivity name");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch(`/api/asset-sensitivities/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sensitivityForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setSensitivities(sensitivities.map((s) => (s.id === updated.id ? updated : s)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update sensitivity"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating sensitivity:", error);
    }
  };

  const handleDeleteSensitivity = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-sensitivities/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setSensitivities(sensitivities.filter((s) => s.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete sensitivity"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting sensitivity:", error);
    }
  };

  // CIA Rating CRUD
  const handleAddCiaRating = async () => {
    const errors: { [key: string]: string } = {};

    if (!ciaRatingForm.label.trim()) {
      errors.ciaRatingLabel = t("Please enter label");
    }
    if (ciaRatingForm.value === null || ciaRatingForm.value === undefined) {
      errors.ciaRatingValue = t("Please enter value");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch("/api/cia-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: ciaRatingType,
          label: ciaRatingForm.label,
          value: ciaRatingForm.value,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCiaRatings([...ciaRatings, created]);
        setCiaRatingForm({ label: "", value: 0 });
        setIsCiaAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create CIA rating"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding CIA rating:", error);
    }
  };

  const handleEditCiaRating = async () => {
    if (!selectedCiaRating) return;

    const errors: { [key: string]: string } = {};

    if (!ciaRatingForm.label.trim()) {
      errors.ciaRatingLabel = t("Please enter label");
    }
    if (ciaRatingForm.value === null || ciaRatingForm.value === undefined) {
      errors.ciaRatingValue = t("Please enter value");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const res = await fetch(`/api/cia-ratings/${selectedCiaRating.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedCiaRating.type,
          label: ciaRatingForm.label,
          value: ciaRatingForm.value,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCiaRatings(ciaRatings.map((r) => (r.id === updated.id ? updated : r)));
        setIsCiaEditOpen(false);
        setSelectedCiaRating(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update CIA rating"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating CIA rating:", error);
    }
  };

  const handleDeleteCiaRating = async () => {
    if (!selectedCiaRating) return;
    try {
      const res = await fetch(`/api/cia-ratings/${selectedCiaRating.id}`, { method: "DELETE" });
      if (res.ok) {
        setCiaRatings(ciaRatings.filter((r) => r.id !== selectedCiaRating.id));
        setIsCiaDeleteOpen(false);
        setSelectedCiaRating(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete CIA rating"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting CIA rating:", error);
    }
  };

  // Scoring Configuration handlers
  // Get current configs based on calculation type
  const getCurrentConfigs = () => {
    switch (scoringCalculationType) {
      case "high_of_all": return highOfAllConfigs;
      case "addition_of_all": return additionOfAllConfigs;
      case "product_of_all": return productOfAllConfigs;
      default: return highOfAllConfigs;
    }
  };

  const setCurrentConfigs = (configs: ScoringConfig[]) => {
    switch (scoringCalculationType) {
      case "high_of_all": setHighOfAllConfigs(configs); break;
      case "addition_of_all": setAdditionOfAllConfigs(configs); break;
      case "product_of_all": setProductOfAllConfigs(configs); break;
    }
  };

  const handleAddScoringConfig = async () => {
    const errors: { [key: string]: string } = {};

    if (!scoringConfigForm.level.trim()) {
      errors.scoringConfigLevel = t("Please enter level");
    }
    if (scoringConfigForm.minScore === null || scoringConfigForm.minScore === undefined) {
      errors.scoringConfigMinScore = t("Please enter minimum score");
    }
    if (scoringConfigForm.maxScore === null || scoringConfigForm.maxScore === undefined) {
      errors.scoringConfigMaxScore = t("Please enter maximum score");
    }
    if (!scoringConfigForm.color) {
      errors.scoringConfigColor = t("Please select color");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    const currentConfigs = getCurrentConfigs();

    // Check for duplicate rating name
    const duplicateLevel = currentConfigs.find(
      c => c.level.toLowerCase() === scoringConfigForm.level.trim().toLowerCase()
    );
    if (duplicateLevel) {
      toast({ title: t("Error"), description: t("Rating already exists"), variant: "destructive" });
      return;
    }

    // Check that low range and high range are not the same (for addition/product types)
    if (scoringCalculationType !== "high_of_all" && scoringConfigForm.minScore === scoringConfigForm.maxScore) {
      toast({ title: t("Error"), description: t("Low range and High range cannot be the same"), variant: "destructive" });
      return;
    }

    // Check for overlapping ranges (for addition/product types)
    if (scoringCalculationType !== "high_of_all") {
      const newMin = scoringConfigForm.minScore;
      const newMax = scoringConfigForm.maxScore;

      const overlappingRange = currentConfigs.find(c => {
        // Check if new range overlaps with existing range
        // Overlap exists if: newMin <= existingMax AND newMax >= existingMin
        return newMin <= c.maxScore && newMax >= c.minScore;
      });

      if (overlappingRange) {
        toast({ title: t("Error"), description: t("Range overlaps with existing range"), variant: "destructive" });
        return;
      }
    } else {
      // For high_of_all, just check duplicate high value
      const duplicateRange = currentConfigs.find(c => c.maxScore === scoringConfigForm.maxScore);
      if (duplicateRange) {
        toast({ title: t("Error"), description: t("Range value already exists"), variant: "destructive" });
        return;
      }
    }

    try {
      const res = await fetch("/api/asset-scoring-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calculationType: scoringCalculationType,
          level: scoringConfigForm.level,
          minScore: scoringConfigForm.minScore,
          maxScore: scoringConfigForm.maxScore,
          color: scoringConfigForm.color,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        const newConfig: ScoringConfig = {
          id: created.id,
          level: created.level,
          minScore: created.minScore,
          maxScore: created.maxScore,
          color: created.color || "#000000",
        };
        setCurrentConfigs([...currentConfigs, newConfig]);
        setScoringConfigForm({ level: "", minScore: 0, maxScore: 0, color: "#000000" });
        setIsScoringAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create scoring configuration"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding scoring config:", error);
      toast({ title: t("Error"), description: t("Failed to create scoring configuration"), variant: "destructive" });
    }
  };

  const handleUpdateScoringConfig = async () => {
    if (!selectedScoringConfig) return;

    const errors: { [key: string]: string } = {};

    if (!scoringConfigForm.level.trim()) {
      errors.scoringConfigLevel = t("Please enter level");
    }
    if (scoringConfigForm.minScore === null || scoringConfigForm.minScore === undefined) {
      errors.scoringConfigMinScore = t("Please enter minimum score");
    }
    if (scoringConfigForm.maxScore === null || scoringConfigForm.maxScore === undefined) {
      errors.scoringConfigMaxScore = t("Please enter maximum score");
    }
    if (!scoringConfigForm.color) {
      errors.scoringConfigColor = t("Please select color");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    // Check that low range and high range are not the same (for addition/product types)
    if (scoringCalculationType !== "high_of_all" && scoringConfigForm.minScore === scoringConfigForm.maxScore) {
      toast({ title: t("Error"), description: t("Low range and High range cannot be the same"), variant: "destructive" });
      return;
    }

    const currentConfigs = getCurrentConfigs();

    // Check for overlapping ranges (exclude the current item being edited)
    if (scoringCalculationType !== "high_of_all") {
      const newMin = scoringConfigForm.minScore;
      const newMax = scoringConfigForm.maxScore;

      const overlappingRange = currentConfigs.find(c => {
        if (c.id === selectedScoringConfig.id) return false; // Skip current item
        return newMin <= c.maxScore && newMax >= c.minScore;
      });

      if (overlappingRange) {
        toast({ title: t("Error"), description: t("Range overlaps with existing range"), variant: "destructive" });
        return;
      }
    } else {
      const duplicateRange = currentConfigs.find(c =>
        c.id !== selectedScoringConfig.id && c.maxScore === scoringConfigForm.maxScore
      );
      if (duplicateRange) {
        toast({ title: t("Error"), description: t("Range value already exists"), variant: "destructive" });
        return;
      }
    }

    try {
      const res = await fetch(`/api/asset-scoring-ranges/${selectedScoringConfig.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: scoringConfigForm.level,
          minScore: scoringConfigForm.minScore,
          maxScore: scoringConfigForm.maxScore,
          color: scoringConfigForm.color,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCurrentConfigs(currentConfigs.map(c =>
          c.id === selectedScoringConfig.id
            ? { ...c, level: updated.level, minScore: updated.minScore, maxScore: updated.maxScore, color: updated.color }
            : c
        ));
        setIsScoringEditOpen(false);
        setSelectedScoringConfig(null);
      } else {
        const data = await res.json();
        toast({ title: t("Error"), description: data.error || t("Failed to update scoring configuration"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating scoring config:", error);
      toast({ title: t("Error"), description: t("Failed to update scoring configuration"), variant: "destructive" });
    }
  };

  const handleDeleteScoringConfig = async () => {
    if (!selectedScoringConfig) return;

    try {
      const res = await fetch(`/api/asset-scoring-ranges/${selectedScoringConfig.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const currentConfigs = getCurrentConfigs();
        setCurrentConfigs(currentConfigs.filter(c => c.id !== selectedScoringConfig.id));
        setIsScoringDeleteOpen(false);
        setSelectedScoringConfig(null);
      } else {
        const data = await res.json();
        toast({ title: t("Error"), description: data.error || t("Failed to delete scoring configuration"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting scoring config:", error);
      toast({ title: t("Error"), description: t("Failed to delete scoring configuration"), variant: "destructive" });
    }
  };

  const handleCalculationTypeChange = async (newType: string) => {
    setScoringCalculationType(newType);

    try {
      const res = await fetch("/api/asset-scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calculationType: newType }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: t("Error"), description: data.error || t("Failed to update calculation type"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating calculation type:", error);
      toast({ title: t("Error"), description: t("Failed to update calculation type"), variant: "destructive" });
    }
  };

  // Export handlers for each entity type
  const handleExportCategories = () => {
    const headers = ["Name", "Description", "Status"];
    const rows = categories.map(c => [c.name, c.description || "", c.status]);
    exportToCSV(headers, rows, "asset_categories");
  };

  const handleExportSubCategories = () => {
    const headers = ["Name", "Description", "Category", "Status"];
    const rows = subCategories.map(c => [c.name, c.description || "", c.category?.name || "", c.status]);
    exportToCSV(headers, rows, "asset_sub_categories");
  };

  const handleExportGroups = () => {
    const headers = ["Name", "Description"];
    const rows = groups.map(g => [g.name, g.description || ""]);
    exportToCSV(headers, rows, "asset_groups");
  };

  const handleExportSensitivities = () => {
    const headers = ["Name", "Description"];
    const rows = sensitivities.map(s => [s.name, s.description || ""]);
    exportToCSV(headers, rows, "asset_sensitivities");
  };

  const handleExportLifecycleStatuses = () => {
    const headers = ["Name", "Description", "Order"];
    const rows = lifecycleStatuses.map(l => [l.name, l.description || "", l.order.toString()]);
    exportToCSV(headers, rows, "lifecycle_statuses");
  };

  const handleExportAssets = () => {
    const headers = ["Asset ID", "Name", "Location", "Lifecycle Status", "Sensitivity"];
    const rows = assets.map(a => [
      a.assetId,
      a.name,
      a.location || "",
      a.lifecycleStatus?.name || "",
      a.sensitivity?.name || "",
    ]);
    exportToCSV(headers, rows, "assets");
  };

  const exportToCSV = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import handler for categories
  const handleImportCategories = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [name, description, status] = cells;
        if (!name) continue;

        try {
          const res = await fetch("/api/asset-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: description || "", status: status || "Active" }),
          });
          if (res.ok) imported++;
        } catch { /* skip errors */ }
      }

      fetchData();
      toast({ title: t("Success"), description: `${t("Imported")} ${imported} ${t("categories")}` });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Import handler for sub-categories
  const handleImportSubCategories = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;
      let failed = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [name, description, categoryName, status] = cells;
        if (!name) continue;

        // Find matching category by name
        const category = categories.find(c => c.name.toLowerCase() === (categoryName || "").toLowerCase());
        if (!category) {
          failed++;
          continue;
        }

        try {
          const res = await fetch("/api/asset-sub-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: description || "", categoryId: category.id, status: status || "Active" }),
          });
          if (res.ok) imported++;
          else failed++;
        } catch { failed++; }
      }

      fetchData();
      toast({
        title: t("Success"),
        description: failed > 0
          ? `${t("Imported")} ${imported} ${t("sub-categories")}. ${failed} ${t("failed")} (${t("category not found")})`
          : `${t("Imported")} ${imported} ${t("sub-categories")}`
      });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Import handler for groups
  const handleImportGroups = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [name, description] = cells;
        if (!name) continue;

        try {
          const res = await fetch("/api/asset-groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: description || "" }),
          });
          if (res.ok) imported++;
        } catch { /* skip errors */ }
      }

      fetchData();
      toast({ title: t("Success"), description: `${t("Imported")} ${imported} ${t("groups")}` });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Import handler for sensitivities
  const handleImportSensitivities = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [name, description] = cells;
        if (!name) continue;

        try {
          const res = await fetch("/api/asset-sensitivities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: description || "" }),
          });
          if (res.ok) imported++;
        } catch { /* skip errors */ }
      }

      fetchData();
      toast({ title: t("Success"), description: `${t("Imported")} ${imported} ${t("sensitivities")}` });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Import handler for assets
  const handleImportAssets = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;
      let failed = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [assetId, name, location, lifecycleStatusName, sensitivityName] = cells;
        if (!name || !assetId) continue;

        // Resolve lifecycle status by name
        const lifecycleStatus = lifecycleStatuses.find(l => l.name.toLowerCase() === (lifecycleStatusName || "").toLowerCase());
        // Resolve sensitivity by name
        const sensitivity = sensitivities.find(s => s.name.toLowerCase() === (sensitivityName || "").toLowerCase());

        try {
          const res = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId,
              name,
              location: location || null,
              lifecycleStatusId: lifecycleStatus?.id || null,
              sensitivityId: sensitivity?.id || null,
            }),
          });
          if (res.ok) imported++;
          else failed++;
        } catch { failed++; }
      }

      fetchData();
      toast({
        title: t("Success"),
        description: failed > 0
          ? `${t("Imported")} ${imported} ${t("assets")}. ${failed} ${t("failed")}.`
          : `${t("Imported")} ${imported} ${t("assets")}`
      });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Import handler for lifecycle statuses
  const handleImportLifecycleStatuses = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [name, description, order] = cells;
        if (!name) continue;

        try {
          const res = await fetch("/api/asset-lifecycle-statuses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: description || "", order: parseInt(order) || 0 }),
          });
          if (res.ok) imported++;
        } catch { /* skip errors */ }
      }

      fetchData();
      toast({ title: t("Success"), description: `${t("Imported")} ${imported} ${t("lifecycle statuses")}` });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Helper function to parse CSV line
  const parseCSVLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  // Get export handler based on entity type
  const getExportHandler = () => {
    switch (entitySubTab) {
      case "categories": return handleExportCategories;
      case "subcategories": return handleExportSubCategories;
      case "groups": return handleExportGroups;
      case "sensitivity": return handleExportSensitivities;
      case "asset-list": return handleExportAssets;
      default: return () => {};
    }
  };

  // Get import handler based on entity type
  const getImportHandler = () => {
    switch (entitySubTab) {
      case "categories": return handleImportCategories;
      case "subcategories": return handleImportSubCategories;
      case "groups": return handleImportGroups;
      case "sensitivity": return handleImportSensitivities;
      case "asset-list": return handleImportAssets;
      default: return undefined;
    }
  };

  // Column definitions removed - rendering tables directly in JSX

  // Get current category info
  const currentCategory = settingCategories.find((c) => c.id === activeCategory);
  const currentEntitySub = entitySubCategories.find((e) => e.id === entitySubTab);

  // Get item counts for cards
  const getItemCount = (categoryId: string) => {
    switch (categoryId) {
      case "asset":
        return assets.length + subCategories.length + groups.length + categories.length + sensitivities.length;
      case "lifecycle":
        return lifecycleStatuses.length;
      case "cia":
        return ciaRatings.length;
      default:
        return 0;
    }
  };

  const getEntitySubCount = (subId: string) => {
    switch (subId) {
      case "asset-list":
        return assets.length;
      case "categories":
        return categories.length;
      case "subcategories":
        return subCategories.length;
      case "groups":
        return groups.length;
      case "sensitivity":
        return sensitivities.length;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading settings...")}</p>
        </div>
      </div>
    );
  }

  // Show entity sub-category list (Asset, Asset Sub Category, Asset Group, Asset Category, Asset Sensitivity)
  if (activeCategory === "asset" && entitySubTab) {
    const getData = () => {
      switch (entitySubTab) {
        case "asset-list":
          return assets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.assetId.toLowerCase().includes(searchTerm.toLowerCase()));
        case "categories":
          return categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        case "subcategories":
          return subCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        case "groups":
          return groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
        case "sensitivity":
          return sensitivities.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        default:
          return [];
      }
    };

    const getAddButtonLabel = () => {
      switch (entitySubTab) {
        case "asset-list": return t("New Asset");
        case "subcategories": return t("New Asset Sub Category");
        case "groups": return t("New Asset Group");
        case "categories": return t("New Asset Category");
        case "sensitivity": return t("New Asset Sensitivity");
        default: return t("Add New");
      }
    };

    const allData = getData();
    const totalPages = Math.ceil(allData.length / itemsPerPage);
    const paginatedData = allData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <button onClick={() => { setActiveCategory(null); setEntitySubTab(null); setCurrentPage(1); }} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <button onClick={() => { setEntitySubTab(null); setCurrentPage(1); }} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Asset")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{currentEntitySub?.title || t("Settings")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{currentEntitySub?.title || t("Settings")}</h1>
        </div>

        {/* Action Buttons - ABOVE the card */}
        <div className="flex items-center justify-end gap-2">
          <label>
            <input
              type="file"
              accept=".csv"
              onChange={getImportHandler()}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </span>
            </Button>
          </label>
          <Button variant="outline" size="sm" onClick={getExportHandler()}>
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export")}
          </Button>
          <Button size="sm" onClick={() => {
            if (entitySubTab === "categories") {
              setCategoryForm({ name: "", description: "", status: "Active" });
            } else if (entitySubTab === "subcategories") {
              setSubCategoryForm({ name: "", description: "", categoryId: "", status: "Active" });
            } else if (entitySubTab === "groups") {
              setGroupForm({ name: "", description: "", status: "Active", subCategoryId: "" });
            } else if (entitySubTab === "sensitivity") {
              setSensitivityForm({ name: "", description: "" });
            } else if (entitySubTab === "asset-list") {
              setAssetForm({
                name: "",
                assetId: "",
                location: "",
                value: 0,
                acquisitionDate: "",
                lifecycleStatusId: "",
                riskRating: "",
                lastRiskAssessment: "",
                auditTrail: "",
                nextReviewDate: "",
                sensitivityId: "",
                categoryId: "",
                subCategoryId: "",
                policies: "",
              });
            }
            setFieldErrors({});
            setIsAddOpen(true);
          }}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {getAddButtonLabel()}
          </Button>
        </div>

        {/* Card with search toolbar + table + pagination */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Search Toolbar */}
          <div className="flex items-center px-5 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                {entitySubTab === "asset-list" && (
                  <>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("ID")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Location")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Value")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Sensitivity")}</TableHead>
                  </>
                )}
                {entitySubTab === "categories" && (
                  <>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Title")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Actions")}</TableHead>
                  </>
                )}
                {entitySubTab === "subcategories" && (
                  <>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Asset Category")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Asset Sub-Category")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Actions")}</TableHead>
                  </>
                )}
                {entitySubTab === "groups" && (
                  <>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Actions")}</TableHead>
                  </>
                )}
                {entitySubTab === "sensitivity" && (
                  <>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Actions")}</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                        <FolderOpen className="h-6 w-6 text-primary-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-800">{t("No items found")}</p>
                      <p className="text-xs text-slate-500">{t("Try adjusting your search or add a new item")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : entitySubTab === "asset-list" ? (
                (paginatedData as Asset[]).map((item) => (
                  <TableRow key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.name}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{item.assetId}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{item.location || "-"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{item.value || "-"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{item.lifecycleStatus?.name || "-"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700 pr-5">{item.sensitivity?.name || "-"}</TableCell>
                  </TableRow>
                ))
              ) : entitySubTab === "categories" ? (
                (paginatedData as AssetCategory[]).map((item) => (
                  <TableRow key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.name}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      <Badge variant={item.status === "Active" ? "default" : "secondary"}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3 pr-5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => {
                          setSelectedItem(item);
                          setCategoryForm({ name: item.name, description: item.description || "", status: item.status });
                          setFieldErrors({});
                          setIsEditOpen(true);
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => {
                          setSelectedItem(item);
                          setIsDeleteOpen(true);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : entitySubTab === "subcategories" ? (
                (paginatedData as AssetSubCategory[]).map((item) => (
                  <TableRow key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.category?.name || "-"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{item.name}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{item.description || "-"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      <Badge variant={item.status === "Active" ? "default" : "secondary"}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3 pr-5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => {
                          setSelectedItem(item);
                          setSubCategoryForm({ name: item.name, description: item.description || "", categoryId: item.categoryId, status: item.status });
                          setFieldErrors({});
                          setIsEditOpen(true);
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => {
                          setSelectedItem(item);
                          setIsDeleteOpen(true);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : entitySubTab === "groups" ? (
                (paginatedData as AssetGroup[]).map((item) => (
                  <TableRow key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.name}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{item.description || "-"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      <Badge variant={(item as any).status === "Active" ? "default" : "secondary"}>{(item as any).status || "Active"}</Badge>
                    </TableCell>
                    <TableCell className="py-3 pr-5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => {
                          setSelectedItem(item);
                          setGroupForm({ name: item.name, description: item.description || "", status: (item as any).status || "Active", subCategoryId: (item as any).subCategoryId || "" });
                          setFieldErrors({});
                          setIsEditOpen(true);
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => {
                          setSelectedItem(item);
                          setIsDeleteOpen(true);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : entitySubTab === "sensitivity" ? (
                (paginatedData as AssetSensitivity[]).map((item) => (
                  <TableRow key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.name}</TableCell>
                    <TableCell className="py-3 pr-5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => {
                          setSelectedItem(item as any);
                          setSensitivityForm({ name: item.name, description: item.description || "" });
                          setFieldErrors({});
                          setIsEditOpen(true);
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => {
                          setSelectedItem(item as any);
                          setIsDeleteOpen(true);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : null}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {t("Showing")} {allData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, allData.length)} {t("of")} {allData.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Add Dialog for Entity List */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">
                  {t("Add")} {entitySubTab === "categories" ? t("Category") :
                       entitySubTab === "subcategories" ? t("Sub Category") :
                       entitySubTab === "groups" ? t("Group") :
                       entitySubTab === "sensitivity" ? t("Sensitivity") :
                       entitySubTab === "asset-list" ? t("Asset") : t("Item")}
                </DialogTitle>
                <DialogDescription>
                  {t("Enter the details for the new item")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
              {entitySubTab === "asset-list" && (
                <>
                  {/* 1. Name */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={assetForm.name}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, name: e.target.value });
                        if (fieldErrors.assetName) {
                          setFieldErrors({ ...fieldErrors, assetName: "" });
                        }
                      }}
                      placeholder={t("Enter asset name")}
                      className={fieldErrors.assetName ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetName}</p>
                    )}
                  </div>

                  {/* 2. Asset ID */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset ID")}</Label>
                    <Input
                      value={assetForm.assetId}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, assetId: e.target.value });
                        if (fieldErrors.assetAssetId) {
                          setFieldErrors({ ...fieldErrors, assetAssetId: "" });
                        }
                      }}
                      placeholder={t("Enter asset ID")}
                      className={fieldErrors.assetAssetId ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetAssetId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetAssetId}</p>
                    )}
                  </div>

                  {/* 3. Asset Location */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Location")}</Label>
                    <Input
                      value={assetForm.location}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, location: e.target.value });
                        if (fieldErrors.assetLocation) {
                          setFieldErrors({ ...fieldErrors, assetLocation: "" });
                        }
                      }}
                      placeholder={t("Enter asset location")}
                      className={fieldErrors.assetLocation ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetLocation && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetLocation}</p>
                    )}
                  </div>

                  {/* 4. Asset Value */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Value")}</Label>
                    <Input
                      type="number"
                      value={assetForm.value || ""}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, value: parseFloat(e.target.value) || 0 });
                        if (fieldErrors.assetValue) {
                          setFieldErrors({ ...fieldErrors, assetValue: "" });
                        }
                      }}
                      placeholder={t("Enter asset value")}
                      className={fieldErrors.assetValue ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetValue && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetValue}</p>
                    )}
                  </div>

                  {/* 5. Acquisition date */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Acquisition date")}</Label>
                    <Input
                      type="date"
                      value={assetForm.acquisitionDate}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, acquisitionDate: e.target.value });
                        if (fieldErrors.assetAcquisitionDate) {
                          setFieldErrors({ ...fieldErrors, assetAcquisitionDate: "" });
                        }
                      }}
                      placeholder="dd/mm/yyyy"
                      className={fieldErrors.assetAcquisitionDate ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetAcquisitionDate && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetAcquisitionDate}</p>
                    )}
                  </div>

                  {/* 6. Lifecycle status */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Lifecycle status")}</Label>
                    <Select
                      value={assetForm.lifecycleStatusId}
                      onValueChange={(value) => {
                        setAssetForm({ ...assetForm, lifecycleStatusId: value });
                        if (fieldErrors.assetLifecycleStatusId) {
                          setFieldErrors({ ...fieldErrors, assetLifecycleStatusId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.assetLifecycleStatusId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue placeholder={t("Select lifecycle status")} />
                      </SelectTrigger>
                      <SelectContent>
                        {lifecycleStatuses.map((ls) => (
                          <SelectItem key={ls.id} value={ls.id}>
                            {ls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.assetLifecycleStatusId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetLifecycleStatusId}</p>
                    )}
                  </div>

                  {/* 7. Risk rating (Radio buttons) */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Risk rating")}</Label>
                    <div className="flex items-center gap-6 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="riskRating"
                          value="High"
                          checked={assetForm.riskRating === "High"}
                          onChange={(e) => {
                            setAssetForm({ ...assetForm, riskRating: e.target.value });
                            if (fieldErrors.assetRiskRating) {
                              setFieldErrors({ ...fieldErrors, assetRiskRating: "" });
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("High")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="riskRating"
                          value="Medium"
                          checked={assetForm.riskRating === "Medium"}
                          onChange={(e) => {
                            setAssetForm({ ...assetForm, riskRating: e.target.value });
                            if (fieldErrors.assetRiskRating) {
                              setFieldErrors({ ...fieldErrors, assetRiskRating: "" });
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Medium")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="riskRating"
                          value="Low"
                          checked={assetForm.riskRating === "Low"}
                          onChange={(e) => {
                            setAssetForm({ ...assetForm, riskRating: e.target.value });
                            if (fieldErrors.assetRiskRating) {
                              setFieldErrors({ ...fieldErrors, assetRiskRating: "" });
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Low")}</span>
                      </label>
                    </div>
                    {fieldErrors.assetRiskRating && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetRiskRating}</p>
                    )}
                  </div>

                  {/* 8. Last risk assessment */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Last risk assessment")}</Label>
                    <Input
                      type="date"
                      value={assetForm.lastRiskAssessment}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, lastRiskAssessment: e.target.value });
                        if (fieldErrors.assetLastRiskAssessment) {
                          setFieldErrors({ ...fieldErrors, assetLastRiskAssessment: "" });
                        }
                      }}
                      placeholder="dd/mm/yyyy"
                      className={fieldErrors.assetLastRiskAssessment ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetLastRiskAssessment && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetLastRiskAssessment}</p>
                    )}
                  </div>

                  {/* 9. Audit trail */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Audit trail")}</Label>
                    <Input
                      value={assetForm.auditTrail}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, auditTrail: e.target.value });
                        if (fieldErrors.assetAuditTrail) {
                          setFieldErrors({ ...fieldErrors, assetAuditTrail: "" });
                        }
                      }}
                      placeholder={t("Enter audit trail")}
                      className={fieldErrors.assetAuditTrail ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetAuditTrail && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetAuditTrail}</p>
                    )}
                  </div>

                  {/* 10. Next review date */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Next review date")}</Label>
                    <Input
                      type="date"
                      value={assetForm.nextReviewDate}
                      onChange={(e) => {
                        setAssetForm({ ...assetForm, nextReviewDate: e.target.value });
                        if (fieldErrors.assetNextReviewDate) {
                          setFieldErrors({ ...fieldErrors, assetNextReviewDate: "" });
                        }
                      }}
                      placeholder="dd/mm/yyyy"
                      className={fieldErrors.assetNextReviewDate ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.assetNextReviewDate && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetNextReviewDate}</p>
                    )}
                  </div>

                  {/* 11. Asset sensitivity */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset sensitivity")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={assetForm.sensitivityId}
                      onValueChange={(value) => {
                        setAssetForm({ ...assetForm, sensitivityId: value });
                        if (fieldErrors.assetSensitivityId) {
                          setFieldErrors({ ...fieldErrors, assetSensitivityId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.assetSensitivityId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue placeholder={t("Select sensitivity")} />
                      </SelectTrigger>
                      <SelectContent>
                        {sensitivities.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.assetSensitivityId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetSensitivityId}</p>
                    )}
                  </div>

                  {/* 12. Asset Category */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Category")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={assetForm.categoryId}
                      onValueChange={(value) => {
                        setAssetForm({ ...assetForm, categoryId: value });
                        if (fieldErrors.assetCategoryId) {
                          setFieldErrors({ ...fieldErrors, assetCategoryId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.assetCategoryId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue placeholder={t("Select category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.assetCategoryId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetCategoryId}</p>
                    )}
                  </div>

                  {/* 13. Asset Sub Category */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={assetForm.subCategoryId}
                      onValueChange={(value) => {
                        setAssetForm({ ...assetForm, subCategoryId: value });
                        if (fieldErrors.assetSubCategoryId) {
                          setFieldErrors({ ...fieldErrors, assetSubCategoryId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.assetSubCategoryId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue placeholder={t("Select sub category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories
                          .filter(sc => !assetForm.categoryId || sc.categoryId === assetForm.categoryId)
                          .map((sc) => (
                            <SelectItem key={sc.id} value={sc.id}>
                              {sc.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.assetSubCategoryId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetSubCategoryId}</p>
                    )}
                  </div>

                  {/* 14. Policies */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Policies")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={assetForm.policies}
                      onValueChange={(value) => {
                        setAssetForm({ ...assetForm, policies: value });
                        if (fieldErrors.assetPolicies) {
                          setFieldErrors({ ...fieldErrors, assetPolicies: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.assetPolicies ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue placeholder={t("Select policies")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="policy1">{t("Policy 1")}</SelectItem>
                        <SelectItem value="policy2">{t("Policy 2")}</SelectItem>
                        <SelectItem value="policy3">{t("Policy 3")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.assetPolicies && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.assetPolicies}</p>
                    )}
                  </div>
                </>
              )}

              {entitySubTab === "categories" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => {
                        setCategoryForm({ ...categoryForm, name: e.target.value });
                        if (fieldErrors.categoryName) {
                          setFieldErrors({ ...fieldErrors, categoryName: "" });
                        }
                      }}
                      placeholder={t("e.g., Hardware, Software, Data")}
                      className={fieldErrors.categoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.categoryName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={categoryForm.status}
                      onValueChange={(value) => {
                        setCategoryForm({ ...categoryForm, status: value });
                        if (fieldErrors.categoryStatus) {
                          setFieldErrors({ ...fieldErrors, categoryStatus: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.categoryStatus ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">{t("Active")}</SelectItem>
                        <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.categoryStatus && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryStatus}</p>
                    )}
                  </div>
                </>
              )}

              {entitySubTab === "subcategories" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={subCategoryForm.categoryId}
                      onValueChange={(value) => {
                        setSubCategoryForm({ ...subCategoryForm, categoryId: value });
                        if (fieldErrors.subCategoryCategoryId) {
                          setFieldErrors({ ...fieldErrors, subCategoryCategoryId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.subCategoryCategoryId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue placeholder={t("Select category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.subCategoryCategoryId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryCategoryId}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={subCategoryForm.name}
                      onChange={(e) => {
                        setSubCategoryForm({ ...subCategoryForm, name: e.target.value });
                        if (fieldErrors.subCategoryName) {
                          setFieldErrors({ ...fieldErrors, subCategoryName: "" });
                        }
                      }}
                      placeholder={t("e.g., Server, Firewall, Router")}
                      className={fieldErrors.subCategoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.subCategoryName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <textarea
                      value={subCategoryForm.description}
                      onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                </>
              )}

              {entitySubTab === "groups" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) => {
                        setGroupForm({ ...groupForm, name: e.target.value });
                        if (fieldErrors.groupName) {
                          setFieldErrors({ ...fieldErrors, groupName: "" });
                        }
                      }}
                      placeholder={t("e.g., Security Tools, Payment Systems")}
                      className={fieldErrors.groupName ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.groupName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.groupName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <textarea
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")} *</Label>
                    <div className="flex items-center gap-6 mt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="groupStatus"
                          checked={groupForm.status === "Active"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Active")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="groupStatus"
                          checked={groupForm.status === "Inactive"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Inactive")}</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} *</Label>
                    <Select
                      value={groupForm.subCategoryId}
                      onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue placeholder={t("Select sub category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((subCat) => (
                          <SelectItem key={subCat.id} value={subCat.id}>
                            {subCat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {entitySubTab === "sensitivity" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={sensitivityForm.name}
                    onChange={(e) => {
                      setSensitivityForm({ ...sensitivityForm, name: e.target.value });
                      if (fieldErrors.sensitivityName) {
                        setFieldErrors({ ...fieldErrors, sensitivityName: "" });
                      }
                    }}
                    placeholder={t("e.g., High, Medium, Low")}
                    className={fieldErrors.sensitivityName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.sensitivityName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.sensitivityName}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => {
                if (entitySubTab === "asset-list") {
                  handleAddAsset();
                } else if (entitySubTab === "categories") {
                  handleAddCategory();
                } else if (entitySubTab === "subcategories") {
                  handleAddSubCategory();
                } else if (entitySubTab === "groups") {
                  handleAddGroup();
                } else if (entitySubTab === "sensitivity") {
                  handleAddSensitivity();
                }
              }}>
                {t("Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog for Entity List */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">
                  {t("Edit")} {entitySubTab === "categories" ? t("Category") :
                        entitySubTab === "subcategories" ? t("Sub Category") :
                        entitySubTab === "groups" ? t("Group") :
                        entitySubTab === "sensitivity" ? t("Sensitivity") : t("Item")}
                </DialogTitle>
                <DialogDescription>
                  {t("Update the details")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              {entitySubTab === "categories" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => {
                        setCategoryForm({ ...categoryForm, name: e.target.value });
                        if (fieldErrors.categoryName) {
                          setFieldErrors({ ...fieldErrors, categoryName: "" });
                        }
                      }}
                      placeholder={t("e.g., Hardware, Software, Data")}
                      className={fieldErrors.categoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.categoryName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={categoryForm.status}
                      onValueChange={(value) => {
                        setCategoryForm({ ...categoryForm, status: value });
                        if (fieldErrors.categoryStatus) {
                          setFieldErrors({ ...fieldErrors, categoryStatus: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.categoryStatus ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">{t("Active")}</SelectItem>
                        <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.categoryStatus && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryStatus}</p>
                    )}
                  </div>
                </>
              )}

              {entitySubTab === "subcategories" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={subCategoryForm.categoryId}
                      onValueChange={(value) => {
                        setSubCategoryForm({ ...subCategoryForm, categoryId: value });
                        if (fieldErrors.subCategoryCategoryId) {
                          setFieldErrors({ ...fieldErrors, subCategoryCategoryId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors.subCategoryCategoryId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                        <SelectValue placeholder={t("Select category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.subCategoryCategoryId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryCategoryId}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={subCategoryForm.name}
                      onChange={(e) => {
                        setSubCategoryForm({ ...subCategoryForm, name: e.target.value });
                        if (fieldErrors.subCategoryName) {
                          setFieldErrors({ ...fieldErrors, subCategoryName: "" });
                        }
                      }}
                      placeholder={t("e.g., Server, Firewall, Router")}
                      className={fieldErrors.subCategoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.subCategoryName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <textarea
                      value={subCategoryForm.description}
                      onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                </>
              )}

              {entitySubTab === "groups" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) => {
                        setGroupForm({ ...groupForm, name: e.target.value });
                        if (fieldErrors.groupName) {
                          setFieldErrors({ ...fieldErrors, groupName: "" });
                        }
                      }}
                      placeholder={t("e.g., Security Tools, Payment Systems")}
                      className={fieldErrors.groupName ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.groupName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.groupName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <textarea
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")} *</Label>
                    <div className="flex items-center gap-6 mt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="editGroupStatus"
                          checked={groupForm.status === "Active"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Active")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="editGroupStatus"
                          checked={groupForm.status === "Inactive"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Inactive")}</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} *</Label>
                    <Select
                      value={groupForm.subCategoryId}
                      onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue placeholder={t("Select sub category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((subCat) => (
                          <SelectItem key={subCat.id} value={subCat.id}>
                            {subCat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {entitySubTab === "sensitivity" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={sensitivityForm.name}
                    onChange={(e) => {
                      setSensitivityForm({ ...sensitivityForm, name: e.target.value });
                      if (fieldErrors.sensitivityName) {
                        setFieldErrors({ ...fieldErrors, sensitivityName: "" });
                      }
                    }}
                    placeholder={t("e.g., High, Medium, Low")}
                    className={fieldErrors.sensitivityName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.sensitivityName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.sensitivityName}</p>
                  )}
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => {
                if (entitySubTab === "categories") {
                  handleEditCategory();
                } else if (entitySubTab === "subcategories") {
                  handleEditSubCategory();
                } else if (entitySubTab === "groups") {
                  handleEditGroup();
                } else if (entitySubTab === "sensitivity") {
                  handleEditSensitivity();
                }
              }}>
                {t("Save Changes")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
                <DialogDescription>
                  {t("Are you sure you want to delete this item? This action cannot be undone.")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={() => {
                if (entitySubTab === "categories") {
                  handleDeleteCategory();
                } else if (entitySubTab === "subcategories") {
                  handleDeleteSubCategory();
                } else if (entitySubTab === "groups") {
                  handleDeleteGroup();
                } else if (entitySubTab === "sensitivity") {
                  handleDeleteSensitivity();
                }
              }}>
                {t("Delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show entity sub-navigation (Asset, Asset Sub Category, Asset Group, Asset Category, Asset Sensitivity)
  if (activeCategory === "asset") {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <button onClick={() => { setActiveCategory(null); setEntitySubTab(null); }} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Asset")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Asset")}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entitySubCategories.map((sub) => {
            const Icon = sub.icon;

            return (
              <button
                key={sub.id}
                className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 ltr:text-left rtl:text-right cursor-pointer"
                onClick={() => {
                  setEntitySubTab(sub.id);
                  setSearchTerm("");
                }}
              >
                <div className="p-3 bg-primary-50 rounded-xl flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800">{sub.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {sub.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Show lifecycle status list view
  if (activeCategory === "lifecycle") {
    const filteredData = lifecycleStatuses.filter(l =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const lcTotalPages = Math.ceil(filteredData.length / itemsPerPage);
    const lcPaginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <button onClick={() => { setActiveCategory(null); setEntitySubTab(null); setCurrentPage(1); }} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Lifecycle Status")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Lifecycle Status")}</h1>
        </div>

        {/* Action Buttons - ABOVE the card */}
        <div className="flex items-center justify-end gap-2">
          <label>
            <input
              type="file"
              accept=".csv"
              onChange={handleImportLifecycleStatuses}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </span>
            </Button>
          </label>
          <Button variant="outline" size="sm" onClick={handleExportLifecycleStatuses}>
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export")}
          </Button>
          <Button size="sm" onClick={() => {
            setLifecycleForm({ name: "", description: "", order: lifecycleStatuses.length });
            setIsAddOpen(true);
          }}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Add New")}
          </Button>
        </div>

        {/* Card with search + table + pagination */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Search Toolbar */}
          <div className="flex items-center px-5 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Name")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lcPaginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-primary-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-800">{t("No lifecycle statuses found")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : lcPaginatedData.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.name}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => {
                        setSelectedItem(item);
                        setLifecycleForm({ name: item.name, description: item.description || "", order: item.order });
                        setFieldErrors({});
                        setIsEditOpen(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => {
                        setSelectedItem(item);
                        setIsDeleteOpen(true);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {t("Showing")} {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)} {t("of")} {filteredData.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" disabled={currentPage >= lcTotalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Add Lifecycle Status Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Lifecycle Status")}</DialogTitle>
                <DialogDescription>
                  {t("Enter the details for the new lifecycle status")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={lifecycleForm.name}
                  onChange={(e) => {
                    setLifecycleForm({ ...lifecycleForm, name: e.target.value });
                    if (fieldErrors.lifecycleName) {
                      setFieldErrors({ ...fieldErrors, lifecycleName: "" });
                    }
                  }}
                  placeholder={t("e.g., Active, In Use, Retired")}
                  className={fieldErrors.lifecycleName ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.lifecycleName && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.lifecycleName}</p>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddLifecycle}>
                {t("Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Lifecycle Status Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Lifecycle Status")}</DialogTitle>
                <DialogDescription>
                  {t("Update the lifecycle status details")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={lifecycleForm.name}
                  onChange={(e) => {
                    setLifecycleForm({ ...lifecycleForm, name: e.target.value });
                    if (fieldErrors.lifecycleName) {
                      setFieldErrors({ ...fieldErrors, lifecycleName: "" });
                    }
                  }}
                  className={fieldErrors.lifecycleName ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.lifecycleName && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.lifecycleName}</p>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleEditLifecycle}>
                {t("Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Lifecycle Status Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Delete Lifecycle Status")}</DialogTitle>
                <DialogDescription>
                  {t("Are you sure you want to delete this lifecycle status? This action cannot be undone.")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteLifecycle}>
                {t("Delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show CIA Configuration view
  if (activeCategory === "cia") {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <button onClick={() => { setActiveCategory(null); setEntitySubTab(null); }} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("CIA Configuration")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("CIA Configuration")}</h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* CIA Rating Card Helper */}
          {[
            { key: "Confidentiality", icon: Lock, iconColor: "text-primary-600", ratings: confidentialityRatings },
            { key: "Integrity", icon: CheckCircle, iconColor: "text-green-600", ratings: integrityRatings },
            { key: "Availability", icon: RefreshCw, iconColor: "text-purple-600", ratings: availabilityRatings },
          ].map(({ key, icon: Icon, iconColor, ratings: ratingsList }) => (
            <div key={key} className="space-y-3">
              {/* Section header + action button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                  <h3 className="text-base font-semibold text-slate-800">{t(key)}</h3>
                </div>
                <Button size="sm" onClick={() => {
                  setCiaRatingType(key);
                  setCiaRatingForm({ label: "", value: 0 });
                  setFieldErrors({});
                  setIsCiaAddOpen(true);
                }}>
                  <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t(`New ${key}`)}
                </Button>
              </div>
              {/* Card with table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="pl-5 pr-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Label")}</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Value")}</th>
                      <th className="pl-3 pr-5 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratingsList.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="pl-5 pr-3 py-3 text-sm font-medium text-slate-800">{r.label}</td>
                        <td className="px-3 py-3 text-sm text-slate-700">{r.value}</td>
                        <td className="pl-3 pr-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => {
                              setSelectedCiaRating(r);
                              setCiaRatingForm({ label: r.label, value: r.value });
                              setFieldErrors({});
                              setIsCiaEditOpen(true);
                            }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => {
                              setSelectedCiaRating(r);
                              setIsCiaDeleteOpen(true);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {ratingsList.length === 0 && (
                      <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-500">{t("No ratings defined")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Scoring Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-800">{t("Scoring Configuration")}</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {scoringCalculationType === "high_of_all"
                  ? t("Define the high range value for each criticality rating")
                  : t("Define low and high range values for each criticality rating")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={scoringCalculationType} onValueChange={handleCalculationTypeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORING_CALCULATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => {
                  setScoringConfigForm({ level: "", minScore: 0, maxScore: 0, color: "#16A34A" });
                  setFieldErrors({});
                  setIsScoringAddOpen(true);
                }}
              >
                <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("New Scoring Configuration")}
              </Button>
            </div>
          </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="pl-5 pr-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Rating")}</th>
                {scoringCalculationType === "high_of_all" ? (
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t("High range")}</th>
                ) : (
                  <>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Low range")}</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t("High range")}</th>
                  </>
                )}
                <th className="pl-3 pr-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {getCurrentConfigs().map((config) => (
                <tr key={config.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="pl-5 pr-3 py-3 text-sm font-medium text-slate-800">{config.level}</td>
                  {scoringCalculationType === "high_of_all" ? (
                    <td className="px-3 py-3 text-sm text-slate-700">{config.maxScore}</td>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-sm text-slate-700">{config.minScore}</td>
                      <td className="px-3 py-3 text-sm text-slate-700">{config.maxScore}</td>
                    </>
                  )}
                  <td className="pl-3 pr-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => {
                          setSelectedScoringConfig(config);
                          setScoringConfigForm({
                            level: config.level,
                            minScore: config.minScore,
                            maxScore: config.maxScore,
                            color: config.color,
                          });
                          setFieldErrors({});
                          setIsScoringEditOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSelectedScoringConfig(config);
                          setIsScoringDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {getCurrentConfigs().length === 0 && (
                <tr>
                  <td colSpan={scoringCalculationType === "high_of_all" ? 3 : 4} className="px-5 py-8 text-center text-sm text-slate-500">
                    {t("No scoring configurations. Click \"New Scoring Configuration\" to add one.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mx-5 my-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="text-sm font-medium text-slate-700 mb-2">{t("How scoring works:")}</h4>
            <p className="text-sm text-slate-500">
              {scoringCalculationType === "high_of_all" &&
                t("The highest value among Confidentiality, Integrity, and Availability is used as the final score.")}
              {scoringCalculationType === "addition_of_all" &&
                t("All three CIA values are added together to calculate the final score.")}
              {scoringCalculationType === "product_of_all" &&
                t("All three CIA values are multiplied together to calculate the final score.")}
            </p>
          </div>
        </div>
        </div>

        {/* Scoring Config Edit Dialog */}
        <Dialog open={isScoringEditOpen} onOpenChange={setIsScoringEditOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Scoring Configuration")}</DialogTitle>
                <DialogDescription>
                  {t("Update the score range and color for this criticality level")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Criticality Level")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={scoringConfigForm.level}
                  onChange={(e) => {
                    setScoringConfigForm({ ...scoringConfigForm, level: e.target.value });
                    if (fieldErrors.scoringConfigLevel) {
                      setFieldErrors({ ...fieldErrors, scoringConfigLevel: "" });
                    }
                  }}
                  placeholder={t("e.g., Critical, High, Medium, Low")}
                  className={fieldErrors.scoringConfigLevel ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.scoringConfigLevel && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigLevel}</p>
                )}
              </div>
              {scoringCalculationType === "high_of_all" ? (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("High range")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    type="number"
                    value={scoringConfigForm.maxScore}
                    onChange={(e) => {
                      setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 });
                      if (fieldErrors.scoringConfigMaxScore) {
                        setFieldErrors({ ...fieldErrors, scoringConfigMaxScore: "" });
                      }
                    }}
                    className={fieldErrors.scoringConfigMaxScore ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.scoringConfigMaxScore && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigMaxScore}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Low range")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.minScore}
                      onChange={(e) => {
                        setScoringConfigForm({ ...scoringConfigForm, minScore: parseInt(e.target.value) || 0 });
                        if (fieldErrors.scoringConfigMinScore) {
                          setFieldErrors({ ...fieldErrors, scoringConfigMinScore: "" });
                        }
                      }}
                      className={fieldErrors.scoringConfigMinScore ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.scoringConfigMinScore && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigMinScore}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("High range")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.maxScore}
                      onChange={(e) => {
                        setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 });
                        if (fieldErrors.scoringConfigMaxScore) {
                          setFieldErrors({ ...fieldErrors, scoringConfigMaxScore: "" });
                        }
                      }}
                      className={fieldErrors.scoringConfigMaxScore ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.scoringConfigMaxScore && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigMaxScore}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsScoringEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleUpdateScoringConfig}>{t("Save Changes")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Scoring Config Add Dialog */}
        <Dialog open={isScoringAddOpen} onOpenChange={setIsScoringAddOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Scoring Configuration")}</DialogTitle>
                <DialogDescription>
                  {t("Add a new scoring configuration for criticality rating")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Rating")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={scoringConfigForm.level}
                  onChange={(e) => {
                    setScoringConfigForm({ ...scoringConfigForm, level: e.target.value });
                    if (fieldErrors.scoringConfigLevel) {
                      setFieldErrors({ ...fieldErrors, scoringConfigLevel: "" });
                    }
                  }}
                  placeholder={t("e.g., Critical, High, Medium, Low")}
                  className={fieldErrors.scoringConfigLevel ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.scoringConfigLevel && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigLevel}</p>
                )}
              </div>
              {scoringCalculationType === "high_of_all" ? (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("High range")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    type="number"
                    value={scoringConfigForm.maxScore}
                    onChange={(e) => {
                      setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 });
                      if (fieldErrors.scoringConfigMaxScore) {
                        setFieldErrors({ ...fieldErrors, scoringConfigMaxScore: "" });
                      }
                    }}
                    className={fieldErrors.scoringConfigMaxScore ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.scoringConfigMaxScore && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigMaxScore}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Low range")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.minScore}
                      onChange={(e) => {
                        setScoringConfigForm({ ...scoringConfigForm, minScore: parseInt(e.target.value) || 0 });
                        if (fieldErrors.scoringConfigMinScore) {
                          setFieldErrors({ ...fieldErrors, scoringConfigMinScore: "" });
                        }
                      }}
                      className={fieldErrors.scoringConfigMinScore ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.scoringConfigMinScore && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigMinScore}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("High range")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.maxScore}
                      onChange={(e) => {
                        setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 });
                        if (fieldErrors.scoringConfigMaxScore) {
                          setFieldErrors({ ...fieldErrors, scoringConfigMaxScore: "" });
                        }
                      }}
                      className={fieldErrors.scoringConfigMaxScore ? "mt-1.5 border-red-500" : "mt-1.5"}
                    />
                    {fieldErrors.scoringConfigMaxScore && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.scoringConfigMaxScore}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsScoringAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddScoringConfig}>{t("Add")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Scoring Config Delete Dialog */}
        <Dialog open={isScoringDeleteOpen} onOpenChange={setIsScoringDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Delete Scoring Configuration")}</DialogTitle>
                <DialogDescription>
                  {`${t("Are you sure you want to delete the")} "${selectedScoringConfig?.level}" ${t("scoring configuration? This action cannot be undone.")}`}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsScoringDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteScoringConfig}>{t("Delete")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CIA Rating Add Dialog */}
        <Dialog open={isCiaAddOpen} onOpenChange={setIsCiaAddOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("New")} {t(ciaRatingType)}</DialogTitle>
                <DialogDescription>
                  {`${t("Add a new")} ${t(ciaRatingType.toLowerCase())} ${t("rating level")}`}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={ciaRatingForm.label}
                  onChange={(e) => {
                    setCiaRatingForm({ ...ciaRatingForm, label: e.target.value });
                    if (fieldErrors.ciaRatingLabel) {
                      setFieldErrors({ ...fieldErrors, ciaRatingLabel: "" });
                    }
                  }}
                  placeholder={t("e.g., high, medium, low")}
                  className={fieldErrors.ciaRatingLabel ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.ciaRatingLabel && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.ciaRatingLabel}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Value")} <span className="text-semantic-error">*</span></Label>
                <Input
                  type="number"
                  value={ciaRatingForm.value}
                  onChange={(e) => {
                    setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 });
                    if (fieldErrors.ciaRatingValue) {
                      setFieldErrors({ ...fieldErrors, ciaRatingValue: "" });
                    }
                  }}
                  placeholder={t("e.g., 10, 5, 1")}
                  className={fieldErrors.ciaRatingValue ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.ciaRatingValue && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.ciaRatingValue}</p>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsCiaAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddCiaRating}>{t("Add")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CIA Rating Edit Dialog */}
        <Dialog open={isCiaEditOpen} onOpenChange={setIsCiaEditOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Rating")}</DialogTitle>
                <DialogDescription>
                  {t("Update the rating details")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={ciaRatingForm.label}
                  onChange={(e) => {
                    setCiaRatingForm({ ...ciaRatingForm, label: e.target.value });
                    if (fieldErrors.ciaRatingLabel) {
                      setFieldErrors({ ...fieldErrors, ciaRatingLabel: "" });
                    }
                  }}
                  className={fieldErrors.ciaRatingLabel ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.ciaRatingLabel && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.ciaRatingLabel}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Value")} <span className="text-semantic-error">*</span></Label>
                <Input
                  type="number"
                  value={ciaRatingForm.value}
                  onChange={(e) => {
                    setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 });
                    if (fieldErrors.ciaRatingValue) {
                      setFieldErrors({ ...fieldErrors, ciaRatingValue: "" });
                    }
                  }}
                  className={fieldErrors.ciaRatingValue ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.ciaRatingValue && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.ciaRatingValue}</p>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsCiaEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleEditCiaRating}>{t("Save Changes")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CIA Rating Delete Dialog */}
        <Dialog open={isCiaDeleteOpen} onOpenChange={setIsCiaDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
                <DialogDescription>
                  {t("Are you sure you want to delete this rating? This action cannot be undone.")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsCiaDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteCiaRating}>
                {t("Delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show main settings grid view (default)
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Asset Settings")}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingCategories.map((category) => {
          const Icon = category.icon;

          return (
            <button
              key={category.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 ltr:text-left rtl:text-right cursor-pointer"
              onClick={() => {
                setActiveCategory(category.id);
                setSearchTerm("");
              }}
            >
              <div className="p-3 bg-primary-50 rounded-xl flex-shrink-0">
                <Icon className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">{category.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {category.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />
            </button>
          );
        })}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">
                {t("Add")} {entitySubTab === "categories" ? t("Category") :
                     entitySubTab === "subcategories" ? t("Sub Category") :
                     entitySubTab === "groups" ? t("Group") :
                     activeCategory === "lifecycle" ? t("Lifecycle Status") : t("Item")}
              </DialogTitle>
              <DialogDescription>
                {t("Enter the details for the new item")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
            {entitySubTab === "categories" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => {
                      setCategoryForm({ ...categoryForm, name: e.target.value });
                      if (fieldErrors.categoryName) {
                        setFieldErrors({ ...fieldErrors, categoryName: "" });
                      }
                    }}
                    placeholder={t("e.g., Hardware, Software, Data")}
                    className={fieldErrors.categoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.categoryName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <Select
                    value={categoryForm.status}
                    onValueChange={(value) => setCategoryForm({ ...categoryForm, status: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "subcategories" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={subCategoryForm.categoryId}
                    onValueChange={(value) => {
                      setSubCategoryForm({ ...subCategoryForm, categoryId: value });
                      if (fieldErrors.subCategoryCategoryId) {
                        setFieldErrors({ ...fieldErrors, subCategoryCategoryId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={fieldErrors.subCategoryCategoryId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                      <SelectValue placeholder={t("Select category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.subCategoryCategoryId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryCategoryId}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={subCategoryForm.name}
                    onChange={(e) => {
                      setSubCategoryForm({ ...subCategoryForm, name: e.target.value });
                      if (fieldErrors.subCategoryName) {
                        setFieldErrors({ ...fieldErrors, subCategoryName: "" });
                      }
                    }}
                    placeholder={t("e.g., Server, Firewall, Router")}
                    className={fieldErrors.subCategoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.subCategoryName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <textarea
                    value={subCategoryForm.description}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
              </>
            )}

            {entitySubTab === "groups" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={groupForm.name}
                    onChange={(e) => {
                      setGroupForm({ ...groupForm, name: e.target.value });
                      if (fieldErrors.groupName) {
                        setFieldErrors({ ...fieldErrors, groupName: "" });
                      }
                    }}
                    placeholder={t("e.g., Security Tools, Payment Systems")}
                    className={fieldErrors.groupName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.groupName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.groupName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Status")} *</Label>
                  <div className="flex items-center gap-6 mt-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="groupStatus3"
                        checked={groupForm.status === "Active"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Active")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="groupStatus3"
                        checked={groupForm.status === "Inactive"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Inactive")}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} *</Label>
                  <Select
                    value={groupForm.subCategoryId}
                    onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder={t("Select sub category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((subCat) => (
                        <SelectItem key={subCat.id} value={subCat.id}>
                          {subCat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "sensitivity" && (
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={sensitivityForm.name}
                  onChange={(e) => {
                    setSensitivityForm({ ...sensitivityForm, name: e.target.value });
                    if (fieldErrors.sensitivityName) {
                      setFieldErrors({ ...fieldErrors, sensitivityName: "" });
                    }
                  }}
                  placeholder={t("e.g., high, medium, low")}
                  className={fieldErrors.sensitivityName ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.sensitivityName && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.sensitivityName}</p>
                )}
              </div>
            )}

            {activeCategory === "lifecycle" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={lifecycleForm.name}
                    onChange={(e) => {
                      setLifecycleForm({ ...lifecycleForm, name: e.target.value });
                      if (fieldErrors.lifecycleName) {
                        setFieldErrors({ ...fieldErrors, lifecycleName: "" });
                      }
                    }}
                    placeholder={t("e.g., Active, In Use, Retired")}
                    className={fieldErrors.lifecycleName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.lifecycleName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.lifecycleName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <textarea
                    value={lifecycleForm.description}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Order")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    type="number"
                    value={lifecycleForm.order}
                    onChange={(e) => {
                      setLifecycleForm({ ...lifecycleForm, order: parseInt(e.target.value) || 0 });
                      if (fieldErrors.lifecycleOrder) {
                        setFieldErrors({ ...fieldErrors, lifecycleOrder: "" });
                      }
                    }}
                    className={fieldErrors.lifecycleOrder ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.lifecycleOrder && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.lifecycleOrder}</p>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => {
              if (activeCategory === "lifecycle") {
                handleAddLifecycle();
              } else if (entitySubTab === "categories") {
                handleAddCategory();
              } else if (entitySubTab === "subcategories") {
                handleAddSubCategory();
              } else if (entitySubTab === "groups") {
                handleAddGroup();
              } else if (entitySubTab === "sensitivity") {
                handleAddSensitivity();
              }
            }}>
              {t("Add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Item")}</DialogTitle>
              <DialogDescription>
                {t("Update the item details")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
            {entitySubTab === "categories" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => {
                      setCategoryForm({ ...categoryForm, name: e.target.value });
                      if (fieldErrors.categoryName) {
                        setFieldErrors({ ...fieldErrors, categoryName: "" });
                      }
                    }}
                    className={fieldErrors.categoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.categoryName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <Select
                    value={categoryForm.status}
                    onValueChange={(value) => setCategoryForm({ ...categoryForm, status: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "subcategories" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={subCategoryForm.categoryId}
                    onValueChange={(value) => {
                      setSubCategoryForm({ ...subCategoryForm, categoryId: value });
                      if (fieldErrors.subCategoryCategoryId) {
                        setFieldErrors({ ...fieldErrors, subCategoryCategoryId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={fieldErrors.subCategoryCategoryId ? "mt-1.5 w-full border-red-500" : "mt-1.5 w-full"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.subCategoryCategoryId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryCategoryId}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={subCategoryForm.name}
                    onChange={(e) => {
                      setSubCategoryForm({ ...subCategoryForm, name: e.target.value });
                      if (fieldErrors.subCategoryName) {
                        setFieldErrors({ ...fieldErrors, subCategoryName: "" });
                      }
                    }}
                    className={fieldErrors.subCategoryName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.subCategoryName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <textarea
                    value={subCategoryForm.description}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                    className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
              </>
            )}

            {entitySubTab === "groups" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={groupForm.name}
                    onChange={(e) => {
                      setGroupForm({ ...groupForm, name: e.target.value });
                      if (fieldErrors.groupName) {
                        setFieldErrors({ ...fieldErrors, groupName: "" });
                      }
                    }}
                    className={fieldErrors.groupName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.groupName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.groupName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Status")} *</Label>
                  <div className="flex items-center gap-6 mt-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editGroupStatus4"
                        checked={groupForm.status === "Active"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Active")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editGroupStatus4"
                        checked={groupForm.status === "Inactive"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Inactive")}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} *</Label>
                  <Select
                    value={groupForm.subCategoryId}
                    onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder={t("Select sub category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((subCat) => (
                        <SelectItem key={subCat.id} value={subCat.id}>
                          {subCat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "sensitivity" && (
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={sensitivityForm.name}
                  onChange={(e) => {
                    setSensitivityForm({ ...sensitivityForm, name: e.target.value });
                    if (fieldErrors.sensitivityName) {
                      setFieldErrors({ ...fieldErrors, sensitivityName: "" });
                    }
                  }}
                  className={fieldErrors.sensitivityName ? "mt-1.5 border-red-500" : "mt-1.5"}
                />
                {fieldErrors.sensitivityName && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.sensitivityName}</p>
                )}
              </div>
            )}

            {activeCategory === "lifecycle" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={lifecycleForm.name}
                    onChange={(e) => {
                      setLifecycleForm({ ...lifecycleForm, name: e.target.value });
                      if (fieldErrors.lifecycleName) {
                        setFieldErrors({ ...fieldErrors, lifecycleName: "" });
                      }
                    }}
                    className={fieldErrors.lifecycleName ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.lifecycleName && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.lifecycleName}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <textarea
                    value={lifecycleForm.description}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, description: e.target.value })}
                    className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Order")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    type="number"
                    value={lifecycleForm.order}
                    onChange={(e) => {
                      setLifecycleForm({ ...lifecycleForm, order: parseInt(e.target.value) || 0 });
                      if (fieldErrors.lifecycleOrder) {
                        setFieldErrors({ ...fieldErrors, lifecycleOrder: "" });
                      }
                    }}
                    className={fieldErrors.lifecycleOrder ? "mt-1.5 border-red-500" : "mt-1.5"}
                  />
                  {fieldErrors.lifecycleOrder && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.lifecycleOrder}</p>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => {
              if (activeCategory === "lifecycle") {
                handleEditLifecycle();
              } else if (entitySubTab === "categories") {
                handleEditCategory();
              } else if (entitySubTab === "subcategories") {
                handleEditSubCategory();
              } else if (entitySubTab === "groups") {
                handleEditGroup();
              } else if (entitySubTab === "sensitivity") {
                handleEditSensitivity();
              }
            }}>
              {t("Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
              <DialogDescription>
                {t("Are you sure you want to delete this item? This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={() => {
              if (activeCategory === "lifecycle") {
                handleDeleteLifecycle();
              } else if (entitySubTab === "categories") {
                handleDeleteCategory();
              } else if (entitySubTab === "subcategories") {
                handleDeleteSubCategory();
              } else if (entitySubTab === "groups") {
                handleDeleteGroup();
              } else if (entitySubTab === "sensitivity") {
                handleDeleteSensitivity();
              }
            }}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CIA Rating Add Dialog */}
      <Dialog open={isCiaAddOpen} onOpenChange={setIsCiaAddOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("New")} {t(ciaRatingType)}</DialogTitle>
              <DialogDescription>
                {`${t("Add a new")} ${t(ciaRatingType.toLowerCase())} ${t("rating level")}`}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Label")} *</Label>
              <Input
                value={ciaRatingForm.label}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, label: e.target.value })}
                placeholder={t("e.g., high, medium, low")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Value")} *</Label>
              <Input
                type="number"
                value={ciaRatingForm.value}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 })}
                placeholder={t("e.g., 10, 5, 1")}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsCiaAddOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddCiaRating}>{t("Add")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CIA Rating Edit Dialog */}
      <Dialog open={isCiaEditOpen} onOpenChange={setIsCiaEditOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Rating")}</DialogTitle>
              <DialogDescription>
                {t("Update the rating details")}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Label")} *</Label>
              <Input
                value={ciaRatingForm.label}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, label: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Value")} *</Label>
              <Input
                type="number"
                value={ciaRatingForm.value}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsCiaEditOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditCiaRating}>{t("Save Changes")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CIA Rating Delete Dialog */}
      <Dialog open={isCiaDeleteOpen} onOpenChange={setIsCiaDeleteOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
              <DialogDescription>
                {t("Are you sure you want to delete this rating? This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsCiaDeleteOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteCiaRating}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
