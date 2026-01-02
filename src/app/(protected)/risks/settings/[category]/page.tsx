"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ArrowLeft, Search } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

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
  "methodology": "Risk Methodology",
  "risk-category": "Risk Category",
  "impact": "Impact",
  "vulnerability-rating": "Vulnerability Rating",
  "risk-sub-category": "Risk Sub Category",
};

export default function RiskSettingsCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const category = params.category as string;

  const [activeTab, setActiveTab] = useState<string>("tab1");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

  // Form states
  const [vulnCatForm, setVulnCatForm] = useState({ name: "" });
  const [threatCatForm, setThreatCatForm] = useState({ name: "" });
  const [controlStrengthForm, setControlStrengthForm] = useState({ name: "", score: 0 });
  const [likelihoodForm, setLikelihoodForm] = useState({ title: "", score: 0, timeFrame: "", probability: "" });
  const [threatForm, setThreatForm] = useState({ name: "", description: "", categoryId: "" });
  const [vulnerabilityForm, setVulnerabilityForm] = useState({ name: "", description: "", categoryId: "" });
  const [riskCategoryForm, setRiskCategoryForm] = useState({ name: "", status: "Active" });
  const [impactCatForm, setImpactCatForm] = useState({ name: "" });
  const [impactRatingForm, setImpactRatingForm] = useState({ name: "", score: 0, description: "" });
  const [vulnRatingForm, setVulnRatingForm] = useState({ label: "", score: 0 });
  const [riskSubCatForm, setRiskSubCatForm] = useState({ type: "" });
  const [riskRangeForm, setRiskRangeForm] = useState({ title: "", color: "#000000", lowRange: 0, highRange: 0, timelineDays: 0, description: "" });

  useEffect(() => {
    fetchData();
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
      } else if (category === "methodology") {
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
    if (!vulnCatForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditVulnCat = async () => {
    if (!selectedItem || !vulnCatForm.name.trim()) return;
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
    if (!threatCatForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditThreatCat = async () => {
    if (!selectedItem || !threatCatForm.name.trim()) return;
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
    if (!controlStrengthForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditControlStrength = async () => {
    if (!selectedItem || !controlStrengthForm.name.trim()) return;
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
    if (!likelihoodForm.title.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditLikelihood = async () => {
    if (!selectedItem || !likelihoodForm.title.trim()) return;
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
    if (!threatForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditThreat = async () => {
    if (!selectedItem || !threatForm.name.trim()) return;
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
    if (!vulnerabilityForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditVulnerability = async () => {
    if (!selectedItem || !vulnerabilityForm.name.trim()) return;
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
    if (!riskCategoryForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditRiskCategory = async () => {
    if (!selectedItem || !riskCategoryForm.name.trim()) return;
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
    if (!impactCatForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditImpactCat = async () => {
    if (!selectedItem || !impactCatForm.name.trim()) return;
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
    if (!impactRatingForm.name.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditImpactRating = async () => {
    if (!selectedItem || !impactRatingForm.name.trim()) return;
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
    if (!vulnRatingForm.label.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditVulnRating = async () => {
    if (!selectedItem || !vulnRatingForm.label.trim()) return;
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
    if (!riskSubCatForm.type.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditRiskSubCat = async () => {
    if (!selectedItem || !riskSubCatForm.type.trim()) return;
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
    if (!riskRangeForm.title.trim()) return;
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
        alert(error.error || "Failed to create");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEditRiskRange = async () => {
    if (!selectedItem || !riskRangeForm.title.trim()) return;
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

  // Column Definitions
  const vulnCatColumns: ColumnDef<VulnerabilityCategory>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "_count.vulnerabilities",
      header: "Vulnerabilities",
      cell: ({ row }) => row.original._count?.vulnerabilities || 0,
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setVulnCatForm({ name: row.original.name });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const threatCatColumns: ColumnDef<ThreatCategory>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "_count.threats",
      header: "Threats",
      cell: ({ row }) => row.original._count?.threats || 0,
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setThreatCatForm({ name: row.original.name });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const controlStrengthColumns: ColumnDef<ControlStrength>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "score", header: "Score" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setControlStrengthForm({ name: row.original.name, score: row.original.score });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const likelihoodColumns: ColumnDef<RiskLikelihood>[] = [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "score", header: "Score" },
    { accessorKey: "timeFrame", header: "Time Frame" },
    { accessorKey: "probability", header: "Probability" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setLikelihoodForm({
              title: row.original.title,
              score: row.original.score,
              timeFrame: row.original.timeFrame || "",
              probability: row.original.probability || "",
            });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const threatColumns: ColumnDef<RiskThreat>[] = [
    { accessorKey: "threatId", header: "Threat ID" },
    { accessorKey: "category.name", header: "Category", cell: ({ row }) => row.original.category?.name || "-" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", header: "Description" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setThreatForm({
              name: row.original.name,
              description: row.original.description || "",
              categoryId: row.original.categoryId || "",
            });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const vulnerabilityColumns: ColumnDef<RiskVulnerability>[] = [
    { accessorKey: "vulnId", header: "Vulnerability ID" },
    { accessorKey: "category.name", header: "Category", cell: ({ row }) => row.original.category?.name || "-" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", header: "Description" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setVulnerabilityForm({
              name: row.original.name,
              description: row.original.description || "",
              categoryId: row.original.categoryId || "",
            });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const riskCategoryColumns: ColumnDef<RiskCategory>[] = [
    { accessorKey: "name", header: "Type" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.getValue("status") === "Active" ? "default" : "secondary"}>
          {row.getValue("status")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setRiskCategoryForm({
              name: row.original.name,
              status: row.original.status,
            });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const impactCatColumns: ColumnDef<ImpactCategory>[] = [
    { accessorKey: "name", header: "Name" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setImpactCatForm({ name: row.original.name });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const impactRatingColumns: ColumnDef<ImpactRating>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "score", header: "Score" },
    { accessorKey: "description", header: "Description" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setImpactRatingForm({
              name: row.original.name,
              score: row.original.score,
              description: row.original.description || "",
            });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const vulnRatingColumns: ColumnDef<VulnerabilityRating>[] = [
    { accessorKey: "label", header: "Label" },
    { accessorKey: "score", header: "Score" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setVulnRatingForm({ label: row.original.label, score: row.original.score });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const riskSubCatColumns: ColumnDef<RiskSubCategory>[] = [
    { accessorKey: "type", header: "Type" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setRiskSubCatForm({ type: row.original.type });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const riskRangeColumns: ColumnDef<RiskRange>[] = [
    { accessorKey: "title", header: "Title" },
    {
      accessorKey: "color",
      header: "Color",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded" style={{ backgroundColor: row.getValue("color") || "#ccc" }} />
          {row.getValue("color") || "-"}
        </div>
      ),
    },
    { accessorKey: "lowRange", header: "Low Range" },
    { accessorKey: "highRange", header: "High Range" },
    { accessorKey: "timelineDays", header: "Timeline (Days)" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setSelectedItem(row.original);
            setRiskRangeForm({
              title: row.original.title,
              color: row.original.color || "#000000",
              lowRange: row.original.lowRange,
              highRange: row.original.highRange,
              timelineDays: row.original.timelineDays,
              description: row.original.description || "",
            });
            setIsEditOpen(true);
          }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
            setSelectedItem(row.original);
            setIsDeleteOpen(true);
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const title = categoryTitles[category] || "Settings";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/risks/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <PageHeader title={title} />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/risks/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <PageHeader title={title} />
      </div>

      {/* Category: Vulnerability Category + Threat Category tabs */}
      {category === "category" && (
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="tab1">Vulnerability Category</TabsTrigger>
              <TabsTrigger value="tab2">Threat Category</TabsTrigger>
            </TabsList>

            <TabsContent value="tab1" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Button onClick={() => { setVulnCatForm({ name: "" }); setIsAddOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Add Vulnerability Category
                </Button>
              </div>
              <DataGrid columns={vulnCatColumns} data={vulnerabilityCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
            </TabsContent>

            <TabsContent value="tab2" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Button onClick={() => { setThreatCatForm({ name: "" }); setIsAddOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Add Threat Category
                </Button>
              </div>
              <DataGrid columns={threatCatColumns} data={threatCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Control Strength */}
      {category === "control-strength" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setControlStrengthForm({ name: "", score: 0 }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Control Strength
            </Button>
          </div>
          <DataGrid columns={controlStrengthColumns} data={controlStrengths.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
        </div>
      )}

      {/* Likelihood */}
      {category === "likelihood" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setLikelihoodForm({ title: "", score: 0, timeFrame: "", probability: "" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Likelihood
            </Button>
          </div>
          <DataGrid columns={likelihoodColumns} data={likelihoods.filter(l => l.title.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
        </div>
      )}

      {/* Threat */}
      {category === "threat" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setThreatForm({ name: "", description: "", categoryId: "" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Threat
            </Button>
          </div>
          <DataGrid columns={threatColumns} data={threats.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
        </div>
      )}

      {/* Vulnerability */}
      {category === "vulnerability" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setVulnerabilityForm({ name: "", description: "", categoryId: "" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Vulnerability
            </Button>
          </div>
          <DataGrid columns={vulnerabilityColumns} data={vulnerabilities.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
        </div>
      )}

      {/* Methodology */}
      {category === "methodology" && (
        <div className="space-y-6">
          {/* Score Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold">Risk Score Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <span>Use Likelihood</span>
                <Switch
                  checked={riskScoreConfig?.useLikelihood ?? true}
                  onCheckedChange={(val) => handleUpdateScoreConfig("useLikelihood", val)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <span>Use Impact</span>
                <Switch
                  checked={riskScoreConfig?.useImpact ?? true}
                  onCheckedChange={(val) => handleUpdateScoreConfig("useImpact", val)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <span>Use Asset Score</span>
                <Switch
                  checked={riskScoreConfig?.useAssetScore ?? false}
                  onCheckedChange={(val) => handleUpdateScoreConfig("useAssetScore", val)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <span>Use Vulnerability Score</span>
                <Switch
                  checked={riskScoreConfig?.useVulnerabilityScore ?? false}
                  onCheckedChange={(val) => handleUpdateScoreConfig("useVulnerabilityScore", val)}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Label>Risk Tolerance</Label>
              <Input
                type="number"
                className="w-24"
                value={riskScoreConfig?.riskTolerance ?? 10}
                onChange={(e) => handleUpdateScoreConfig("riskTolerance", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Risk Ranges */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Risk Ranges</h3>
              <Button onClick={() => { setRiskRangeForm({ title: "", color: "#000000", lowRange: 0, highRange: 0, timelineDays: 0, description: "" }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Add Risk Range
              </Button>
            </div>
            <DataGrid columns={riskRangeColumns} data={riskRanges} hideSearch={true} />
          </div>
        </div>
      )}

      {/* Risk Category */}
      {category === "risk-category" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setRiskCategoryForm({ name: "", status: "Active" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Risk Category
            </Button>
          </div>
          <DataGrid columns={riskCategoryColumns} data={riskCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
        </div>
      )}

      {/* Impact */}
      {category === "impact" && (
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="tab1">Impact Categories</TabsTrigger>
              <TabsTrigger value="tab2">Impact Ratings</TabsTrigger>
            </TabsList>

            <TabsContent value="tab1" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Button onClick={() => { setImpactCatForm({ name: "" }); setIsAddOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Add Impact Category
                </Button>
              </div>
              <DataGrid columns={impactCatColumns} data={impactCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
            </TabsContent>

            <TabsContent value="tab2" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Button onClick={() => { setImpactRatingForm({ name: "", score: 0, description: "" }); setIsAddOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Add Impact Rating
                </Button>
              </div>
              <DataGrid columns={impactRatingColumns} data={impactRatings.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Vulnerability Rating */}
      {category === "vulnerability-rating" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setVulnRatingForm({ label: "", score: 0 }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Vulnerability Rating
            </Button>
          </div>
          <DataGrid columns={vulnRatingColumns} data={vulnerabilityRatings.filter(r => r.label.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
        </div>
      )}

      {/* Risk Sub Category */}
      {category === "risk-sub-category" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setRiskSubCatForm({ type: "" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Risk Sub Category
            </Button>
          </div>
          <DataGrid columns={riskSubCatColumns} data={riskSubCategories.filter(c => c.type.toLowerCase().includes(searchTerm.toLowerCase()))} hideSearch={true} />
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {category === "category" && activeTab === "tab1" && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={vulnCatForm.name} onChange={(e) => setVulnCatForm({ name: e.target.value })} />
              </div>
            )}
            {category === "category" && activeTab === "tab2" && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={threatCatForm.name} onChange={(e) => setThreatCatForm({ name: e.target.value })} />
              </div>
            )}
            {category === "control-strength" && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={controlStrengthForm.name} onChange={(e) => setControlStrengthForm({ ...controlStrengthForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={controlStrengthForm.score} onChange={(e) => setControlStrengthForm({ ...controlStrengthForm, score: parseInt(e.target.value) || 0 })} />
                </div>
              </>
            )}
            {category === "likelihood" && (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={likelihoodForm.title} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={likelihoodForm.score} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, score: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Time Frame</Label>
                  <Input value={likelihoodForm.timeFrame} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, timeFrame: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Probability</Label>
                  <Input value={likelihoodForm.probability} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, probability: e.target.value })} />
                </div>
              </>
            )}
            {category === "threat" && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={threatForm.name} onChange={(e) => setThreatForm({ ...threatForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={threatForm.description} onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={threatForm.categoryId} onValueChange={(val) => setThreatForm({ ...threatForm, categoryId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={vulnerabilityForm.name} onChange={(e) => setVulnerabilityForm({ ...vulnerabilityForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={vulnerabilityForm.description} onChange={(e) => setVulnerabilityForm({ ...vulnerabilityForm, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={vulnerabilityForm.categoryId} onValueChange={(val) => setVulnerabilityForm({ ...vulnerabilityForm, categoryId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {vulnerabilityCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "methodology" && (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={riskRangeForm.title} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input type="color" value={riskRangeForm.color} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, color: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Low Range</Label>
                    <Input type="number" value={riskRangeForm.lowRange} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, lowRange: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>High Range</Label>
                    <Input type="number" value={riskRangeForm.highRange} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, highRange: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Timeline (Days)</Label>
                  <Input type="number" value={riskRangeForm.timelineDays} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, timelineDays: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={riskRangeForm.description} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, description: e.target.value })} />
                </div>
              </>
            )}
            {category === "risk-category" && (
              <>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input value={riskCategoryForm.name} onChange={(e) => setRiskCategoryForm({ ...riskCategoryForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={riskCategoryForm.status} onValueChange={(val) => setRiskCategoryForm({ ...riskCategoryForm, status: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "impact" && activeTab === "tab1" && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={impactCatForm.name} onChange={(e) => setImpactCatForm({ name: e.target.value })} />
              </div>
            )}
            {category === "impact" && activeTab === "tab2" && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={impactRatingForm.name} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={impactRatingForm.score} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, score: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={impactRatingForm.description} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, description: e.target.value })} />
                </div>
              </>
            )}
            {category === "vulnerability-rating" && (
              <>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={vulnRatingForm.label} onChange={(e) => setVulnRatingForm({ ...vulnRatingForm, label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={vulnRatingForm.score} onChange={(e) => setVulnRatingForm({ ...vulnRatingForm, score: parseInt(e.target.value) || 0 })} />
                </div>
              </>
            )}
            {category === "risk-sub-category" && (
              <div className="space-y-2">
                <Label>Type</Label>
                <Input value={riskSubCatForm.type} onChange={(e) => setRiskSubCatForm({ type: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (category === "category" && activeTab === "tab1") handleAddVulnCat();
              else if (category === "category" && activeTab === "tab2") handleAddThreatCat();
              else if (category === "control-strength") handleAddControlStrength();
              else if (category === "likelihood") handleAddLikelihood();
              else if (category === "threat") handleAddThreat();
              else if (category === "vulnerability") handleAddVulnerability();
              else if (category === "methodology") handleAddRiskRange();
              else if (category === "risk-category") handleAddRiskCategory();
              else if (category === "impact" && activeTab === "tab1") handleAddImpactCat();
              else if (category === "impact" && activeTab === "tab2") handleAddImpactRating();
              else if (category === "vulnerability-rating") handleAddVulnRating();
              else if (category === "risk-sub-category") handleAddRiskSubCat();
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {category === "category" && activeTab === "tab1" && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={vulnCatForm.name} onChange={(e) => setVulnCatForm({ name: e.target.value })} />
              </div>
            )}
            {category === "category" && activeTab === "tab2" && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={threatCatForm.name} onChange={(e) => setThreatCatForm({ name: e.target.value })} />
              </div>
            )}
            {category === "control-strength" && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={controlStrengthForm.name} onChange={(e) => setControlStrengthForm({ ...controlStrengthForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={controlStrengthForm.score} onChange={(e) => setControlStrengthForm({ ...controlStrengthForm, score: parseInt(e.target.value) || 0 })} />
                </div>
              </>
            )}
            {category === "likelihood" && (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={likelihoodForm.title} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={likelihoodForm.score} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, score: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Time Frame</Label>
                  <Input value={likelihoodForm.timeFrame} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, timeFrame: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Probability</Label>
                  <Input value={likelihoodForm.probability} onChange={(e) => setLikelihoodForm({ ...likelihoodForm, probability: e.target.value })} />
                </div>
              </>
            )}
            {category === "threat" && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={threatForm.name} onChange={(e) => setThreatForm({ ...threatForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={threatForm.description} onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={threatForm.categoryId} onValueChange={(val) => setThreatForm({ ...threatForm, categoryId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={vulnerabilityForm.name} onChange={(e) => setVulnerabilityForm({ ...vulnerabilityForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={vulnerabilityForm.description} onChange={(e) => setVulnerabilityForm({ ...vulnerabilityForm, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={vulnerabilityForm.categoryId} onValueChange={(val) => setVulnerabilityForm({ ...vulnerabilityForm, categoryId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {vulnerabilityCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "methodology" && (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={riskRangeForm.title} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input type="color" value={riskRangeForm.color} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, color: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Low Range</Label>
                    <Input type="number" value={riskRangeForm.lowRange} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, lowRange: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>High Range</Label>
                    <Input type="number" value={riskRangeForm.highRange} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, highRange: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Timeline (Days)</Label>
                  <Input type="number" value={riskRangeForm.timelineDays} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, timelineDays: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={riskRangeForm.description} onChange={(e) => setRiskRangeForm({ ...riskRangeForm, description: e.target.value })} />
                </div>
              </>
            )}
            {category === "risk-category" && (
              <>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input value={riskCategoryForm.name} onChange={(e) => setRiskCategoryForm({ ...riskCategoryForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={riskCategoryForm.status} onValueChange={(val) => setRiskCategoryForm({ ...riskCategoryForm, status: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {category === "impact" && activeTab === "tab1" && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={impactCatForm.name} onChange={(e) => setImpactCatForm({ name: e.target.value })} />
              </div>
            )}
            {category === "impact" && activeTab === "tab2" && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={impactRatingForm.name} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={impactRatingForm.score} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, score: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={impactRatingForm.description} onChange={(e) => setImpactRatingForm({ ...impactRatingForm, description: e.target.value })} />
                </div>
              </>
            )}
            {category === "vulnerability-rating" && (
              <>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={vulnRatingForm.label} onChange={(e) => setVulnRatingForm({ ...vulnRatingForm, label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={vulnRatingForm.score} onChange={(e) => setVulnRatingForm({ ...vulnRatingForm, score: parseInt(e.target.value) || 0 })} />
                </div>
              </>
            )}
            {category === "risk-sub-category" && (
              <div className="space-y-2">
                <Label>Type</Label>
                <Input value={riskSubCatForm.type} onChange={(e) => setRiskSubCatForm({ type: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (category === "category" && activeTab === "tab1") handleEditVulnCat();
              else if (category === "category" && activeTab === "tab2") handleEditThreatCat();
              else if (category === "control-strength") handleEditControlStrength();
              else if (category === "likelihood") handleEditLikelihood();
              else if (category === "threat") handleEditThreat();
              else if (category === "vulnerability") handleEditVulnerability();
              else if (category === "methodology") handleEditRiskRange();
              else if (category === "risk-category") handleEditRiskCategory();
              else if (category === "impact" && activeTab === "tab1") handleEditImpactCat();
              else if (category === "impact" && activeTab === "tab2") handleEditImpactRating();
              else if (category === "vulnerability-rating") handleEditVulnRating();
              else if (category === "risk-sub-category") handleEditRiskSubCat();
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (category === "category" && activeTab === "tab1") handleDeleteVulnCat();
              else if (category === "category" && activeTab === "tab2") handleDeleteThreatCat();
              else if (category === "control-strength") handleDeleteControlStrength();
              else if (category === "likelihood") handleDeleteLikelihood();
              else if (category === "threat") handleDeleteThreat();
              else if (category === "vulnerability") handleDeleteVulnerability();
              else if (category === "methodology") handleDeleteRiskRange();
              else if (category === "risk-category") handleDeleteRiskCategory();
              else if (category === "impact" && activeTab === "tab1") handleDeleteImpactCat();
              else if (category === "impact" && activeTab === "tab2") handleDeleteImpactRating();
              else if (category === "vulnerability-rating") handleDeleteVulnRating();
              else if (category === "risk-sub-category") handleDeleteRiskSubCat();
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
