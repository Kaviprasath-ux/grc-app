"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, Home, ChevronRight, Download, Upload } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { cn } from "@/lib/utils";
import { isValidName, isValidNumber } from "@/lib/validations";
import * as XLSX from "xlsx";

// Type definitions
interface VulnerabilityCategory {
  id: string;
  name: string;
  _count?: { vulnerabilities: number };
}

interface ThreatCategory {
  id: string;
  name: string;
  _count?: { threats: number };
}

interface ControlStrength {
  id: string;
  name: string;
  score: number;
}

interface RiskLikelihood {
  id: string;
  title: string;
  score: number;
  timeFrame: string | null;
  probability: string | null;
}

interface RiskThreat {
  id: string;
  threatId: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: ThreatCategory | null;
}

interface RiskVulnerability {
  id: string;
  vulnId: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: VulnerabilityCategory | null;
}

interface RiskCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: string;
  _count?: { risks: number };
}

interface ImpactCategory {
  id: string;
  name: string;
}

interface ImpactRating {
  id: string;
  name: string;
  score: number;
  description: string | null;
}

interface VulnerabilityRating {
  id: string;
  label: string;
  score: number;
}

interface RiskSubCategory {
  id: string;
  type: string;
}

interface RiskScoreConfig {
  id: string;
  useLikelihood: boolean;
  useImpact: boolean;
  useAssetScore: boolean;
  useVulnerabilityScore: boolean;
  riskTolerance: number;
}

interface RiskRange {
  id: string;
  title: string;
  color: string | null;
  lowRange: number;
  highRange: number;
  timelineDays: number;
  description: string | null;
}

const categoryTitles: Record<string, string> = {
  "category": "Category",
  "control-strength": "Control Strength",
  "likelihood": "Likelihood",
  "threat": "Threat",
  "vulnerability": "Vulnerability",
  "risk-methodology": "Risk Methodology",
  "risk-category": "Risk Category",
  "impact": "Impact",
  "vulnerability-rating": "Vulnerability Rating",
  "risk-sub-category": "Risk Sub Category",
};

export default function RiskSettingsCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const category = params.category as string;
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('risk.settings');

  const [activeTab, setActiveTab] = useState<string>("tab1");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPage2, setCurrentPage2] = useState(1);
  const pageSize = 10;

  // Data states
  const [vulnerabilityCategories, setVulnerabilityCategories] = useState<VulnerabilityCategory[]>([]);
  const [threatCategories, setThreatCategories] = useState<ThreatCategory[]>([]);
  const [controlStrengths, setControlStrengths] = useState<ControlStrength[]>([]);
  const [likelihoods, setLikelihoods] = useState<RiskLikelihood[]>([]);
  const [threats, setThreats] = useState<RiskThreat[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<RiskVulnerability[]>([]);
  const [riskCategories, setRiskCategories] = useState<RiskCategory[]>([]);
  const [impactCategories, setImpactCategories] = useState<ImpactCategory[]>([]);
  const [impactRatings, setImpactRatings] = useState<ImpactRating[]>([]);
  const [vulnerabilityRatings, setVulnerabilityRatings] = useState<VulnerabilityRating[]>([]);
  const [riskSubCategories, setRiskSubCategories] = useState<RiskSubCategory[]>([]);
  const [riskScoreConfig, setRiskScoreConfig] = useState<RiskScoreConfig | null>(null);
  const [riskRanges, setRiskRanges] = useState<RiskRange[]>([]);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Import dialog states for vulnerabilities
  const [isVulnImportOpen, setIsVulnImportOpen] = useState(false);
  const [vulnImportLoading, setVulnImportLoading] = useState(false);
  const [vulnSelectedFile, setVulnSelectedFile] = useState<File | null>(null);

  // Import dialog states for threats
  const [isThreatImportOpen, setIsThreatImportOpen] = useState(false);
  const [threatImportLoading, setThreatImportLoading] = useState(false);
  const [threatSelectedFile, setThreatSelectedFile] = useState<File | null>(null);

  // Form states
  const [vulnCatForm, setVulnCatForm] = useState({ name: "" });
  const [threatCatForm, setThreatCatForm] = useState({ name: "" });
  const [controlStrengthForm, setControlStrengthForm] = useState({ name: "", score: 0 });
  const [likelihoodForm, setLikelihoodForm] = useState({ title: "", score: 0, timeFrame: "", probability: "" });
  const [threatForm, setThreatForm] = useState({ name: "", description: "", categoryId: "" });

  // Auto-generate next Threat ID
  const nextThreatId = useMemo(() => {
    let maxNum = 0;
    for (const t of threats) {
      const match = t.threatId?.match(/THR-(\d+)/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `THR-${String(maxNum + 1).padStart(3, "0")}`;
  }, [threats]);
  const [vulnerabilityForm, setVulnerabilityForm] = useState({ name: "", description: "", categoryId: "" });

  // Auto-generate next Vulnerability ID
  const nextVulnId = useMemo(() => {
    let maxNum = 0;
    for (const v of vulnerabilities) {
      const match = v.vulnId?.match(/VUL-(\d+)/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `VUL-${String(maxNum + 1).padStart(3, "0")}`;
  }, [vulnerabilities]);
  const [riskCategoryForm, setRiskCategoryForm] = useState({ name: "", status: "Active" });
  const [impactCatForm, setImpactCatForm] = useState({ name: "" });
  const [impactRatingForm, setImpactRatingForm] = useState({ name: "", score: 0, description: "" });
  const [vulnRatingForm, setVulnRatingForm] = useState({ label: "", score: 0 });
  const [riskSubCatForm, setRiskSubCatForm] = useState({ type: "" });
  const [riskRangeForm, setRiskRangeForm] = useState({ title: "", color: "#000000", lowRange: 0, highRange: 0, timelineDays: 0, description: "" });

  // Field validation errors (per-field inline errors)
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchData();
    setCurrentPage(1);
    setCurrentPage2(1);
    setSearchTerm("");
    setActiveTab("tab1");
  }, [category]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch only the data needed for the current category
      const fetches: Promise<any>[] = [];

      if (category === "category") {
        fetches.push(
          fetch("/api/vulnerability-categories").then(r => r.ok ? r.json() : []),
          fetch("/api/threat-categories").then(r => r.ok ? r.json() : [])
        );
        const [vulnCats, threatCats] = await Promise.all(fetches);
        setVulnerabilityCategories(vulnCats);
        setThreatCategories(threatCats);
      } else if (category === "control-strength") {
        const res = await fetch("/api/control-strengths");
        if (res.ok) setControlStrengths(await res.json());
      } else if (category === "likelihood") {
        const res = await fetch("/api/risk-likelihoods");
        if (res.ok) setLikelihoods(await res.json());
      } else if (category === "threat") {
        const [threatsRes, catsRes] = await Promise.all([
          fetch("/api/risk-threats"),
          fetch("/api/threat-categories")
        ]);
        if (threatsRes.ok) setThreats(await threatsRes.json());
        if (catsRes.ok) setThreatCategories(await catsRes.json());
      } else if (category === "vulnerability") {
        const [vulnsRes, catsRes] = await Promise.all([
          fetch("/api/risk-vulnerabilities"),
          fetch("/api/vulnerability-categories")
        ]);
        if (vulnsRes.ok) setVulnerabilities(await vulnsRes.json());
        if (catsRes.ok) setVulnerabilityCategories(await catsRes.json());
      } else if (category === "risk-methodology") {
        const [configRes, rangesRes] = await Promise.all([
          fetch("/api/risk-score-config"),
          fetch("/api/risk-ranges")
        ]);
        if (configRes.ok) setRiskScoreConfig(await configRes.json());
        if (rangesRes.ok) setRiskRanges(await rangesRes.json());
      } else if (category === "risk-category") {
        const res = await fetch("/api/risk-categories");
        if (res.ok) setRiskCategories(await res.json());
      } else if (category === "impact") {
        const [catsRes, ratingsRes] = await Promise.all([
          fetch("/api/impact-categories"),
          fetch("/api/impact-ratings")
        ]);
        if (catsRes.ok) setImpactCategories(await catsRes.json());
        if (ratingsRes.ok) setImpactRatings(await ratingsRes.json());
      } else if (category === "vulnerability-rating") {
        const res = await fetch("/api/vulnerability-ratings");
        if (res.ok) setVulnerabilityRatings(await res.json());
      } else if (category === "risk-sub-category") {
        const res = await fetch("/api/risk-sub-categories");
        if (res.ok) setRiskSubCategories(await res.json());
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // CRUD Handlers for Vulnerability Category
  const handleAddVulnCat = async () => {
    const errors: { [key: string]: string } = {};
    if (!vulnCatForm.name.trim()) {
      errors.vulnCatName = t("Name is required");
    } else if (!isValidName(vulnCatForm.name.trim())) {
      errors.vulnCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/vulnerability-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vulnCatForm),
      });
      if (res.ok) {
        const created = await res.json();
        setVulnerabilityCategories([...vulnerabilityCategories, created]);
        setVulnCatForm({ name: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditVulnCat = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!vulnCatForm.name.trim()) {
      errors.vulnCatName = t("Name is required");
    } else if (!isValidName(vulnCatForm.name.trim())) {
      errors.vulnCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/vulnerability-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vulnCatForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setVulnerabilityCategories(vulnerabilityCategories.map(c => c.id === updated.id ? updated : c));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteVulnCat = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/vulnerability-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setVulnerabilityCategories(vulnerabilityCategories.filter(c => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Threat Category
  const handleAddThreatCat = async () => {
    const errors: { [key: string]: string } = {};
    if (!threatCatForm.name.trim()) {
      errors.threatCatName = t("Name is required");
    } else if (!isValidName(threatCatForm.name.trim())) {
      errors.threatCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/threat-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(threatCatForm),
      });
      if (res.ok) {
        const created = await res.json();
        setThreatCategories([...threatCategories, created]);
        setThreatCatForm({ name: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditThreatCat = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!threatCatForm.name.trim()) {
      errors.threatCatName = t("Name is required");
    } else if (!isValidName(threatCatForm.name.trim())) {
      errors.threatCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/threat-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(threatCatForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setThreatCategories(threatCategories.map(c => c.id === updated.id ? updated : c));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteThreatCat = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/threat-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setThreatCategories(threatCategories.filter(c => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Control Strength
  const handleAddControlStrength = async () => {
    const errors: { [key: string]: string } = {};
    if (!controlStrengthForm.name.trim()) {
      errors.csName = t("Name is required");
    } else if (!isValidName(controlStrengthForm.name.trim())) {
      errors.csName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (controlStrengthForm.score === 0 || controlStrengthForm.score === null || controlStrengthForm.score === undefined) {
      errors.csScore = t("Score is required");
    } else if (!isValidNumber(controlStrengthForm.score)) {
      errors.csScore = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/control-strengths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(controlStrengthForm),
      });
      if (res.ok) {
        const created = await res.json();
        setControlStrengths([...controlStrengths, created]);
        setControlStrengthForm({ name: "", score: 0 });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditControlStrength = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!controlStrengthForm.name.trim()) {
      errors.csName = t("Name is required");
    } else if (!isValidName(controlStrengthForm.name.trim())) {
      errors.csName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (controlStrengthForm.score === 0 || controlStrengthForm.score === null || controlStrengthForm.score === undefined) {
      errors.csScore = t("Score is required");
    } else if (!isValidNumber(controlStrengthForm.score)) {
      errors.csScore = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/control-strengths/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(controlStrengthForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setControlStrengths(controlStrengths.map(c => c.id === updated.id ? updated : c));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteControlStrength = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/control-strengths/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setControlStrengths(controlStrengths.filter(c => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Likelihood
  const handleAddLikelihood = async () => {
    const errors: { [key: string]: string } = {};
    if (!likelihoodForm.title.trim()) {
      errors.lhTitle = t("Title is required");
    } else if (!isValidName(likelihoodForm.title.trim())) {
      errors.lhTitle = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!isValidNumber(likelihoodForm.score)) {
      errors.lhScore = t("Please enter a valid number");
    }
    if (!likelihoodForm.timeFrame || !likelihoodForm.timeFrame.trim()) {
      errors.lhTimeFrame = t("Time Frame is required");
    }
    if (!likelihoodForm.probability || !likelihoodForm.probability.trim()) {
      errors.lhProbability = t("Probability is required");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-likelihoods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(likelihoodForm),
      });
      if (res.ok) {
        const created = await res.json();
        setLikelihoods([...likelihoods, created]);
        setLikelihoodForm({ title: "", score: 0, timeFrame: "", probability: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditLikelihood = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!likelihoodForm.title.trim()) {
      errors.lhTitle = t("Title is required");
    } else if (!isValidName(likelihoodForm.title.trim())) {
      errors.lhTitle = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!isValidNumber(likelihoodForm.score)) {
      errors.lhScore = t("Please enter a valid number");
    }
    if (!likelihoodForm.timeFrame || !likelihoodForm.timeFrame.trim()) {
      errors.lhTimeFrame = t("Time Frame is required");
    }
    if (!likelihoodForm.probability || !likelihoodForm.probability.trim()) {
      errors.lhProbability = t("Probability is required");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/risk-likelihoods/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(likelihoodForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setLikelihoods(likelihoods.map(l => l.id === updated.id ? updated : l));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteLikelihood = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/risk-likelihoods/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setLikelihoods(likelihoods.filter(l => l.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Threat
  const handleAddThreat = async () => {
    const errors: { [key: string]: string } = {};
    if (!threatForm.name.trim()) {
      errors.threatName = t("Name is required");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(threatForm),
      });
      if (res.ok) {
        const created = await res.json();
        setThreats([...threats, created]);
        setThreatForm({ name: "", description: "", categoryId: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditThreat = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!threatForm.name.trim()) {
      errors.threatName = t("Name is required");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-threats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, ...threatForm }),
      });
      if (res.ok) {
        const updated = await res.json();
        setThreats(threats.map(t => t.id === updated.id ? updated : t));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteThreat = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/risk-threats?id=${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setThreats(threats.filter(t => t.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Vulnerability
  const handleAddVulnerability = async () => {
    const errors: { [key: string]: string } = {};
    if (!vulnerabilityForm.name.trim()) {
      errors.vulnName = t("Name is required");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-vulnerabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vulnerabilityForm),
      });
      if (res.ok) {
        const created = await res.json();
        setVulnerabilities([...vulnerabilities, created]);
        setVulnerabilityForm({ name: "", description: "", categoryId: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditVulnerability = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!vulnerabilityForm.name.trim()) {
      errors.vulnName = t("Name is required");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-vulnerabilities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, ...vulnerabilityForm }),
      });
      if (res.ok) {
        const updated = await res.json();
        setVulnerabilities(vulnerabilities.map(v => v.id === updated.id ? updated : v));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteVulnerability = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/risk-vulnerabilities?id=${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setVulnerabilities(vulnerabilities.filter(v => v.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Risk Category
  const handleAddRiskCategory = async () => {
    const errors: { [key: string]: string } = {};
    if (!riskCategoryForm.name.trim()) {
      errors.riskCatName = t("Name is required");
    } else if (!isValidName(riskCategoryForm.name.trim())) {
      errors.riskCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riskCategoryForm),
      });
      if (res.ok) {
        const created = await res.json();
        setRiskCategories([...riskCategories, created]);
        setRiskCategoryForm({ name: "", status: "Active" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditRiskCategory = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!riskCategoryForm.name.trim()) {
      errors.riskCatName = t("Name is required");
    } else if (!isValidName(riskCategoryForm.name.trim())) {
      errors.riskCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, ...riskCategoryForm }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRiskCategories(riskCategories.map(c => c.id === updated.id ? updated : c));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteRiskCategory = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/risk-categories?id=${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setRiskCategories(riskCategories.filter(c => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Impact Category
  const handleAddImpactCat = async () => {
    const errors: { [key: string]: string } = {};
    if (!impactCatForm.name.trim()) {
      errors.impactCatName = t("Name is required");
    } else if (!isValidName(impactCatForm.name.trim())) {
      errors.impactCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/impact-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(impactCatForm),
      });
      if (res.ok) {
        const created = await res.json();
        setImpactCategories([...impactCategories, created]);
        setImpactCatForm({ name: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditImpactCat = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!impactCatForm.name.trim()) {
      errors.impactCatName = t("Name is required");
    } else if (!isValidName(impactCatForm.name.trim())) {
      errors.impactCatName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/impact-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(impactCatForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setImpactCategories(impactCategories.map(c => c.id === updated.id ? updated : c));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteImpactCat = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/impact-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setImpactCategories(impactCategories.filter(c => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Impact Rating
  const handleAddImpactRating = async () => {
    const errors: { [key: string]: string } = {};
    if (!impactRatingForm.name.trim()) {
      errors.irName = t("Name is required");
    } else if (!isValidName(impactRatingForm.name.trim())) {
      errors.irName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!isValidNumber(impactRatingForm.score)) {
      errors.irScore = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/impact-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(impactRatingForm),
      });
      if (res.ok) {
        const created = await res.json();
        setImpactRatings([...impactRatings, created]);
        setImpactRatingForm({ name: "", score: 0, description: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditImpactRating = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!impactRatingForm.name.trim()) {
      errors.irName = t("Name is required");
    } else if (!isValidName(impactRatingForm.name.trim())) {
      errors.irName = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!isValidNumber(impactRatingForm.score)) {
      errors.irScore = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/impact-ratings/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(impactRatingForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setImpactRatings(impactRatings.map(r => r.id === updated.id ? updated : r));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteImpactRating = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/impact-ratings/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setImpactRatings(impactRatings.filter(r => r.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Vulnerability Rating
  const handleAddVulnRating = async () => {
    const errors: { [key: string]: string } = {};
    if (!vulnRatingForm.label.trim()) {
      errors.vrLabel = t("Label is required");
    } else if (!isValidName(vulnRatingForm.label.trim())) {
      errors.vrLabel = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!isValidNumber(vulnRatingForm.score)) {
      errors.vrScore = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/vulnerability-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vulnRatingForm),
      });
      if (res.ok) {
        const created = await res.json();
        setVulnerabilityRatings([...vulnerabilityRatings, created]);
        setVulnRatingForm({ label: "", score: 0 });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditVulnRating = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!vulnRatingForm.label.trim()) {
      errors.vrLabel = t("Label is required");
    } else if (!isValidName(vulnRatingForm.label.trim())) {
      errors.vrLabel = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!isValidNumber(vulnRatingForm.score)) {
      errors.vrScore = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/vulnerability-ratings/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vulnRatingForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setVulnerabilityRatings(vulnerabilityRatings.map(r => r.id === updated.id ? updated : r));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteVulnRating = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/vulnerability-ratings/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setVulnerabilityRatings(vulnerabilityRatings.filter(r => r.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Risk Sub Category
  const handleAddRiskSubCat = async () => {
    const errors: { [key: string]: string } = {};
    if (!riskSubCatForm.type.trim()) {
      errors.riskSubCatType = t("Type is required");
    } else if (!isValidName(riskSubCatForm.type.trim())) {
      errors.riskSubCatType = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-sub-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riskSubCatForm),
      });
      if (res.ok) {
        const created = await res.json();
        setRiskSubCategories([...riskSubCategories, created]);
        setRiskSubCatForm({ type: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditRiskSubCat = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!riskSubCatForm.type.trim()) {
      errors.riskSubCatType = t("Type is required");
    } else if (!isValidName(riskSubCatForm.type.trim())) {
      errors.riskSubCatType = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/risk-sub-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riskSubCatForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setRiskSubCategories(riskSubCategories.map(c => c.id === updated.id ? updated : c));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteRiskSubCat = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/risk-sub-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setRiskSubCategories(riskSubCategories.filter(c => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // CRUD Handlers for Risk Range
  const handleAddRiskRange = async () => {
    const errors: { [key: string]: string } = {};
    if (!riskRangeForm.title.trim()) {
      errors.rrTitle = t("Title is required");
    } else if (!isValidName(riskRangeForm.title.trim())) {
      errors.rrTitle = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!riskRangeForm.color || !riskRangeForm.color.trim()) {
      errors.rrColor = t("Color is required");
    }
    if (riskRangeForm.lowRange === null || riskRangeForm.lowRange === undefined) {
      errors.rrLowRange = t("Low Range is required");
    } else if (!isValidNumber(riskRangeForm.lowRange)) {
      errors.rrLowRange = t("Please enter a valid number");
    }
    if (riskRangeForm.highRange === null || riskRangeForm.highRange === undefined) {
      errors.rrHighRange = t("High Range is required");
    } else if (!isValidNumber(riskRangeForm.highRange)) {
      errors.rrHighRange = t("Please enter a valid number");
    }
    if (!isValidNumber(riskRangeForm.timelineDays)) {
      errors.rrTimelineDays = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch("/api/risk-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riskRangeForm),
      });
      if (res.ok) {
        const created = await res.json();
        setRiskRanges([...riskRanges, created]);
        setRiskRangeForm({ title: "", color: "#000000", lowRange: 0, highRange: 0, timelineDays: 0, description: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditRiskRange = async () => {
    if (!selectedItem) return;
    const errors: { [key: string]: string } = {};
    if (!riskRangeForm.title.trim()) {
      errors.rrTitle = t("Title is required");
    } else if (!isValidName(riskRangeForm.title.trim())) {
      errors.rrTitle = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!riskRangeForm.color || !riskRangeForm.color.trim()) {
      errors.rrColor = t("Color is required");
    }
    if (riskRangeForm.lowRange === null || riskRangeForm.lowRange === undefined) {
      errors.rrLowRange = t("Low Range is required");
    } else if (!isValidNumber(riskRangeForm.lowRange)) {
      errors.rrLowRange = t("Please enter a valid number");
    }
    if (riskRangeForm.highRange === null || riskRangeForm.highRange === undefined) {
      errors.rrHighRange = t("High Range is required");
    } else if (!isValidNumber(riskRangeForm.highRange)) {
      errors.rrHighRange = t("Please enter a valid number");
    }
    if (!isValidNumber(riskRangeForm.timelineDays)) {
      errors.rrTimelineDays = t("Please enter a valid number");
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    try {
      const res = await fetch(`/api/risk-ranges/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riskRangeForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setRiskRanges(riskRanges.map(r => r.id === updated.id ? updated : r));
        setIsEditOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDeleteRiskRange = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/risk-ranges/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setRiskRanges(riskRanges.filter(r => r.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Handle score config update
  const handleUpdateScoreConfig = async (field: string, value: boolean | number) => {
    if (!riskScoreConfig) return;
    try {
      const res = await fetch("/api/risk-score-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...riskScoreConfig, [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRiskScoreConfig(updated);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Export handler for vulnerabilities
  const handleVulnerabilityExport = async () => {
    try {
      const response = await fetch("/api/risk-vulnerabilities/export?format=csv");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Vulnerabilities.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: t("Success"), description: t("Vulnerabilities exported successfully") });
      } else {
        toast({ title: t("Error"), description: t("Failed to export vulnerabilities"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to export vulnerabilities:", error);
      toast({ title: t("Error"), description: t("Failed to export vulnerabilities"), variant: "destructive" });
    }
  };

  // Export handler for threats
  const handleThreatExport = async () => {
    try {
      const response = await fetch("/api/risk-threats/export?format=csv");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Threats.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: t("Success"), description: t("Threats exported successfully") });
      } else {
        toast({ title: t("Error"), description: t("Failed to export threats"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to export threats:", error);
      toast({ title: t("Error"), description: t("Failed to export threats"), variant: "destructive" });
    }
  };

  // Import handler for threats
  const handleThreatImport = async () => {
    if (!threatSelectedFile) return;

    setThreatImportLoading(true);
    try {
      const fileName = threatSelectedFile.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      let headers: string[] = [];
      const data: Record<string, string>[] = [];

      if (isExcel) {
        // Parse Excel file
        const arrayBuffer = await threatSelectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast({ title: t("Error"), description: t("File is empty or has no data rows"), variant: "destructive" });
          setThreatImportLoading(false);
          return;
        }

        const headerRow = jsonData[0];
        if (Array.isArray(headerRow)) {
          headers = headerRow.map(h => String(h || "").trim());
        }

        for (let i = 1; i < jsonData.length; i++) {
          const rowArray = jsonData[i];
          if (!Array.isArray(rowArray) || rowArray.length === 0) continue;

          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = String(rowArray[index] || "").trim();
          });

          if (Object.values(row).every(v => !v)) continue;
          data.push(row);
        }
      } else {
        // Parse CSV file
        const text = await threatSelectedFile.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
          toast({ title: t("Error"), description: t("File is empty or has no data rows"), variant: "destructive" });
          setThreatImportLoading(false);
          return;
        }

        headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          const values: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ""));
              current = "";
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ""));

          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });
          data.push(row);
        }
      }

      if (data.length === 0) {
        toast({ title: t("Error"), description: t("No valid data rows found in the file"), variant: "destructive" });
        setThreatImportLoading(false);
        return;
      }

      // Send to API
      const response = await fetch("/api/risk-threats/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, columns: headers }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({ title: t("Import Failed"), description: result.error || t("Failed to import threats"), variant: "destructive" });
        if (result.results?.errors?.length > 0) {
          console.error("Import errors:", result.results.errors);
        }
      } else {
        toast({ title: t("Import Successful"), description: result.message });
        setIsThreatImportOpen(false);
        setThreatSelectedFile(null);
        fetchData();
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: t("Error"), description: t("Failed to process file. Please check the format."), variant: "destructive" });
    } finally {
      setThreatImportLoading(false);
    }
  };

  // Import handler for vulnerabilities
  const handleVulnerabilityImport = async () => {
    if (!vulnSelectedFile) return;

    setVulnImportLoading(true);
    try {
      const fileName = vulnSelectedFile.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      let headers: string[] = [];
      const data: Record<string, string>[] = [];

      if (isExcel) {
        // Parse Excel file
        const arrayBuffer = await vulnSelectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // header: 1 returns array of arrays
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast({
            title: t("Error"),
            description: t("File is empty or has no data rows"),
            variant: "destructive",
          });
          setVulnImportLoading(false);
          return;
        }

        // First row is headers
        const headerRow = jsonData[0];
        if (Array.isArray(headerRow)) {
          headers = headerRow.map(h => String(h || "").trim());
        }

        // Rest are data rows
        for (let i = 1; i < jsonData.length; i++) {
          const rowArray = jsonData[i];
          if (!Array.isArray(rowArray) || rowArray.length === 0) continue;

          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = String(rowArray[index] || "").trim();
          });

          // Skip completely empty rows
          if (Object.values(row).every(v => !v)) continue;
          data.push(row);
        }
      } else {
        // Parse CSV file
        const text = await vulnSelectedFile.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
          toast({
            title: t("Error"),
            description: t("File is empty or has no data rows"),
            variant: "destructive",
          });
          setVulnImportLoading(false);
          return;
        }

        // Parse headers
        headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          // Simple CSV parsing (handles basic quoted values)
          const values: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ""));
              current = "";
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ""));

          // Create row object
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });
          data.push(row);
        }
      }

      if (data.length === 0) {
        toast({
          title: t("Error"),
          description: t("No valid data rows found in the file"),
          variant: "destructive",
        });
        setVulnImportLoading(false);
        return;
      }

      // Send to API
      const response = await fetch("/api/risk-vulnerabilities/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          columns: headers,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: t("Import Failed"),
          description: result.error || t("Failed to import vulnerabilities"),
          variant: "destructive",
        });

        // Log detailed errors if available
        if (result.results?.errors?.length > 0) {
          console.error("Import errors:", result.results.errors);
        }
      } else {
        toast({
          title: t("Import Successful"),
          description: result.message,
        });

        // Close dialog and refresh data
        setIsVulnImportOpen(false);
        setVulnSelectedFile(null);
        fetchData();
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: t("Error"),
        description: t("Failed to process file. Please check the format."),
        variant: "destructive",
      });
    } finally {
      setVulnImportLoading(false);
    }
  };

  // Pagination helper
  const getPaginatedSlice = <T,>(data: T[], page: number): T[] => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  };

  // Translation hooks — must be called before any early returns (React hooks rule)
  // Empty arrays are no-ops; only the category-relevant data will have items
  const { data: translatedVulnCats } = useTranslatedData(vulnerabilityCategories, { modelName: 'VulnerabilityCategory' });
  const { data: translatedThreatCats } = useTranslatedData(threatCategories, { modelName: 'ThreatCategory' });
  const { data: translatedControlStrengths } = useTranslatedData(controlStrengths, { modelName: 'ControlStrength' });
  const { data: translatedLikelihoods } = useTranslatedData(likelihoods, { modelName: 'RiskLikelihood' });
  const { data: translatedThreats } = useTranslatedData(threats, { modelName: 'RiskThreat' });
  const { data: translatedVulnerabilities } = useTranslatedData(vulnerabilities, { modelName: 'RiskVulnerability' });
  const { data: translatedRiskCategories } = useTranslatedData(riskCategories, { modelName: 'RiskCategory' });
  const { data: translatedImpactCats } = useTranslatedData(impactCategories, { modelName: 'ImpactCategory' });
  const { data: translatedImpactRatings } = useTranslatedData(impactRatings, { modelName: 'ImpactRating' });
  const { data: translatedVulnRatings } = useTranslatedData(vulnerabilityRatings, { modelName: 'VulnerabilityRating' });
  const { data: translatedRiskSubCats } = useTranslatedData(riskSubCategories, { modelName: 'RiskSubCategory' });
  const { data: translatedRiskRanges } = useTranslatedData(riskRanges, { modelName: 'RiskRange' });

  const title = t(categoryTitles[category] || "Settings");

  // Show loading state while permissions or data is loading
  if (permissionsLoading || loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{title}</span>
        </nav>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Risk Settings.")} />;
  }

  // Filtered data helpers — use translated data for display and search
  const filteredVulnCats = translatedVulnCats.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredThreatCats = translatedThreatCats.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredControlStrengths = translatedControlStrengths.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredLikelihoods = translatedLikelihoods.filter(l => l.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredThreats = translatedThreats.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredVulnerabilities = translatedVulnerabilities.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredRiskCategories = translatedRiskCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredImpactCats = translatedImpactCats.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredImpactRatings = translatedImpactRatings.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredVulnRatings = translatedVulnRatings.filter(r => r.label.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredRiskSubCats = translatedRiskSubCats.filter(c => c.type.toLowerCase().includes(searchTerm.toLowerCase()));

  // Pagination helpers
  const getTotalPages = (totalItems: number) => Math.ceil(totalItems / pageSize);

  // Search bar renderer
  const renderSearchBar = (placeholder?: string) => (
    <div className="flex flex-wrap items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
      <div className="relative flex-1 min-w-0 sm:min-w-[280px] max-w-md">
        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder={placeholder || t("Search...")}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setCurrentPage2(1); }}
          className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
        />
      </div>
    </div>
  );

  // Action buttons renderer
  const renderActions = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex items-center gap-0.5">
      {canEdit && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={onEdit} title={t("Edit")}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={onDelete} title={t("Delete")}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{title}</span>
      </nav>

      {/* ============================================================ */}
      {/* Category: Vulnerability Category + Threat Category sections  */}
      {/* ============================================================ */}
      {category === "category" && (
        <>
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
          </div>

          <div className="space-y-8">
            {/* Vulnerability Category Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">{t("Vulnerability Category")}</h3>
                {canCreate && (
                  <Button size="sm" onClick={() => { setActiveTab("tab1"); setVulnCatForm({ name: "" }); setIsAddOpen(true); }}>
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add")}
                  </Button>
                )}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {renderSearchBar(t("Search vulnerability categories..."))}
                <Table>
                  <TableHeader>
                    <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Category Name")}</TableHead>
                      {(canEdit || canDelete) && (
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPaginatedSlice(filteredVulnCats, currentPage).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-sm text-slate-500">
                          {t("No categories found")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      getPaginatedSlice(filteredVulnCats, currentPage).map((item) => (
                        <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                          <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.name}</TableCell>
                          {(canEdit || canDelete) && (
                            <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                              {renderActions(
                                () => { setActiveTab("tab1"); setSelectedItem(item); setVulnCatForm({ name: item.name }); setIsEditOpen(true); },
                                () => { setActiveTab("tab1"); setSelectedItem(item); setIsDeleteOpen(true); }
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredVulnCats.length)} totalItems={filteredVulnCats.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
              </div>
            </div>

            {/* Threat Category Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">{t("Threat Category")}</h3>
                {canCreate && (
                  <Button size="sm" onClick={() => { setActiveTab("tab2"); setThreatCatForm({ name: "" }); setIsAddOpen(true); }}>
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add")}
                  </Button>
                )}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {renderSearchBar(t("Search threat categories..."))}
                <Table>
                  <TableHeader>
                    <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Category Name")}</TableHead>
                      {(canEdit || canDelete) && (
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPaginatedSlice(filteredThreatCats, currentPage2).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-sm text-slate-500">
                          {t("No categories found")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      getPaginatedSlice(filteredThreatCats, currentPage2).map((item) => (
                        <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                          <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.name}</TableCell>
                          {(canEdit || canDelete) && (
                            <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                              {renderActions(
                                () => { setActiveTab("tab2"); setSelectedItem(item); setThreatCatForm({ name: item.name }); setIsEditOpen(true); },
                                () => { setActiveTab("tab2"); setSelectedItem(item); setIsDeleteOpen(true); }
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <Pagination currentPage={currentPage2} totalPages={getTotalPages(filteredThreatCats.length)} totalItems={filteredThreatCats.length} itemsPerPage={pageSize} onPageChange={setCurrentPage2} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Control Strength                                             */}
      {/* ============================================================ */}
      {category === "control-strength" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            {canCreate && (
              <Button size="sm" onClick={() => { setControlStrengthForm({ name: "", score: 0 }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Control Strength")}
              </Button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {renderSearchBar(t("Search control strengths..."))}
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Score")}</TableHead>
                  {(canEdit || canDelete) && (
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedSlice(filteredControlStrengths, currentPage).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                  </TableRow>
                ) : (
                  getPaginatedSlice(filteredControlStrengths, currentPage).map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.name}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{item.score}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                          {renderActions(
                            () => { setSelectedItem(item); setControlStrengthForm({ name: item.name, score: item.score }); setIsEditOpen(true); },
                            () => { setSelectedItem(item); setIsDeleteOpen(true); }
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredControlStrengths.length)} totalItems={filteredControlStrengths.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Likelihood                                                   */}
      {/* ============================================================ */}
      {category === "likelihood" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            {canCreate && (
              <Button size="sm" onClick={() => { setLikelihoodForm({ title: "", score: 0, timeFrame: "", probability: "" }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Likelihood")}
              </Button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {renderSearchBar(t("Search likelihoods..."))}
            <div className="overflow-x-auto">
            <Table className="min-w-[550px]">
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Title")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Score")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Time Frame")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Probability")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedSlice(filteredLikelihoods, currentPage).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                  </TableRow>
                ) : (
                  getPaginatedSlice(filteredLikelihoods, currentPage).map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.title}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{item.score}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{item.timeFrame || "-"}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{item.probability || "-"}</TableCell>
                      <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                        {renderActions(
                          () => { setSelectedItem(item); setLikelihoodForm({ title: item.title, score: item.score, timeFrame: item.timeFrame || "", probability: item.probability || "" }); setIsEditOpen(true); },
                          () => { setSelectedItem(item); setIsDeleteOpen(true); }
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
            <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredLikelihoods.length)} totalItems={filteredLikelihoods.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Threat                                                       */}
      {/* ============================================================ */}
      {category === "threat" && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setIsThreatImportOpen(true)}>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleThreatExport}>
                <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Export")}
              </Button>
              {canCreate && (
                <Button size="sm" onClick={() => { setThreatForm({ name: "", description: "", categoryId: "" }); setIsAddOpen(true); }}>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Threat")}
                </Button>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {renderSearchBar(t("Search threats..."))}
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Threat ID")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Category")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Description")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedSlice(filteredThreats, currentPage).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                  </TableRow>
                ) : (
                  getPaginatedSlice(filteredThreats, currentPage).map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm text-slate-600 ltr:pl-5 rtl:pr-5">{item.threatId}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{item.category?.name || "-"}</TableCell>
                      <TableCell className="py-3 text-sm font-medium text-slate-800">{item.name}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600 max-w-[200px] truncate">{item.description || "-"}</TableCell>
                      <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                        {renderActions(
                          () => { setSelectedItem(item); setThreatForm({ name: item.name, description: item.description || "", categoryId: item.categoryId || "" }); setIsEditOpen(true); },
                          () => { setSelectedItem(item); setIsDeleteOpen(true); }
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
            <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredThreats.length)} totalItems={filteredThreats.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Vulnerability                                                */}
      {/* ============================================================ */}
      {category === "vulnerability" && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setIsVulnImportOpen(true)}>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleVulnerabilityExport}>
                <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Export")}
              </Button>
              {canCreate && (
                <Button size="sm" onClick={() => { setVulnerabilityForm({ name: "", description: "", categoryId: "" }); setIsAddOpen(true); }}>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Vulnerability")}
                </Button>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {renderSearchBar(t("Search vulnerabilities..."))}
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Vulnerability ID")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Category")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Description")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedSlice(filteredVulnerabilities, currentPage).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                  </TableRow>
                ) : (
                  getPaginatedSlice(filteredVulnerabilities, currentPage).map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm text-slate-600 ltr:pl-5 rtl:pr-5">{item.vulnId}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{item.category?.name || "-"}</TableCell>
                      <TableCell className="py-3 text-sm font-medium text-slate-800">{item.name}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600 max-w-[200px] truncate">{item.description || "-"}</TableCell>
                      <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                        {renderActions(
                          () => { setSelectedItem(item); setVulnerabilityForm({ name: item.name, description: item.description || "", categoryId: item.categoryId || "" }); setIsEditOpen(true); },
                          () => { setSelectedItem(item); setIsDeleteOpen(true); }
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
            <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredVulnerabilities.length)} totalItems={filteredVulnerabilities.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Risk Methodology                                             */}
      {/* ============================================================ */}
      {category === "risk-methodology" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* Score Configuration */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 sm:px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">{t("Risk Score Configuration")}</h3>
              </div>
              <div className="p-3 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm text-slate-700">{t("Use Likelihood")}</span>
                    <Switch
                      checked={riskScoreConfig?.useLikelihood ?? true}
                      onCheckedChange={(val) => handleUpdateScoreConfig("useLikelihood", val)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm text-slate-700">{t("Use Impact")}</span>
                    <Switch
                      checked={riskScoreConfig?.useImpact ?? true}
                      onCheckedChange={(val) => handleUpdateScoreConfig("useImpact", val)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm text-slate-700">{t("Use Asset Score")}</span>
                    <Switch
                      checked={riskScoreConfig?.useAssetScore ?? false}
                      onCheckedChange={(val) => handleUpdateScoreConfig("useAssetScore", val)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm text-slate-700">{t("Use Vulnerability Score")}</span>
                    <Switch
                      checked={riskScoreConfig?.useVulnerabilityScore ?? false}
                      onCheckedChange={(val) => handleUpdateScoreConfig("useVulnerabilityScore", val)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Risk Tolerance")}</Label>
                  <Input
                    type="number"
                    className="w-24 bg-white"
                    value={riskScoreConfig?.riskTolerance ?? 10}
                    onChange={(e) => handleUpdateScoreConfig("riskTolerance", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Risk Ranges */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">{t("Risk Ranges")}</h3>
                {canCreate && (
                  <Button size="sm" onClick={() => { setRiskRangeForm({ title: "", color: "#000000", lowRange: 0, highRange: 0, timelineDays: 0, description: "" }); setIsAddOpen(true); }}>
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Risk Range")}
                  </Button>
                )}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Title")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Color")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Low Range")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("High Range")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Timeline Days")}</TableHead>
                      {(canEdit || canDelete) && (
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {translatedRiskRanges.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-500">{t("No risk ranges defined")}</TableCell>
                      </TableRow>
                    ) : (
                      translatedRiskRanges.map((item) => (
                        <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                          <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.title}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded border border-slate-200" style={{ backgroundColor: item.color || "#ccc" }} />
                              <span className="text-sm text-slate-600">{item.color || "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">{item.lowRange}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">{item.highRange}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">{item.timelineDays}</TableCell>
                          {(canEdit || canDelete) && (
                            <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                              {renderActions(
                                () => { setSelectedItem(item); setRiskRangeForm({ title: item.title, color: item.color || "#000000", lowRange: item.lowRange, highRange: item.highRange, timelineDays: item.timelineDays, description: item.description || "" }); setIsEditOpen(true); },
                                () => { setSelectedItem(item); setIsDeleteOpen(true); }
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Risk Category                                                */}
      {/* ============================================================ */}
      {category === "risk-category" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            {canCreate && (
              <Button size="sm" onClick={() => { setRiskCategoryForm({ name: "", status: "Active" }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Risk Category")}
              </Button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {renderSearchBar(t("Search risk categories..."))}
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Type")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                  {(canEdit || canDelete) && (
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedSlice(filteredRiskCategories, currentPage).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                  </TableRow>
                ) : (
                  getPaginatedSlice(filteredRiskCategories, currentPage).map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.name}</TableCell>
                      <TableCell className="py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          item.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}>
                          {item.status === "Active" ? t("Active") : t("Inactive")}
                        </span>
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                          {renderActions(
                            () => { setSelectedItem(item); setRiskCategoryForm({ name: item.name, status: item.status }); setIsEditOpen(true); },
                            () => { setSelectedItem(item); setIsDeleteOpen(true); }
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredRiskCategories.length)} totalItems={filteredRiskCategories.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Impact (Tabbed: Categories + Ratings)                        */}
      {/* ============================================================ */}
      {category === "impact" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            {canCreate && (
              <Button size="sm" onClick={() => {
                if (activeTab === "tab1") { setImpactCatForm({ name: "" }); }
                else { setImpactRatingForm({ name: "", score: 0, description: "" }); }
                setIsAddOpen(true);
              }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {activeTab === "tab1" ? t("Add Impact Category") : t("Add Impact Rating")}
              </Button>
            )}
          </div>

          {/* Custom Tabs */}
          <div className="flex gap-4 border-b border-slate-200">
            <button
              className={cn(
                "pb-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === "tab1" ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
              onClick={() => { setActiveTab("tab1"); setCurrentPage(1); }}
            >
              {t("Impact Categories")}
            </button>
            <button
              className={cn(
                "pb-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === "tab2" ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
              onClick={() => { setActiveTab("tab2"); setCurrentPage(1); }}
            >
              {t("Impact Ratings")}
            </button>
          </div>

          {/* Impact Categories Tab */}
          {activeTab === "tab1" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {renderSearchBar(t("Search impact categories..."))}
              <Table>
                <TableHeader>
                  <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Name")}</TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getPaginatedSlice(filteredImpactCats, currentPage).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                    </TableRow>
                  ) : (
                    getPaginatedSlice(filteredImpactCats, currentPage).map((item) => (
                      <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                        <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.name}</TableCell>
                        {(canEdit || canDelete) && (
                          <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                            {renderActions(
                              () => { setSelectedItem(item); setImpactCatForm({ name: item.name }); setIsEditOpen(true); },
                              () => { setSelectedItem(item); setIsDeleteOpen(true); }
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredImpactCats.length)} totalItems={filteredImpactCats.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
            </div>
          )}

          {/* Impact Ratings Tab */}
          {activeTab === "tab2" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {renderSearchBar(t("Search impact ratings..."))}
              <div className="overflow-x-auto">
              <Table className="min-w-[450px]">
                <TableHeader>
                  <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Score")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Description")}</TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getPaginatedSlice(filteredImpactRatings, currentPage).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                    </TableRow>
                  ) : (
                    getPaginatedSlice(filteredImpactRatings, currentPage).map((item) => (
                      <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                        <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.name}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-600">{item.score}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-600 max-w-[200px] truncate">{item.description || "-"}</TableCell>
                        {(canEdit || canDelete) && (
                          <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                            {renderActions(
                              () => { setSelectedItem(item); setImpactRatingForm({ name: item.name, score: item.score, description: item.description || "" }); setIsEditOpen(true); },
                              () => { setSelectedItem(item); setIsDeleteOpen(true); }
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredImpactRatings.length)} totalItems={filteredImpactRatings.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* Vulnerability Rating                                         */}
      {/* ============================================================ */}
      {category === "vulnerability-rating" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            {canCreate && (
              <Button size="sm" onClick={() => { setVulnRatingForm({ label: "", score: 0 }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Vulnerability Rating")}
              </Button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {renderSearchBar(t("Search vulnerability ratings..."))}
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Label")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Score")}</TableHead>
                  {(canEdit || canDelete) && (
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedSlice(filteredVulnRatings, currentPage).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                  </TableRow>
                ) : (
                  getPaginatedSlice(filteredVulnRatings, currentPage).map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.label}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{item.score}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                          {renderActions(
                            () => { setSelectedItem(item); setVulnRatingForm({ label: item.label, score: item.score }); setIsEditOpen(true); },
                            () => { setSelectedItem(item); setIsDeleteOpen(true); }
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredVulnRatings.length)} totalItems={filteredVulnRatings.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Risk Sub Category                                            */}
      {/* ============================================================ */}
      {category === "risk-sub-category" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
            {canCreate && (
              <Button size="sm" onClick={() => { setRiskSubCatForm({ type: "" }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Add Risk Sub Category")}
              </Button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {renderSearchBar(t("Search sub categories..."))}
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Type")}</TableHead>
                  {(canEdit || canDelete) && (
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedSlice(filteredRiskSubCats, currentPage).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-sm text-slate-500">{t("No items found")}</TableCell>
                  </TableRow>
                ) : (
                  getPaginatedSlice(filteredRiskSubCats, currentPage).map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{item.type}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                          {renderActions(
                            () => { setSelectedItem(item); setRiskSubCatForm({ type: item.type }); setIsEditOpen(true); },
                            () => { setSelectedItem(item); setIsDeleteOpen(true); }
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination currentPage={currentPage} totalPages={getTotalPages(filteredRiskSubCats.length)} totalItems={filteredRiskSubCats.length} itemsPerPage={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setFieldErrors({});
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {category === "category" && activeTab === "tab1" && t("Add Vulnerability Category")}
                {category === "category" && activeTab === "tab2" && t("Add Threat Category")}
                {category === "control-strength" && t("Add Control Strength")}
                {category === "likelihood" && t("Add Likelihood")}
                {category === "threat" && t("Add Threat")}
                {category === "vulnerability" && t("Add Vulnerability")}
                {category === "risk-methodology" && t("Add Risk Range")}
                {category === "risk-category" && t("Add Risk Category")}
                {category === "impact" && activeTab === "tab1" && t("Add Impact Category")}
                {category === "impact" && activeTab === "tab2" && t("Add Impact Rating")}
                {category === "vulnerability-rating" && t("Add Vulnerability Rating")}
                {category === "risk-sub-category" && t("Add Risk Sub Category")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-6 space-y-5">
            {category === "category" && activeTab === "tab1" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                <Input
                  value={vulnCatForm.name}
                  onChange={(e) => {
                    setVulnCatForm({ name: e.target.value });
                    if (fieldErrors.vulnCatName) setFieldErrors(prev => ({ ...prev, vulnCatName: "" }));
                  }}
                  placeholder={t("Enter vulnerability category")}
                  className={fieldErrors.vulnCatName ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.vulnCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.vulnCatName}</p>}
              </div>
            )}
            {category === "category" && activeTab === "tab2" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                <Input
                  value={threatCatForm.name}
                  onChange={(e) => {
                    setThreatCatForm({ name: e.target.value });
                    if (fieldErrors.threatCatName) setFieldErrors(prev => ({ ...prev, threatCatName: "" }));
                  }}
                  placeholder={t("Enter threat category")}
                  className={fieldErrors.threatCatName ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.threatCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.threatCatName}</p>}
              </div>
            )}
            {category === "control-strength" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={controlStrengthForm.name}
                    onChange={(e) => {
                      setControlStrengthForm({ ...controlStrengthForm, name: e.target.value });
                      if (fieldErrors.csName) setFieldErrors(prev => ({ ...prev, csName: "" }));
                    }}
                    placeholder={t("Enter name")}
                    className={fieldErrors.csName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.csName && <p className="text-sm text-red-500 mt-1">{fieldErrors.csName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={controlStrengthForm.score}
                    onChange={(e) => {
                      setControlStrengthForm({ ...controlStrengthForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.csScore) setFieldErrors(prev => ({ ...prev, csScore: "" }));
                    }}
                    placeholder={t("Enter score")}
                    className={fieldErrors.csScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.csScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.csScore}</p>}
                </div>
              </>
            )}
            {category === "likelihood" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Title")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={likelihoodForm.title}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, title: e.target.value });
                      if (fieldErrors.lhTitle) setFieldErrors(prev => ({ ...prev, lhTitle: "" }));
                    }}
                    className={fieldErrors.lhTitle ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhTitle && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhTitle}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={likelihoodForm.score}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.lhScore) setFieldErrors(prev => ({ ...prev, lhScore: "" }));
                    }}
                    className={fieldErrors.lhScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhScore}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Time Frame")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={likelihoodForm.timeFrame}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, timeFrame: e.target.value });
                      if (fieldErrors.lhTimeFrame) setFieldErrors(prev => ({ ...prev, lhTimeFrame: "" }));
                    }}
                    className={fieldErrors.lhTimeFrame ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhTimeFrame && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhTimeFrame}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Probability")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={likelihoodForm.probability}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, probability: e.target.value });
                      if (fieldErrors.lhProbability) setFieldErrors(prev => ({ ...prev, lhProbability: "" }));
                    }}
                    className={fieldErrors.lhProbability ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhProbability && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhProbability}</p>}
                </div>
              </>
            )}
            {category === "threat" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Threat ID")}</Label>
                  <Input value={!selectedItem ? nextThreatId : (selectedItem as RiskThreat).threatId || "—"} disabled className="bg-slate-50 text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={threatForm.name}
                    onChange={(e) => {
                      setThreatForm({ ...threatForm, name: e.target.value });
                      if (fieldErrors.threatName) setFieldErrors(prev => ({ ...prev, threatName: "" }));
                    }}
                    className={fieldErrors.threatName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.threatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.threatName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={threatForm.description} onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
                  <Select value={threatForm.categoryId} onValueChange={(val) => setThreatForm({ ...threatForm, categoryId: val })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Select Category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {threatCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "vulnerability" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Vulnerability ID")}</Label>
                  <Input value={!selectedItem ? nextVulnId : (selectedItem as RiskVulnerability).vulnId || "—"} disabled className="bg-slate-50 text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={vulnerabilityForm.name}
                    onChange={(e) => {
                      setVulnerabilityForm({ ...vulnerabilityForm, name: e.target.value });
                      if (fieldErrors.vulnName) setFieldErrors(prev => ({ ...prev, vulnName: "" }));
                    }}
                    className={fieldErrors.vulnName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.vulnName && <p className="text-sm text-red-500 mt-1">{fieldErrors.vulnName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={vulnerabilityForm.description} onChange={(e) => setVulnerabilityForm({ ...vulnerabilityForm, description: e.target.value })} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
                  <Select value={vulnerabilityForm.categoryId} onValueChange={(val) => setVulnerabilityForm({ ...vulnerabilityForm, categoryId: val })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Select Category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {vulnerabilityCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "risk-methodology" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Title")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={riskRangeForm.title}
                    onChange={(e) => {
                      setRiskRangeForm({ ...riskRangeForm, title: e.target.value });
                      if (fieldErrors.rrTitle) setFieldErrors(prev => ({ ...prev, rrTitle: "" }));
                    }}
                    className={fieldErrors.rrTitle ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.rrTitle && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrTitle}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Color")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="color"
                    value={riskRangeForm.color}
                    onChange={(e) => {
                      setRiskRangeForm({ ...riskRangeForm, color: e.target.value });
                      if (fieldErrors.rrColor) setFieldErrors(prev => ({ ...prev, rrColor: "" }));
                    }}
                    className={fieldErrors.rrColor ? "bg-white h-10 border-red-500" : "bg-white h-10"}
                  />
                  {fieldErrors.rrColor && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrColor}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Low Range")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={riskRangeForm.lowRange}
                      onChange={(e) => {
                        setRiskRangeForm({ ...riskRangeForm, lowRange: parseInt(e.target.value) || 0 });
                        if (fieldErrors.rrLowRange) setFieldErrors(prev => ({ ...prev, rrLowRange: "" }));
                      }}
                      className={fieldErrors.rrLowRange ? "bg-white border-red-500" : "bg-white"}
                    />
                    {fieldErrors.rrLowRange && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrLowRange}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("High Range")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={riskRangeForm.highRange}
                      onChange={(e) => {
                        setRiskRangeForm({ ...riskRangeForm, highRange: parseInt(e.target.value) || 0 });
                        if (fieldErrors.rrHighRange) setFieldErrors(prev => ({ ...prev, rrHighRange: "" }));
                      }}
                      className={fieldErrors.rrHighRange ? "bg-white border-red-500" : "bg-white"}
                    />
                    {fieldErrors.rrHighRange && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrHighRange}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Timeline Days")}</Label>
                  <Input
                    type="number"
                    value={riskRangeForm.timelineDays}
                    onChange={(e) => {
                      setRiskRangeForm({ ...riskRangeForm, timelineDays: parseInt(e.target.value) || 0 });
                      if (fieldErrors.rrTimelineDays) setFieldErrors(prev => ({ ...prev, rrTimelineDays: "" }));
                    }}
                    className={fieldErrors.rrTimelineDays ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.rrTimelineDays && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrTimelineDays}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={riskRangeForm.description} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, description: e.target.value })} className="bg-white" />
                </div>
              </>
            )}
            {category === "risk-category" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Type")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={riskCategoryForm.name}
                    onChange={(e) => {
                      setRiskCategoryForm({ ...riskCategoryForm, name: e.target.value });
                      if (fieldErrors.riskCatName) setFieldErrors(prev => ({ ...prev, riskCatName: "" }));
                    }}
                    className={fieldErrors.riskCatName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.riskCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.riskCatName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <Select value={riskCategoryForm.status} onValueChange={(val) => setRiskCategoryForm({ ...riskCategoryForm, status: val })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "impact" && activeTab === "tab1" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                <Input
                  value={impactCatForm.name}
                  onChange={(e) => {
                    setImpactCatForm({ name: e.target.value });
                    if (fieldErrors.impactCatName) setFieldErrors(prev => ({ ...prev, impactCatName: "" }));
                  }}
                  className={fieldErrors.impactCatName ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.impactCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.impactCatName}</p>}
              </div>
            )}
            {category === "impact" && activeTab === "tab2" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={impactRatingForm.name}
                    onChange={(e) => {
                      setImpactRatingForm({ ...impactRatingForm, name: e.target.value });
                      if (fieldErrors.irName) setFieldErrors(prev => ({ ...prev, irName: "" }));
                    }}
                    className={fieldErrors.irName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.irName && <p className="text-sm text-red-500 mt-1">{fieldErrors.irName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={impactRatingForm.score}
                    onChange={(e) => {
                      setImpactRatingForm({ ...impactRatingForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.irScore) setFieldErrors(prev => ({ ...prev, irScore: "" }));
                    }}
                    className={fieldErrors.irScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.irScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.irScore}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={impactRatingForm.description} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, description: e.target.value })} className="bg-white" />
                </div>
              </>
            )}
            {category === "vulnerability-rating" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={vulnRatingForm.label}
                    onChange={(e) => {
                      setVulnRatingForm({ ...vulnRatingForm, label: e.target.value });
                      if (fieldErrors.vrLabel) setFieldErrors(prev => ({ ...prev, vrLabel: "" }));
                    }}
                    className={fieldErrors.vrLabel ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.vrLabel && <p className="text-sm text-red-500 mt-1">{fieldErrors.vrLabel}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={vulnRatingForm.score}
                    onChange={(e) => {
                      setVulnRatingForm({ ...vulnRatingForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.vrScore) setFieldErrors(prev => ({ ...prev, vrScore: "" }));
                    }}
                    className={fieldErrors.vrScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.vrScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.vrScore}</p>}
                </div>
              </>
            )}
            {category === "risk-sub-category" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Type")} <span className="text-red-500">*</span></Label>
                <Input
                  value={riskSubCatForm.type}
                  onChange={(e) => {
                    setRiskSubCatForm({ type: e.target.value });
                    if (fieldErrors.riskSubCatType) setFieldErrors(prev => ({ ...prev, riskSubCatType: "" }));
                  }}
                  className={fieldErrors.riskSubCatType ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.riskSubCatType && <p className="text-sm text-red-500 mt-1">{fieldErrors.riskSubCatType}</p>}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={() => {
              if (category === "category" && activeTab === "tab1") handleAddVulnCat();
              else if (category === "category" && activeTab === "tab2") handleAddThreatCat();
              else if (category === "control-strength") handleAddControlStrength();
              else if (category === "likelihood") handleAddLikelihood();
              else if (category === "threat") handleAddThreat();
              else if (category === "vulnerability") handleAddVulnerability();
              else if (category === "risk-methodology") handleAddRiskRange();
              else if (category === "risk-category") handleAddRiskCategory();
              else if (category === "impact" && activeTab === "tab1") handleAddImpactCat();
              else if (category === "impact" && activeTab === "tab2") handleAddImpactRating();
              else if (category === "vulnerability-rating") handleAddVulnRating();
              else if (category === "risk-sub-category") handleAddRiskSubCat();
            }}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setFieldErrors({});
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {category === "category" && activeTab === "tab1" && t("Edit Vulnerability Category")}
                {category === "category" && activeTab === "tab2" && t("Edit Threat Category")}
                {category === "control-strength" && t("Edit Control Strength")}
                {category === "likelihood" && t("Edit Likelihood")}
                {category === "threat" && t("Edit Threat")}
                {category === "vulnerability" && t("Edit Vulnerability")}
                {category === "risk-methodology" && t("Edit Risk Range")}
                {category === "risk-category" && t("Edit Risk Category")}
                {category === "impact" && activeTab === "tab1" && t("Edit Impact Category")}
                {category === "impact" && activeTab === "tab2" && t("Edit Impact Rating")}
                {category === "vulnerability-rating" && t("Edit Vulnerability Rating")}
                {category === "risk-sub-category" && t("Edit Risk Sub Category")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-6 space-y-5">
            {category === "category" && activeTab === "tab1" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                <Input
                  value={vulnCatForm.name}
                  onChange={(e) => {
                    setVulnCatForm({ name: e.target.value });
                    if (fieldErrors.vulnCatName) setFieldErrors(prev => ({ ...prev, vulnCatName: "" }));
                  }}
                  className={fieldErrors.vulnCatName ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.vulnCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.vulnCatName}</p>}
              </div>
            )}
            {category === "category" && activeTab === "tab2" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                <Input
                  value={threatCatForm.name}
                  onChange={(e) => {
                    setThreatCatForm({ name: e.target.value });
                    if (fieldErrors.threatCatName) setFieldErrors(prev => ({ ...prev, threatCatName: "" }));
                  }}
                  className={fieldErrors.threatCatName ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.threatCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.threatCatName}</p>}
              </div>
            )}
            {category === "control-strength" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={controlStrengthForm.name}
                    onChange={(e) => {
                      setControlStrengthForm({ ...controlStrengthForm, name: e.target.value });
                      if (fieldErrors.csName) setFieldErrors(prev => ({ ...prev, csName: "" }));
                    }}
                    className={fieldErrors.csName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.csName && <p className="text-sm text-red-500 mt-1">{fieldErrors.csName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={controlStrengthForm.score}
                    onChange={(e) => {
                      setControlStrengthForm({ ...controlStrengthForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.csScore) setFieldErrors(prev => ({ ...prev, csScore: "" }));
                    }}
                    className={fieldErrors.csScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.csScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.csScore}</p>}
                </div>
              </>
            )}
            {category === "likelihood" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Title")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={likelihoodForm.title}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, title: e.target.value });
                      if (fieldErrors.lhTitle) setFieldErrors(prev => ({ ...prev, lhTitle: "" }));
                    }}
                    className={fieldErrors.lhTitle ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhTitle && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhTitle}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={likelihoodForm.score}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.lhScore) setFieldErrors(prev => ({ ...prev, lhScore: "" }));
                    }}
                    className={fieldErrors.lhScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhScore}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Time Frame")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={likelihoodForm.timeFrame}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, timeFrame: e.target.value });
                      if (fieldErrors.lhTimeFrame) setFieldErrors(prev => ({ ...prev, lhTimeFrame: "" }));
                    }}
                    className={fieldErrors.lhTimeFrame ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhTimeFrame && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhTimeFrame}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Probability")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={likelihoodForm.probability}
                    onChange={(e) => {
                      setLikelihoodForm({ ...likelihoodForm, probability: e.target.value });
                      if (fieldErrors.lhProbability) setFieldErrors(prev => ({ ...prev, lhProbability: "" }));
                    }}
                    className={fieldErrors.lhProbability ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.lhProbability && <p className="text-sm text-red-500 mt-1">{fieldErrors.lhProbability}</p>}
                </div>
              </>
            )}
            {category === "threat" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Threat ID")}</Label>
                  <Input value={!selectedItem ? nextThreatId : (selectedItem as RiskThreat).threatId || "—"} disabled className="bg-slate-50 text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={threatForm.name}
                    onChange={(e) => {
                      setThreatForm({ ...threatForm, name: e.target.value });
                      if (fieldErrors.threatName) setFieldErrors(prev => ({ ...prev, threatName: "" }));
                    }}
                    className={fieldErrors.threatName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.threatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.threatName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={threatForm.description} onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
                  <Select value={threatForm.categoryId} onValueChange={(val) => setThreatForm({ ...threatForm, categoryId: val })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Select Category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {threatCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "vulnerability" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Vulnerability ID")}</Label>
                  <Input value={!selectedItem ? nextVulnId : (selectedItem as RiskVulnerability).vulnId || "—"} disabled className="bg-slate-50 text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={vulnerabilityForm.name}
                    onChange={(e) => {
                      setVulnerabilityForm({ ...vulnerabilityForm, name: e.target.value });
                      if (fieldErrors.vulnName) setFieldErrors(prev => ({ ...prev, vulnName: "" }));
                    }}
                    className={fieldErrors.vulnName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.vulnName && <p className="text-sm text-red-500 mt-1">{fieldErrors.vulnName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={vulnerabilityForm.description} onChange={(e) => setVulnerabilityForm({ ...vulnerabilityForm, description: e.target.value })} className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
                  <Select value={vulnerabilityForm.categoryId} onValueChange={(val) => setVulnerabilityForm({ ...vulnerabilityForm, categoryId: val })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Select Category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {vulnerabilityCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "risk-methodology" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Title")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={riskRangeForm.title}
                    onChange={(e) => {
                      setRiskRangeForm({ ...riskRangeForm, title: e.target.value });
                      if (fieldErrors.rrTitle) setFieldErrors(prev => ({ ...prev, rrTitle: "" }));
                    }}
                    className={fieldErrors.rrTitle ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.rrTitle && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrTitle}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Color")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="color"
                    value={riskRangeForm.color}
                    onChange={(e) => {
                      setRiskRangeForm({ ...riskRangeForm, color: e.target.value });
                      if (fieldErrors.rrColor) setFieldErrors(prev => ({ ...prev, rrColor: "" }));
                    }}
                    className={fieldErrors.rrColor ? "bg-white h-10 border-red-500" : "bg-white h-10"}
                  />
                  {fieldErrors.rrColor && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrColor}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Low Range")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={riskRangeForm.lowRange}
                      onChange={(e) => {
                        setRiskRangeForm({ ...riskRangeForm, lowRange: parseInt(e.target.value) || 0 });
                        if (fieldErrors.rrLowRange) setFieldErrors(prev => ({ ...prev, rrLowRange: "" }));
                      }}
                      className={fieldErrors.rrLowRange ? "bg-white border-red-500" : "bg-white"}
                    />
                    {fieldErrors.rrLowRange && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrLowRange}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("High Range")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={riskRangeForm.highRange}
                      onChange={(e) => {
                        setRiskRangeForm({ ...riskRangeForm, highRange: parseInt(e.target.value) || 0 });
                        if (fieldErrors.rrHighRange) setFieldErrors(prev => ({ ...prev, rrHighRange: "" }));
                      }}
                      className={fieldErrors.rrHighRange ? "bg-white border-red-500" : "bg-white"}
                    />
                    {fieldErrors.rrHighRange && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrHighRange}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Timeline Days")}</Label>
                  <Input
                    type="number"
                    value={riskRangeForm.timelineDays}
                    onChange={(e) => {
                      setRiskRangeForm({ ...riskRangeForm, timelineDays: parseInt(e.target.value) || 0 });
                      if (fieldErrors.rrTimelineDays) setFieldErrors(prev => ({ ...prev, rrTimelineDays: "" }));
                    }}
                    className={fieldErrors.rrTimelineDays ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.rrTimelineDays && <p className="text-sm text-red-500 mt-1">{fieldErrors.rrTimelineDays}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={riskRangeForm.description} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, description: e.target.value })} className="bg-white" />
                </div>
              </>
            )}
            {category === "risk-category" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Type")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={riskCategoryForm.name}
                    onChange={(e) => {
                      setRiskCategoryForm({ ...riskCategoryForm, name: e.target.value });
                      if (fieldErrors.riskCatName) setFieldErrors(prev => ({ ...prev, riskCatName: "" }));
                    }}
                    className={fieldErrors.riskCatName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.riskCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.riskCatName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <Select value={riskCategoryForm.status} onValueChange={(val) => setRiskCategoryForm({ ...riskCategoryForm, status: val })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "impact" && activeTab === "tab1" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                <Input
                  value={impactCatForm.name}
                  onChange={(e) => {
                    setImpactCatForm({ name: e.target.value });
                    if (fieldErrors.impactCatName) setFieldErrors(prev => ({ ...prev, impactCatName: "" }));
                  }}
                  className={fieldErrors.impactCatName ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.impactCatName && <p className="text-sm text-red-500 mt-1">{fieldErrors.impactCatName}</p>}
              </div>
            )}
            {category === "impact" && activeTab === "tab2" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={impactRatingForm.name}
                    onChange={(e) => {
                      setImpactRatingForm({ ...impactRatingForm, name: e.target.value });
                      if (fieldErrors.irName) setFieldErrors(prev => ({ ...prev, irName: "" }));
                    }}
                    className={fieldErrors.irName ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.irName && <p className="text-sm text-red-500 mt-1">{fieldErrors.irName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={impactRatingForm.score}
                    onChange={(e) => {
                      setImpactRatingForm({ ...impactRatingForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.irScore) setFieldErrors(prev => ({ ...prev, irScore: "" }));
                    }}
                    className={fieldErrors.irScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.irScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.irScore}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input value={impactRatingForm.description} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, description: e.target.value })} className="bg-white" />
                </div>
              </>
            )}
            {category === "vulnerability-rating" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={vulnRatingForm.label}
                    onChange={(e) => {
                      setVulnRatingForm({ ...vulnRatingForm, label: e.target.value });
                      if (fieldErrors.vrLabel) setFieldErrors(prev => ({ ...prev, vrLabel: "" }));
                    }}
                    className={fieldErrors.vrLabel ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.vrLabel && <p className="text-sm text-red-500 mt-1">{fieldErrors.vrLabel}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Score")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={vulnRatingForm.score}
                    onChange={(e) => {
                      setVulnRatingForm({ ...vulnRatingForm, score: parseInt(e.target.value) || 0 });
                      if (fieldErrors.vrScore) setFieldErrors(prev => ({ ...prev, vrScore: "" }));
                    }}
                    className={fieldErrors.vrScore ? "bg-white border-red-500" : "bg-white"}
                  />
                  {fieldErrors.vrScore && <p className="text-sm text-red-500 mt-1">{fieldErrors.vrScore}</p>}
                </div>
              </>
            )}
            {category === "risk-sub-category" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">{t("Type")} <span className="text-red-500">*</span></Label>
                <Input
                  value={riskSubCatForm.type}
                  onChange={(e) => {
                    setRiskSubCatForm({ type: e.target.value });
                    if (fieldErrors.riskSubCatType) setFieldErrors(prev => ({ ...prev, riskSubCatType: "" }));
                  }}
                  className={fieldErrors.riskSubCatType ? "bg-white border-red-500" : "bg-white"}
                />
                {fieldErrors.riskSubCatType && <p className="text-sm text-red-500 mt-1">{fieldErrors.riskSubCatType}</p>}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={() => {
              if (category === "category" && activeTab === "tab1") handleEditVulnCat();
              else if (category === "category" && activeTab === "tab2") handleEditThreatCat();
              else if (category === "control-strength") handleEditControlStrength();
              else if (category === "likelihood") handleEditLikelihood();
              else if (category === "threat") handleEditThreat();
              else if (category === "vulnerability") handleEditVulnerability();
              else if (category === "risk-methodology") handleEditRiskRange();
              else if (category === "risk-category") handleEditRiskCategory();
              else if (category === "impact" && activeTab === "tab1") handleEditImpactCat();
              else if (category === "impact" && activeTab === "tab2") handleEditImpactRating();
              else if (category === "vulnerability-rating") handleEditVulnRating();
              else if (category === "risk-sub-category") handleEditRiskSubCat();
            }}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Delete Confirmation Dialog                                   */}
      {/* ============================================================ */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete this item? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
              if (category === "category" && activeTab === "tab1") handleDeleteVulnCat();
              else if (category === "category" && activeTab === "tab2") handleDeleteThreatCat();
              else if (category === "control-strength") handleDeleteControlStrength();
              else if (category === "likelihood") handleDeleteLikelihood();
              else if (category === "threat") handleDeleteThreat();
              else if (category === "vulnerability") handleDeleteVulnerability();
              else if (category === "risk-methodology") handleDeleteRiskRange();
              else if (category === "risk-category") handleDeleteRiskCategory();
              else if (category === "impact" && activeTab === "tab1") handleDeleteImpactCat();
              else if (category === "impact" && activeTab === "tab2") handleDeleteImpactRating();
              else if (category === "vulnerability-rating") handleDeleteVulnRating();
              else if (category === "risk-sub-category") handleDeleteRiskSubCat();
            }}>{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* Vulnerability Import Dialog                                  */}
      {/* ============================================================ */}
      <Dialog open={isVulnImportOpen} onOpenChange={(open) => {
        setIsVulnImportOpen(open);
        if (!open) {
          setVulnSelectedFile(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Vulnerabilities")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                {t("Upload a CSV or Excel file to import vulnerabilities. Download the template first to see the required format.")}
              </p>
              <div className="bg-slate-50 p-3 rounded-md text-sm">
                <p className="font-medium mb-1 text-slate-700">{t("Required columns:")}</p>
                <p className="text-slate-500">
                  {t("Name, Description, Category")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/risk-vulnerabilities/import");
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "Vulnerability-Import-Template.csv";
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } else {
                        toast({
                          title: t("Error"),
                          description: t("Failed to download template"),
                          variant: "destructive",
                        });
                      }
                    } catch (error) {
                      console.error("Failed to download template:", error);
                      toast({
                        title: t("Error"),
                        description: t("Failed to download template"),
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Download Template")}
                </Button>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                {vulnSelectedFile ? (
                  <p className="text-sm font-medium text-primary-600">{vulnSelectedFile.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">
                    {t("Click to select a CSV or Excel file")}
                  </p>
                )}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  id="vuln-file-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setVulnSelectedFile(file);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => document.getElementById("vuln-file-upload")?.click()}
                >
                  {t("Select File")}
                </Button>
              </div>
            </div>
          </div>
          {vulnSelectedFile && (
            <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setVulnSelectedFile(null)}
                disabled={vulnImportLoading}
              >
                {t("Clear")}
              </Button>
              <Button
                onClick={handleVulnerabilityImport}
                disabled={vulnImportLoading}
              >
                {vulnImportLoading ? (
                  <>
                    <div className="relative h-4 w-4 ltr:mr-2 rtl:ml-2">
                      <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    </div>
                    {t("Importing...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Import")}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Threat Import Dialog                                         */}
      {/* ============================================================ */}
      <Dialog open={isThreatImportOpen} onOpenChange={(open) => {
        setIsThreatImportOpen(open);
        if (!open) {
          setThreatSelectedFile(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Threats")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                {t("Upload a CSV or Excel file to import threats. Download the template first to see the required format.")}
              </p>
              <div className="bg-slate-50 p-3 rounded-md text-sm">
                <p className="font-medium mb-1 text-slate-700">{t("Required columns:")}</p>
                <p className="text-slate-500">
                  {t("Name, Description, Category")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/risk-threats/import");
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "Threat-Import-Template.csv";
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } else {
                        toast({
                          title: t("Error"),
                          description: t("Failed to download template"),
                          variant: "destructive",
                        });
                      }
                    } catch (error) {
                      console.error("Failed to download template:", error);
                      toast({
                        title: t("Error"),
                        description: t("Failed to download template"),
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Download Template")}
                </Button>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                {threatSelectedFile ? (
                  <p className="text-sm font-medium text-primary-600">{threatSelectedFile.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">
                    {t("Click to select a CSV or Excel file")}
                  </p>
                )}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  id="threat-file-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setThreatSelectedFile(file);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => document.getElementById("threat-file-upload")?.click()}
                >
                  {t("Select File")}
                </Button>
              </div>
            </div>
          </div>
          {threatSelectedFile && (
            <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setThreatSelectedFile(null)}
                disabled={threatImportLoading}
              >
                {t("Clear")}
              </Button>
              <Button
                onClick={handleThreatImport}
                disabled={threatImportLoading}
              >
                {threatImportLoading ? (
                  <>
                    <div className="relative h-4 w-4 ltr:mr-2 rtl:ml-2">
                      <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    </div>
                    {t("Importing...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Import")}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
