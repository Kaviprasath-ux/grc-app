"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, Settings2, AlertTriangle, Shield, Target, TrendingUp, Gauge, Layers, BarChart3, Bug } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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

// Interfaces
interface RiskCategory {
  id: string;
  name: string;
  description: string | null;
  status: string;
  _count?: { risks: number; subCategories: number };
}

interface ThreatCategory {
  id: string;
  name: string;
  description: string | null;
  _count?: { threats: number };
}

interface Threat {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: ThreatCategory | null;
}

interface VulnerabilityCategory {
  id: string;
  name: string;
  description: string | null;
  _count?: { vulnerabilities: number };
}

interface Vulnerability {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: VulnerabilityCategory | null;
}

interface VulnerabilityRating {
  id: string;
  name: string;
  score: number;
  description: string | null;
}

interface Likelihood {
  id: string;
  title: string;
  score: number;
  timeFrame: string | null;
  probability: string | null;
}

interface ImpactCategory {
  id: string;
  name: string;
  _count?: { impactRatings: number };
}

interface ImpactRating {
  id: string;
  name: string;
  score: number;
  description: string | null;
  categoryId: string | null;
  category: ImpactCategory | null;
}

interface ControlStrength {
  id: string;
  name: string;
  score: number;
  description: string | null;
}

interface RiskMethodology {
  id: string;
  includeLikelihood: boolean;
  includeImpact: boolean;
  includeAssetScore: boolean;
  includeVulnerability: boolean;
  riskTolerance: number;
}

interface RiskRange {
  id: string;
  title: string;
  color: string;
  lowRange: number;
  highRange: number;
  description: string | null;
}

// Setting categories for block navigation
const settingCategories = [
  { id: "category", title: "Category", description: "Vulnerability & Threat Categories", icon: Layers },
  { id: "control-strength", title: "Control Strength", description: "Control effectiveness levels", icon: Shield },
  { id: "likelihood", title: "Likelihood", description: "Probability settings", icon: TrendingUp },
  { id: "threat", title: "Threat", description: "Potential threats list", icon: AlertTriangle },
  { id: "vulnerability", title: "Vulnerability", description: "System vulnerabilities", icon: Bug },
  { id: "methodology", title: "Risk Methodology", description: "Calculation settings", icon: Settings2 },
  { id: "risk-category", title: "Risk Category", description: "Risk classification", icon: Target },
  { id: "impact", title: "Impact", description: "Impact categories & ratings", icon: Gauge },
  { id: "vuln-rating", title: "Vulnerability Rating", description: "Vulnerability scores", icon: BarChart3 },
];

export default function RiskSettingsPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Data states
  const [riskCategories, setRiskCategories] = useState<RiskCategory[]>([]);
  const [threatCategories, setThreatCategories] = useState<ThreatCategory[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [vulnCategories, setVulnCategories] = useState<VulnerabilityCategory[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [vulnRatings, setVulnRatings] = useState<VulnerabilityRating[]>([]);
  const [likelihoods, setLikelihoods] = useState<Likelihood[]>([]);
  const [impactCategories, setImpactCategories] = useState<ImpactCategory[]>([]);
  const [impactRatings, setImpactRatings] = useState<ImpactRating[]>([]);
  const [controlStrengths, setControlStrengths] = useState<ControlStrength[]>([]);
  const [methodology, setMethodology] = useState<RiskMethodology | null>(null);
  const [riskRanges, setRiskRanges] = useState<RiskRange[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);
  const [categorySubTab, setCategorySubTab] = useState<"vulnerability" | "threat">("vulnerability");
  const [impactSubTab, setImpactSubTab] = useState<"category" | "rating">("category");

  // Form states
  const [genericForm, setGenericForm] = useState<Record<string, string | number | boolean>>({});

  // Fetch functions
  const fetchRiskCategories = async () => {
    const res = await fetch("/api/risk-categories");
    const data = await res.json();
    setRiskCategories(data);
  };

  const fetchThreatCategories = async () => {
    const res = await fetch("/api/threat-categories");
    const data = await res.json();
    setThreatCategories(data);
  };

  const fetchThreats = async () => {
    const res = await fetch("/api/threats");
    const data = await res.json();
    setThreats(data);
  };

  const fetchVulnCategories = async () => {
    const res = await fetch("/api/vulnerability-categories");
    const data = await res.json();
    setVulnCategories(data);
  };

  const fetchVulnerabilities = async () => {
    const res = await fetch("/api/vulnerabilities");
    const data = await res.json();
    setVulnerabilities(data);
  };

  const fetchVulnRatings = async () => {
    const res = await fetch("/api/vulnerability-ratings");
    const data = await res.json();
    setVulnRatings(data);
  };

  const fetchLikelihoods = async () => {
    const res = await fetch("/api/likelihoods");
    const data = await res.json();
    setLikelihoods(data);
  };

  const fetchImpactCategories = async () => {
    const res = await fetch("/api/impact-categories");
    const data = await res.json();
    setImpactCategories(data);
  };

  const fetchImpactRatings = async () => {
    const res = await fetch("/api/impact-ratings");
    const data = await res.json();
    setImpactRatings(data);
  };

  const fetchControlStrengths = async () => {
    const res = await fetch("/api/control-strengths");
    const data = await res.json();
    setControlStrengths(data);
  };

  const fetchMethodology = async () => {
    const res = await fetch("/api/risk-methodology");
    const data = await res.json();
    setMethodology(data);
  };

  const fetchRiskRanges = async () => {
    const res = await fetch("/api/risk-ranges");
    const data = await res.json();
    setRiskRanges(data);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchRiskCategories(),
        fetchThreatCategories(),
        fetchThreats(),
        fetchVulnCategories(),
        fetchVulnerabilities(),
        fetchVulnRatings(),
        fetchLikelihoods(),
        fetchImpactCategories(),
        fetchImpactRatings(),
        fetchControlStrengths(),
        fetchMethodology(),
        fetchRiskRanges(),
      ]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // CRUD handlers
  const handleAdd = async (endpoint: string, data: Record<string, unknown>) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setIsAddOpen(false);
      setGenericForm({});
      refreshData();
    }
  };

  const handleEdit = async (endpoint: string, id: string, data: Record<string, unknown>) => {
    const res = await fetch(`${endpoint}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setIsEditOpen(false);
      setSelectedItem(null);
      setGenericForm({});
      refreshData();
    }
  };

  const handleDelete = async (endpoint: string, id: string) => {
    const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (res.ok) {
      setIsDeleteOpen(false);
      setSelectedItem(null);
      refreshData();
    }
  };

  const handleMethodologyUpdate = async () => {
    await fetch("/api/risk-methodology", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(methodology),
    });
    fetchMethodology();
  };

  const refreshData = () => {
    switch (activeCategory) {
      case "category":
        if (categorySubTab === "vulnerability") fetchVulnCategories();
        else fetchThreatCategories();
        break;
      case "control-strength":
        fetchControlStrengths();
        break;
      case "likelihood":
        fetchLikelihoods();
        break;
      case "threat":
        fetchThreats();
        break;
      case "vulnerability":
        fetchVulnerabilities();
        break;
      case "methodology":
        fetchMethodology();
        fetchRiskRanges();
        break;
      case "risk-category":
        fetchRiskCategories();
        break;
      case "impact":
        if (impactSubTab === "category") fetchImpactCategories();
        else fetchImpactRatings();
        break;
      case "vuln-rating":
        fetchVulnRatings();
        break;
    }
  };

  // Column definitions
  const vulnCategoryColumns: ColumnDef<VulnerabilityCategory>[] = [
    { accessorKey: "name", header: "Vulnerability Category" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, description: row.original.description || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const threatCategoryColumns: ColumnDef<ThreatCategory>[] = [
    { accessorKey: "name", header: "Threat Category" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, description: row.original.description || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const controlStrengthColumns: ColumnDef<ControlStrength>[] = [
    { accessorKey: "name", header: "Control Strength Name" },
    { accessorKey: "score", header: "Score" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, score: row.original.score, description: row.original.description || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const likelihoodColumns: ColumnDef<Likelihood>[] = [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "score", header: "Score" },
    { accessorKey: "timeFrame", header: "Time Frame" },
    { accessorKey: "probability", header: "Probability" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ title: row.original.title, score: row.original.score, timeFrame: row.original.timeFrame || "", probability: row.original.probability || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const threatColumns: ColumnDef<Threat>[] = [
    { accessorKey: "name", header: "Threat Name" },
    { accessorKey: "category.name", header: "Category" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, description: row.original.description || "", categoryId: row.original.categoryId || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const vulnerabilityColumns: ColumnDef<Vulnerability>[] = [
    { accessorKey: "name", header: "Vulnerability Name" },
    { accessorKey: "category.name", header: "Category" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, description: row.original.description || "", categoryId: row.original.categoryId || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
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
        <Badge variant={row.original.status === "Active" ? "default" : "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, description: row.original.description || "", status: row.original.status }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const impactCategoryColumns: ColumnDef<ImpactCategory>[] = [
    { accessorKey: "name", header: "Name" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
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
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, score: row.original.score, description: row.original.description || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const vulnRatingColumns: ColumnDef<VulnerabilityRating>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "score", header: "Score" },
    { accessorKey: "description", header: "Description" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ name: row.original.name, score: row.original.score, description: row.original.description || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const riskRangeColumns: ColumnDef<RiskRange>[] = [
    { accessorKey: "title", header: "Title" },
    {
      accessorKey: "color",
      header: "Title Color",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded" style={{ backgroundColor: row.original.color }}></div>
          <span className="text-sm">{row.original.color}</span>
        </div>
      ),
    },
    { accessorKey: "lowRange", header: "Low Range" },
    { accessorKey: "highRange", header: "High Range" },
    { accessorKey: "description", header: "Range Description" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setGenericForm({ title: row.original.title, color: row.original.color, lowRange: row.original.lowRange, highRange: row.original.highRange, description: row.original.description || "" }); setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(row.original as unknown as Record<string, unknown>); setIsDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  // Get current endpoint based on active category
  const getEndpoint = () => {
    switch (activeCategory) {
      case "category":
        return categorySubTab === "vulnerability" ? "/api/vulnerability-categories" : "/api/threat-categories";
      case "control-strength":
        return "/api/control-strengths";
      case "likelihood":
        return "/api/likelihoods";
      case "threat":
        return "/api/threats";
      case "vulnerability":
        return "/api/vulnerabilities";
      case "risk-category":
        return "/api/risk-categories";
      case "impact":
        return impactSubTab === "category" ? "/api/impact-categories" : "/api/impact-ratings";
      case "vuln-rating":
        return "/api/vulnerability-ratings";
      case "methodology":
        return "/api/risk-ranges";
      default:
        return "";
    }
  };

  // Render category block cards
  const renderCategoryBlocks = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {settingCategories.map((cat) => (
        <Card
          key={cat.id}
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setActiveCategory(cat.id)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <cat.icon className="h-5 w-5 text-primary" />
              {cat.title}
            </CardTitle>
            <CardDescription>{cat.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );

  // Render Category section (Vulnerability + Threat Categories)
  const renderCategorySection = () => (
    <div className="space-y-4">
      <Tabs value={categorySubTab} onValueChange={(v) => setCategorySubTab(v as "vulnerability" | "threat")}>
        <TabsList>
          <TabsTrigger value="vulnerability">Vulnerability Category</TabsTrigger>
          <TabsTrigger value="threat">Threat Category</TabsTrigger>
        </TabsList>
        <TabsContent value="vulnerability" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Vulnerability Categories</h3>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm">Delete All</Button>
              <Button onClick={() => { setGenericForm({ name: "", description: "" }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> New Vulnerability Category
              </Button>
            </div>
          </div>
          <DataGrid columns={vulnCategoryColumns} data={vulnCategories}  />
        </TabsContent>
        <TabsContent value="threat" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Threat Categories</h3>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm">Delete All</Button>
              <Button onClick={() => { setGenericForm({ name: "", description: "" }); setIsAddOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Threat Category
              </Button>
            </div>
          </div>
          <DataGrid columns={threatCategoryColumns} data={threatCategories}  />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Render Control Strength section
  const renderControlStrengthSection = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Control Strength Settings</h3>
        <Button onClick={() => { setGenericForm({ name: "", score: 0, description: "" }); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Control Strength
        </Button>
      </div>
      <DataGrid columns={controlStrengthColumns} data={controlStrengths}  />
    </div>
  );

  // Render Likelihood section
  const renderLikelihoodSection = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Likelihood Settings</h3>
        <Button onClick={() => { setGenericForm({ title: "", score: 0, timeFrame: "", probability: "" }); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Likelihood
        </Button>
      </div>
      <DataGrid columns={likelihoodColumns} data={likelihoods}  />
    </div>
  );

  // Render Threat section
  const renderThreatSection = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Threats</h3>
        <Button onClick={() => { setGenericForm({ name: "", description: "", categoryId: "" }); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Threat
        </Button>
      </div>
      <DataGrid columns={threatColumns} data={threats}  />
    </div>
  );

  // Render Vulnerability section
  const renderVulnerabilitySection = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Vulnerabilities</h3>
        <Button onClick={() => { setGenericForm({ name: "", description: "", categoryId: "" }); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Vulnerability
        </Button>
      </div>
      <DataGrid columns={vulnerabilityColumns} data={vulnerabilities}  />
    </div>
  );

  // Render Risk Methodology section
  const renderMethodologySection = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Risk Score Formula</CardTitle>
          <CardDescription>Configure which components are included in risk calculation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="likelihood"
                checked={methodology?.includeLikelihood ?? true}
                onCheckedChange={(checked) => setMethodology(prev => prev ? { ...prev, includeLikelihood: !!checked } : null)}
              />
              <Label htmlFor="likelihood">Likelihood score</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="impact"
                checked={methodology?.includeImpact ?? true}
                onCheckedChange={(checked) => setMethodology(prev => prev ? { ...prev, includeImpact: !!checked } : null)}
              />
              <Label htmlFor="impact">Impact</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="assetScore"
                checked={methodology?.includeAssetScore ?? false}
                onCheckedChange={(checked) => setMethodology(prev => prev ? { ...prev, includeAssetScore: !!checked } : null)}
              />
              <Label htmlFor="assetScore">Asset score</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vulnerability"
                checked={methodology?.includeVulnerability ?? true}
                onCheckedChange={(checked) => setMethodology(prev => prev ? { ...prev, includeVulnerability: !!checked } : null)}
              />
              <Label htmlFor="vulnerability">Vulnerability score</Label>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <Label>Risk Tolerance:</Label>
            <Input
              type="number"
              className="w-24"
              value={methodology?.riskTolerance ?? 10}
              onChange={(e) => setMethodology(prev => prev ? { ...prev, riskTolerance: parseInt(e.target.value) || 0 } : null)}
            />
            <Button onClick={handleMethodologyUpdate}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Range Configuration</CardTitle>
          <CardDescription>Define risk rating ranges and colors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setGenericForm({ title: "", color: "#000000", lowRange: 0, highRange: 0, description: "" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> New Range
            </Button>
          </div>
          <DataGrid columns={riskRangeColumns} data={riskRanges}  />
        </CardContent>
      </Card>
    </div>
  );

  // Render Risk Category section
  const renderRiskCategorySection = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Risk Categories</h3>
        <Button onClick={() => { setGenericForm({ name: "", description: "", status: "Active" }); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Risk Category
        </Button>
      </div>
      <DataGrid columns={riskCategoryColumns} data={riskCategories}  />
    </div>
  );

  // Render Impact section (Category + Rating tabs)
  const renderImpactSection = () => (
    <div className="space-y-4">
      <Tabs value={impactSubTab} onValueChange={(v) => setImpactSubTab(v as "category" | "rating")}>
        <TabsList>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="rating">Impact Rating</TabsTrigger>
        </TabsList>
        <TabsContent value="category" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Impact Categories</h3>
            <Button onClick={() => { setGenericForm({ name: "" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> New Category
            </Button>
          </div>
          <DataGrid columns={impactCategoryColumns} data={impactCategories}  />
        </TabsContent>
        <TabsContent value="rating" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Impact Ratings</h3>
            <Button onClick={() => { setGenericForm({ name: "", score: 0, description: "" }); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> New Impact Rating
            </Button>
          </div>
          <DataGrid columns={impactRatingColumns} data={impactRatings}  />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Render Vulnerability Rating section
  const renderVulnRatingSection = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Vulnerability Ratings</h3>
        <Button onClick={() => { setGenericForm({ name: "", score: 0, description: "" }); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Vulnerability Rating
        </Button>
      </div>
      <DataGrid columns={vulnRatingColumns} data={vulnRatings}  />
    </div>
  );

  // Render form fields based on current context
  const renderFormFields = () => {
    const endpoint = getEndpoint();

    if (endpoint.includes("vulnerability-categories") || endpoint.includes("threat-categories")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={genericForm.name as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={genericForm.description as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </>
      );
    }

    if (endpoint.includes("control-strengths")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={genericForm.name as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Score</Label>
            <Input
              type="number"
              value={genericForm.score as number || 0}
              onChange={(e) => setGenericForm(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={genericForm.description as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </>
      );
    }

    if (endpoint.includes("likelihoods")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={genericForm.title as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Score</Label>
            <Input
              type="number"
              value={genericForm.score as number || 0}
              onChange={(e) => setGenericForm(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Time Frame</Label>
            <Input
              value={genericForm.timeFrame as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, timeFrame: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Probability</Label>
            <Input
              value={genericForm.probability as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, probability: e.target.value }))}
            />
          </div>
        </>
      );
    }

    if (endpoint.includes("/api/threats") && !endpoint.includes("categories")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={genericForm.name as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={genericForm.categoryId as string || ""}
              onValueChange={(v) => setGenericForm(prev => ({ ...prev, categoryId: v }))}
            >
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
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={genericForm.description as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </>
      );
    }

    if (endpoint.includes("/api/vulnerabilities") && !endpoint.includes("categories") && !endpoint.includes("ratings")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={genericForm.name as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={genericForm.categoryId as string || ""}
              onValueChange={(v) => setGenericForm(prev => ({ ...prev, categoryId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {vulnCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={genericForm.description as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </>
      );
    }

    if (endpoint.includes("risk-categories")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={genericForm.name as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={genericForm.description as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={genericForm.status as string || "Active"}
              onValueChange={(v) => setGenericForm(prev => ({ ...prev, status: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    if (endpoint.includes("impact-categories")) {
      return (
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={genericForm.name as string || ""}
            onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>
      );
    }

    if (endpoint.includes("impact-ratings") || endpoint.includes("vulnerability-ratings")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={genericForm.name as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Score</Label>
            <Input
              type="number"
              value={genericForm.score as number || 0}
              onChange={(e) => setGenericForm(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={genericForm.description as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </>
      );
    }

    if (endpoint.includes("risk-ranges")) {
      return (
        <>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={genericForm.title as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Color (Hex)</Label>
            <div className="flex gap-2">
              <Input
                value={genericForm.color as string || "#000000"}
                onChange={(e) => setGenericForm(prev => ({ ...prev, color: e.target.value }))}
              />
              <input
                type="color"
                value={genericForm.color as string || "#000000"}
                onChange={(e) => setGenericForm(prev => ({ ...prev, color: e.target.value }))}
                className="w-10 h-10 rounded border cursor-pointer"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Low Range</Label>
              <Input
                type="number"
                value={genericForm.lowRange as number || 0}
                onChange={(e) => setGenericForm(prev => ({ ...prev, lowRange: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>High Range</Label>
              <Input
                type="number"
                value={genericForm.highRange as number || 0}
                onChange={(e) => setGenericForm(prev => ({ ...prev, highRange: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={genericForm.description as string || ""}
              onChange={(e) => setGenericForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </>
      );
    }

    return null;
  };

  // Render active section content
  const renderActiveSection = () => {
    switch (activeCategory) {
      case "category":
        return renderCategorySection();
      case "control-strength":
        return renderControlStrengthSection();
      case "likelihood":
        return renderLikelihoodSection();
      case "threat":
        return renderThreatSection();
      case "vulnerability":
        return renderVulnerabilitySection();
      case "methodology":
        return renderMethodologySection();
      case "risk-category":
        return renderRiskCategorySection();
      case "impact":
        return renderImpactSection();
      case "vuln-rating":
        return renderVulnRatingSection();
      default:
        return renderCategoryBlocks();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Settings"
        description="Configure risk management settings and parameters"
      />

      {activeCategory && (
        <Button
          variant="ghost"
          onClick={() => setActiveCategory(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>
      )}

      {renderActiveSection()}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {renderFormFields()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={() => handleAdd(getEndpoint(), genericForm)}>Save</Button>
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
            {renderFormFields()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedItem && handleEdit(getEndpoint(), (selectedItem as { id: string }).id, genericForm)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
            <Button variant="destructive" onClick={() => selectedItem && handleDelete(getEndpoint(), (selectedItem as { id: string }).id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
