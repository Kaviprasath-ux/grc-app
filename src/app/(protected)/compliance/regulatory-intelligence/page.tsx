"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2,
  ScrollText,
  Plus,
  ChevronDown,
  ChevronRight,
  MapPin,
  Mail,
  Globe,
  Clock,
  Languages,
  Briefcase,
  Users,
  Cpu,
  Building,
  FileText,
  Hash,
  Link as LinkIcon,
  Flag,
  Layers,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  Search,
  ArrowUpDown,
  Shield,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface SuggestedRegulation {
  id: string;
  name: string;
  type: string;
  applicability: "Mandatory" | "Recommended" | "Optional";
  reason: string;
  masterFrameworkId: string | null;
  isSubscribed: boolean;
  regulatoryProfileId: string;
  regulatoryProfile?: {
    id: string;
    fullLegalEntityName: string;
    country: string;
    industrySectors: string;
  };
}

interface RegulatoryProfile {
  id: string;
  fullLegalEntityName: string;
  registrationNo: string;
  url: string;
  country: string;
  industrySectors: string;
  otherIndustry: string | null;
  organisationType: string;
  countriesOfOperation: string;
  headquarterAddress: string;
  adminContactEmail: string;
  timeZone: string;
  language: string;
  businessModel: string;
  targetAudience: string;
  technologyUsed: string;
  createdAt: string;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function SectionCollapsible({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-md hover:bg-muted/50 transition-colors text-left">
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-9 pb-3 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FieldRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function BadgeList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="text-xs font-normal">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export default function RegulatoryIntelligenceHubPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<RegulatoryProfile[]>([]);
  const [regulations, setRegulations] = useState<SuggestedRegulation[]>([]);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Regulation list filters
  const [searchTerm, setSearchTerm] = useState("");
  const [applicabilityFilter, setApplicabilityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"name" | "applicability" | "type">("applicability");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [selectedRegulationId, setSelectedRegulationId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/regulatory-intelligence/profiles");
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data || []);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  }, []);

  const fetchRegulations = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/regulatory-intelligence/regulations");
      if (res.ok) {
        const json = await res.json();
        setRegulations(json.data || []);
      }
    } catch (error) {
      console.error("Error fetching regulations:", error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchRegulations()]).finally(() => {
      setLoading(false);
    });
  }, [fetchProfiles, fetchRegulations]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/compliance/regulatory-intelligence/profiles/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Profile deleted successfully") });
        fetchProfiles();
        fetchRegulations(); // Also refresh regulations
      } else {
        throw new Error("Delete failed");
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete profile"), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSuggestFrameworks = async (profileId: string) => {
    setSuggestingId(profileId);
    toast({
      title: t("Analyzing"),
      description: t("AI is analyzing your organisation profile for applicable regulations..."),
    });

    try {
      const res = await fetch("/api/compliance/regulatory-intelligence/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, targetLanguage: locale }),
      });

      if (res.ok) {
        const result = await res.json();
        toast({
          title: t("Regulations Suggested"),
          description: `${result.count} ${t("applicable regulations have been identified.")}`,
        });
        fetchRegulations();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to suggest regulations");
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: error instanceof Error ? error.message : t("Failed to suggest regulations"),
        variant: "destructive",
      });
    } finally {
      setSuggestingId(null);
    }
  };

  // Filtering and sorting logic for regulations
  const filteredRegulations = regulations.filter((reg) => {
    const matchesSearch = reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesApplicability = applicabilityFilter === "all" || reg.applicability === applicabilityFilter;
    return matchesSearch && matchesApplicability;
  });

  const sortedRegulations = [...filteredRegulations].sort((a, b) => {
    const applicabilityOrder = { Mandatory: 1, Recommended: 2, Optional: 3 };

    if (sortField === "applicability") {
      const orderA = applicabilityOrder[a.applicability] || 4;
      const orderB = applicabilityOrder[b.applicability] || 4;
      return sortDirection === "asc" ? orderA - orderB : orderB - orderA;
    }

    const valueA = a[sortField]?.toLowerCase() || "";
    const valueB = b[sortField]?.toLowerCase() || "";
    return sortDirection === "asc"
      ? valueA.localeCompare(valueB)
      : valueB.localeCompare(valueA);
  });

  const handleSort = (field: "name" | "applicability" | "type") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Group regulations by company (profile)
  const regulationsByCompany = sortedRegulations.reduce((acc, reg) => {
    const companyId = reg.regulatoryProfileId;
    const companyName = reg.regulatoryProfile?.fullLegalEntityName || t("Unknown Company");
    if (!acc[companyId]) {
      acc[companyId] = {
        companyId,
        companyName,
        regulations: [],
      };
    }
    acc[companyId].regulations.push(reg);
    return acc;
  }, {} as Record<string, { companyId: string; companyName: string; regulations: SuggestedRegulation[] }>);

  const companiesWithRegulations = Object.values(regulationsByCompany);

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  // Stats for regulation cards
  const mandatoryCount = regulations.filter(r => r.applicability === "Mandatory").length;
  const recommendedCount = regulations.filter(r => r.applicability === "Recommended").length;
  const optionalCount = regulations.filter(r => r.applicability === "Optional").length;

  // Get selected regulation details
  const selectedRegulation = selectedRegulationId
    ? regulations.find(r => r.id === selectedRegulationId)
    : null;

  // Handle onboard framework navigation
  const handleOnboardFramework = () => {
    if (!selectedRegulation) {
      toast({
        title: t("No Selection"),
        description: t("Please select a regulation to onboard as a framework"),
        variant: "destructive",
      });
      return;
    }

    // Get country and industry from the profile
    const profile = selectedRegulation.regulatoryProfile;
    const country = profile?.country || "";
    let industry = "";
    if (profile?.industrySectors) {
      try {
        const sectors = JSON.parse(profile.industrySectors);
        industry = Array.isArray(sectors) && sectors.length > 0 ? sectors[0] : "";
      } catch {
        industry = "";
      }
    }

    // Navigate to framework page with query params to open the create modal
    const params = new URLSearchParams({
      onboard: "true",
      name: selectedRegulation.name,
      type: selectedRegulation.type || "Regulation",
      description: selectedRegulation.reason || "",
      country: country,
      industry: industry,
    });

    router.push(`/compliance/framework?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("Regulatory Intelligence Hub")}</h1>
      </div>

      <Tabs defaultValue="organisation-profile" className="w-full">
        <TabsList>
          <TabsTrigger value="organisation-profile" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t("Organisation Profile")}
          </TabsTrigger>
          <TabsTrigger value="regulation-list" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            {t("Regulation List")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organisation-profile" className="mt-4">
          {/* Add Profile Button */}
          <div className="flex justify-end mb-4">
            <Button onClick={() => router.push("/compliance/regulatory-intelligence/add-profile")}>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Add Profile")}
            </Button>
          </div>

          {/* List View */}
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("Loading...")}
              </CardContent>
            </Card>
          ) : profiles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {t("No organisation profiles yet. Click 'Add Profile' to create one.")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => {
                const sectors = parseJsonArray(profile.industrySectors);
                const operationCountries = parseJsonArray(profile.countriesOfOperation);
                const audiences = parseJsonArray(profile.targetAudience);
                const technologies = parseJsonArray(profile.technologyUsed);

                return (
                  <Card key={profile.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building className="h-5 w-5 text-primary" />
                          {profile.fullLegalEntityName}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={suggestingId === profile.id}
                            onClick={() => handleSuggestFrameworks(profile.id)}
                          >
                            {suggestingId === profile.id ? (
                              <Loader2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                            )}
                            {suggestingId === profile.id ? t("Analyzing...") : t("Suggest Frameworks")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/compliance/regulatory-intelligence/edit-profile/${profile.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(profile.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1">
                      {/* Legal Identity Section */}
                      <SectionCollapsible title={t("Legal Identity")} icon={FileText} defaultOpen>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                          <FieldRow icon={Hash} label={t("Registration No")} value={profile.registrationNo} />
                          <FieldRow icon={LinkIcon} label={t("URL")} value={profile.url} />
                          <FieldRow icon={Flag} label={t("Country")} value={profile.country} />
                        </div>
                      </SectionCollapsible>

                      {/* Scope and Presence Section */}
                      <SectionCollapsible title={t("Scope and Presence")} icon={Globe}>
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs text-muted-foreground">{t("Industry/Sector")}</span>
                            <BadgeList items={sectors} />
                            {profile.otherIndustry && (
                              <p className="text-sm text-muted-foreground mt-1">{t("Other")}: {profile.otherIndustry}</p>
                            )}
                          </div>
                          <FieldRow icon={Building} label={t("Organisation Type")} value={profile.organisationType} />
                          <div>
                            <span className="text-xs text-muted-foreground">{t("Countries of Operation")}</span>
                            <BadgeList items={operationCountries} />
                          </div>
                        </div>
                      </SectionCollapsible>

                      {/* Physical Presence Section */}
                      <SectionCollapsible title={t("Physical Presence")} icon={MapPin}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                          <FieldRow icon={MapPin} label={t("Headquarter Address")} value={profile.headquarterAddress} />
                          <FieldRow icon={Mail} label={t("Email of Admin Contact")} value={profile.adminContactEmail} />
                        </div>
                      </SectionCollapsible>

                      {/* Regional Preference Section */}
                      <SectionCollapsible title={t("Regional Preference")} icon={Clock}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                          <FieldRow icon={Clock} label={t("Time Zone")} value={profile.timeZone} />
                          <FieldRow icon={Languages} label={t("Language")} value={profile.language} />
                        </div>
                      </SectionCollapsible>

                      {/* Business Context for AI Section */}
                      <SectionCollapsible title={t("Business Context for AI")} icon={Layers}>
                        <div className="space-y-3">
                          <FieldRow icon={Briefcase} label={t("Business Model")} value={profile.businessModel} />
                          <div>
                            <div className="flex items-start gap-3 py-1.5">
                              <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="text-xs text-muted-foreground">{t("Target Audience")}</span>
                                <BadgeList items={audiences} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-start gap-3 py-1.5">
                              <Cpu className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="text-xs text-muted-foreground">{t("Technology Used")}</span>
                                <BadgeList items={technologies} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </SectionCollapsible>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regulation-list" className="mt-4 space-y-4">
          {/* Stats Cards */}
          {regulations.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setApplicabilityFilter(applicabilityFilter === "Mandatory" ? "all" : "Mandatory")}
                className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-all ${
                  applicabilityFilter === "Mandatory"
                    ? "bg-red-50 border-red-200 ring-1 ring-red-200"
                    : "bg-white border-slate-200 hover:border-red-200 hover:bg-red-50/30"
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg ${applicabilityFilter === "Mandatory" ? "bg-red-100" : "bg-red-50"}`}>
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-slate-800">{mandatoryCount}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 truncate">{t("Mandatory")}</p>
                </div>
              </button>

              <button
                onClick={() => setApplicabilityFilter(applicabilityFilter === "Recommended" ? "all" : "Recommended")}
                className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-all ${
                  applicabilityFilter === "Recommended"
                    ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                    : "bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30"
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg ${applicabilityFilter === "Recommended" ? "bg-blue-100" : "bg-blue-50"}`}>
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-slate-800">{recommendedCount}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 truncate">{t("Recommended")}</p>
                </div>
              </button>

              <button
                onClick={() => setApplicabilityFilter(applicabilityFilter === "Optional" ? "all" : "Optional")}
                className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-all ${
                  applicabilityFilter === "Optional"
                    ? "bg-amber-50 border-amber-200 ring-1 ring-amber-200"
                    : "bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30"
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg ${applicabilityFilter === "Optional" ? "bg-amber-100" : "bg-amber-50"}`}>
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-slate-800">{optionalCount}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 truncate">{t("Optional")}</p>
                </div>
              </button>
            </div>
          )}

          {/* Main Content Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 border-b border-slate-100">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("Search regulations...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full ltr:pl-9 rtl:pr-9 py-2 text-sm bg-slate-50 border-slate-200 rounded-lg placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
              <Select value={applicabilityFilter} onValueChange={setApplicabilityFilter}>
                <SelectTrigger className="w-[150px] sm:w-[160px] bg-slate-50 border-slate-200 text-sm">
                  <SelectValue placeholder={t("Applicability")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All Applicability")}</SelectItem>
                  <SelectItem value="Mandatory">{t("Mandatory")}</SelectItem>
                  <SelectItem value="Recommended">{t("Recommended")}</SelectItem>
                  <SelectItem value="Optional">{t("Optional")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button
                onClick={handleOnboardFramework}
                disabled={!selectedRegulationId}
                size="sm"
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {t("Onboard Framework")}
              </Button>
            </div>

            {/* Companies List with Regulations */}
            {companiesWithRegulations.length === 0 ? (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="p-4 rounded-full bg-slate-100">
                    <ScrollText className="h-10 w-10 text-slate-400" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-slate-700">
                      {regulations.length === 0
                        ? t("No regulations yet")
                        : t("No matching regulations")}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {regulations.length === 0
                        ? t("Use 'Suggest Frameworks' on an organisation profile to generate AI-powered recommendations")
                        : t("Try adjusting your search or filter criteria")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {companiesWithRegulations.map(({ companyId, companyName, regulations: companyRegs }) => {
                  const isExpanded = expandedCompanies.has(companyId);
                  const companyMandatoryCount = companyRegs.filter(r => r.applicability === "Mandatory").length;
                  const companyRecommendedCount = companyRegs.filter(r => r.applicability === "Recommended").length;
                  const companyOptionalCount = companyRegs.filter(r => r.applicability === "Optional").length;

                  return (
                    <div key={companyId}>
                      {/* Company Header - Clickable */}
                      <button
                        onClick={() => toggleCompany(companyId)}
                        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-slate-50/80 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors ltr:rotate-0 rtl:rotate-180" />
                            )}
                          </div>
                          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                            <Building className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-slate-800 truncate">{companyName}</h3>
                            <p className="text-xs text-slate-500">{companyRegs.length} {t("regulations")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          {companyMandatoryCount > 0 && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                              {companyMandatoryCount}
                            </Badge>
                          )}
                          {companyRecommendedCount > 0 && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                              {companyRecommendedCount}
                            </Badge>
                          )}
                          {companyOptionalCount > 0 && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                              {companyOptionalCount}
                            </Badge>
                          )}
                        </div>
                      </button>

                      {/* Regulations Table - Collapsible */}
                      {isExpanded && (
                        <div className="bg-slate-50/50 border-t border-slate-100">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-b border-slate-200/60 bg-slate-100/50 hover:bg-slate-100/50">
                                  <TableHead className="w-[40px] text-xs font-medium text-slate-500 uppercase tracking-wider py-2.5 ps-4 sm:ps-6">
                                    {t("Select")}
                                  </TableHead>
                                  <TableHead className="w-[28%] text-xs font-medium text-slate-500 uppercase tracking-wider py-2.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSort("name"); }}
                                      className="flex items-center gap-1.5 hover:text-slate-700 transition-colors"
                                    >
                                      {t("Regulation Name")}
                                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                    </button>
                                  </TableHead>
                                  <TableHead className="w-[12%] text-xs font-medium text-slate-500 uppercase tracking-wider py-2.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSort("type"); }}
                                      className="flex items-center gap-1.5 hover:text-slate-700 transition-colors"
                                    >
                                      {t("Type")}
                                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                    </button>
                                  </TableHead>
                                  <TableHead className="w-[15%] text-xs font-medium text-slate-500 uppercase tracking-wider py-2.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSort("applicability"); }}
                                      className="flex items-center gap-1.5 hover:text-slate-700 transition-colors"
                                    >
                                      {t("Applicability")}
                                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                    </button>
                                  </TableHead>
                                  <TableHead className="w-[40%] text-xs font-medium text-slate-500 uppercase tracking-wider py-2.5 pe-6 sm:pe-8">
                                    {t("Justification")}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {companyRegs.map((reg, index) => (
                                  <TableRow
                                    key={reg.id}
                                    onClick={() => setSelectedRegulationId(selectedRegulationId === reg.id ? null : reg.id)}
                                    className={`cursor-pointer transition-colors ${
                                      selectedRegulationId === reg.id
                                        ? 'bg-primary/5 hover:bg-primary/10'
                                        : 'hover:bg-white/80'
                                    } ${index < companyRegs.length - 1 ? 'border-b border-slate-200/40' : ''}`}
                                  >
                                    <TableCell className="py-3 ps-4 sm:ps-6">
                                      <div
                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                          selectedRegulationId === reg.id
                                            ? 'border-primary bg-primary'
                                            : 'border-slate-300 bg-white'
                                        }`}
                                      >
                                        {selectedRegulationId === reg.id && (
                                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                      <span className="text-sm font-medium text-slate-800">{reg.name}</span>
                                    </TableCell>
                                    <TableCell className="py-3">
                                      <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 text-xs font-normal">
                                        {reg.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-3">
                                      <Badge
                                        className={`text-xs font-medium ${
                                          reg.applicability === "Mandatory"
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : reg.applicability === "Recommended"
                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                            : "bg-amber-50 text-amber-700 border-amber-200"
                                        }`}
                                        variant="outline"
                                      >
                                        {t(reg.applicability)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-3 pe-6 sm:pe-8">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <p className="text-sm text-slate-600 line-clamp-2 cursor-help leading-relaxed">
                                              {reg.reason}
                                            </p>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-md p-3 bg-slate-900 text-white border-0">
                                            <p className="text-sm leading-relaxed">{reg.reason}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Results Summary Footer */}
            {sortedRegulations.length > 0 && (
              <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  {t("Showing")} <span className="font-medium text-slate-700">{sortedRegulations.length}</span> {t("of")} <span className="font-medium text-slate-700">{regulations.length}</span> {t("regulations")} {t("across")} <span className="font-medium text-slate-700">{companiesWithRegulations.length}</span> {t("companies")}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Profile")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this organisation profile? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
