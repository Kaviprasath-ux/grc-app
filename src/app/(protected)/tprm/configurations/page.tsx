"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, ChevronRight, Home,
  ClipboardList, FolderTree, Building2, BookOpen, FileQuestion,
  Award, UserCheck, ArrowLeft, Download, Upload, X, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";

// ==================== TYPES ====================

interface ProfileField {
  id: string;
  fieldName: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface OnboardingQuestion {
  id: string;
  title: string;
  question?: string | null;
  score: number;
  questionType: string;
  responseType: string;
  parentId?: string | null;
  children?: OnboardingQuestion[];
}

interface SimpleItem {
  id: string;
  name: string;
  isActive?: boolean;
}

interface QuestionnaireTemplate {
  id: string;
  templateName: string;
  frameworkName: string | null;
  templateCategory: string;
}

interface OffboardingQuestion {
  id: string;
  sequenceNo: number;
  title: string;
  question: string | null;
}

interface ScorecardFactor {
  id: string;
  factorId: string;
  name: string;
  weightage: number;
  isMandatory: boolean;
  scoreType: string;
  isSystem: boolean;
}

interface ScorecardConfig {
  scoringFormula: string;
  securityPostureWeight: number;
  threatExposureWeight: number;
}

// ==================== CONSTANTS ====================

const configCards = [
  {
    id: "vendor-onboarding",
    title: "Vendor Onboarding",
    description: "Manage vendor profile fields and onboarding questions",
    icon: UserCheck,
  },
  {
    id: "service-categories",
    title: "Service Category",
    description: "Manage service categories for vendor classification",
    icon: FolderTree,
  },
  {
    id: "disciplines",
    title: "Discipline",
    description: "Manage assessment disciplines",
    icon: BookOpen,
  },
  {
    id: "departments",
    title: "Department",
    description: "Manage TPRM departments",
    icon: Building2,
  },
  {
    id: "questionnaire-templates",
    title: "Questionnaire Management",
    description: "Manage assessment questionnaire templates",
    icon: ClipboardList,
  },
  {
    id: "offboarding-questions",
    title: "Vendor Offboarding",
    description: "Manage vendor offboarding questionnaire",
    icon: FileQuestion,
  },
  {
    id: "scorecard",
    title: "Scorecard Configuration",
    description: "Configure scoring formula and security factors",
    icon: Award,
  },
];

// VRR_REFERENCE is now fetched dynamically from Control Center config

// ==================== MAIN COMPONENT ====================

export default function ConfigurationsPage() {
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ==================== LANDING PAGE ====================
  if (!activeCard) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("Configurations")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("Configure TPRM module settings and parameters")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {configCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                className="group bg-white rounded-xl border border-slate-200 p-3 sm:p-5 text-left hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => setActiveCard(card.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-slate-800 group-hover:text-primary transition-colors">
                        {t(card.title)}
                      </h4>
                      <ChevronRight className={`h-4 w-4 text-slate-400 group-hover:text-primary transition-colors ${isRTL ? "rotate-180" : ""}`} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {t(card.description)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== SUB-PAGE ROUTING ====================
  const cardTitle = configCards.find((c) => c.id === activeCard)?.title || "";

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => setActiveCard(null)}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span>{t("Configurations")}</span>
        </button>
        <ChevronRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-foreground font-medium">{t(cardTitle)}</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveCard(null)}
          className="h-8 w-8"
        >
          <ArrowLeft className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
        </Button>
        <h1 className="text-xl font-bold">{t(cardTitle)}</h1>
      </div>

      {/* Render sub-page content */}
      {activeCard === "vendor-onboarding" && <VendorOnboardingSection />}
      {activeCard === "service-categories" && <SimpleCrudSection type="service-categories" nameLabel="Service Name" />}
      {activeCard === "disciplines" && <SimpleCrudSection type="disciplines" nameLabel="Discipline Name" />}
      {activeCard === "departments" && <SimpleCrudSection type="departments" nameLabel="Department Name" />}
      {activeCard === "questionnaire-templates" && <QuestionnaireManagementSection />}
      {activeCard === "offboarding-questions" && <OffboardingSection />}
      {activeCard === "scorecard" && <ScorecardSection />}
    </div>
  );
}

// ==================== VENDOR ONBOARDING (2 tabs) ====================

function VendorOnboardingSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile-fields");

  // Profile fields state
  const [profileFields, setProfileFields] = useState<ProfileField[]>([]);
  const [pfLoading, setPfLoading] = useState(true);
  const [pfDialogOpen, setPfDialogOpen] = useState(false);
  const [pfEditItem, setPfEditItem] = useState<ProfileField | null>(null);
  const [pfFieldName, setPfFieldName] = useState("");

  // Onboarding questions state
  const [obQuestions, setObQuestions] = useState<OnboardingQuestion[]>([]);
  const [obLoading, setObLoading] = useState(true);
  const [obDialogOpen, setObDialogOpen] = useState(false);
  const [obEditItem, setObEditItem] = useState<OnboardingQuestion | null>(null);
  const [obForm, setObForm] = useState({
    title: "",
    question: "",
    score: 0,
    questionType: "Parent",
    responseType: "Yes/No",
    parentId: "" as string,
  });

  // VRR config from Control Center (fetched dynamically)
  const [vrrReference, setVrrReference] = useState<{ category: string; score: number }[]>([]);
  const [maxVrrScore, setMaxVrrScore] = useState(50); // default Critical VRR

  // Load VRR config from Control Center
  const loadVrrConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/tprm/control-center");
      if (res.ok) {
        const data = await res.json();
        if (data.dueDiligence) {
          const vrrData = data.dueDiligence.map((d: { category: string; vrr: number }) => ({
            category: d.category,
            score: d.vrr,
          }));
          // Sort from lowest to highest
          vrrData.sort((a: { score: number }, b: { score: number }) => a.score - b.score);
          setVrrReference(vrrData);
          // Max VRR is the Critical category value
          const critical = data.dueDiligence.find((d: { category: string }) => d.category === "Critical");
          if (critical) setMaxVrrScore(critical.vrr);
        }
      }
    } catch {
      // Use defaults on error
      setVrrReference([
        { category: "Nominal", score: 0 },
        { category: "Low", score: 20 },
        { category: "Moderate", score: 30 },
        { category: "High", score: 40 },
        { category: "Critical", score: 50 },
      ]);
    }
  }, []);

  // Load profile fields
  const loadProfileFields = useCallback(async () => {
    setPfLoading(true);
    try {
      const res = await fetch("/api/tprm/configurations/vendor-profile-fields");
      if (res.ok) setProfileFields(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load profile fields"), variant: "destructive" });
    } finally {
      setPfLoading(false);
    }
  }, [toast, t]);

  // Load onboarding questions
  const loadObQuestions = useCallback(async () => {
    setObLoading(true);
    try {
      const res = await fetch("/api/tprm/configurations/onboarding-questions");
      if (res.ok) setObQuestions(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load questions"), variant: "destructive" });
    } finally {
      setObLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadProfileFields();
    loadObQuestions();
    loadVrrConfig();
  }, [loadProfileFields, loadObQuestions, loadVrrConfig]);

  // Calculate total score of all questions (excluding the one being edited)
  const getTotalScore = (excludeId?: string) => {
    return obQuestions
      .filter((q) => q.id !== excludeId)
      .reduce((sum, q) => sum + (q.score || 0), 0);
  };

  // Profile field CRUD
  const handleSaveProfileField = async () => {
    if (!pfFieldName.trim()) return;
    try {
      const method = pfEditItem ? "PATCH" : "POST";
      const body = pfEditItem
        ? { id: pfEditItem.id, fieldName: pfFieldName.trim() }
        : { fieldName: pfFieldName.trim() };
      const res = await fetch("/api/tprm/configurations/vendor-profile-fields", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to save"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: pfEditItem ? t("Field updated") : t("Field created") });
      setPfDialogOpen(false);
      setPfEditItem(null);
      setPfFieldName("");
      loadProfileFields();
    } catch {
      toast({ title: t("Error"), description: t("Failed to save"), variant: "destructive" });
    }
  };

  const handleDeleteProfileField = async (id: string) => {
    try {
      const res = await fetch(`/api/tprm/configurations/vendor-profile-fields?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Field deleted") });
      loadProfileFields();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  // Onboarding question CRUD
  const handleSaveObQuestion = async () => {
    if (!obForm.title.trim()) return;

    // Validate total score does not exceed max VRR (Critical)
    const existingTotal = getTotalScore(obEditItem?.id);
    const newTotal = existingTotal + (obForm.score || 0);
    if (newTotal > maxVrrScore) {
      toast({
        title: t("Error"),
        description: `${t("Total score")} (${newTotal}) ${t("exceeds max VRR")} (${maxVrrScore})`,
        variant: "destructive",
      });
      return;
    }

    try {
      const method = obEditItem ? "PATCH" : "POST";
      const payload = {
        ...(obEditItem && { id: obEditItem.id }),
        title: obForm.title,
        question: obForm.question,
        score: obForm.score,
        questionType: obForm.questionType,
        responseType: obForm.responseType,
        parentId: obForm.questionType === "Child" && obForm.parentId ? obForm.parentId : null,
      };
      const res = await fetch("/api/tprm/configurations/onboarding-questions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to save"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: obEditItem ? t("Question updated") : t("Question created") });
      setObDialogOpen(false);
      setObEditItem(null);
      setObForm({ title: "", question: "", score: 0, questionType: "Parent", responseType: "Yes/No", parentId: "" });
      loadObQuestions();
    } catch {
      toast({ title: t("Error"), description: t("Failed to save"), variant: "destructive" });
    }
  };

  const handleDeleteObQuestion = async (id: string) => {
    try {
      const res = await fetch(`/api/tprm/configurations/onboarding-questions?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Question deleted") });
      loadObQuestions();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  // Get parent questions for the parent dropdown (exclude self if editing)
  const parentQuestions = obQuestions.filter(
    (q) => q.questionType === "Parent" && q.id !== obEditItem?.id
  );

  // Profile fields columns
  const pfColumns: ColumnDef<ProfileField>[] = [
    {
      accessorKey: "fieldName",
      header: t("Question Fields"),
      cell: ({ row }) => <span className="font-medium">{row.original.fieldName}</span>,
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => {
        const field = row.original;
        if (field.isSystem) return <span className="text-xs text-muted-foreground">{t("System")}</span>;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setPfEditItem(field);
                setPfFieldName(field.fieldName);
                setPfDialogOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => handleDeleteProfileField(field.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  // Onboarding questions columns
  const obColumns: ColumnDef<OnboardingQuestion>[] = [
    {
      accessorKey: "title",
      header: t("Question Title"),
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "questionType",
      header: t("Question Type"),
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.original.questionType === "Parent"
            ? "bg-blue-100 text-blue-800"
            : "bg-purple-100 text-purple-800"
        }`}>
          {row.original.questionType}
        </span>
      ),
    },
    {
      accessorKey: "score",
      header: t("Score"),
    },
    {
      accessorKey: "responseType",
      header: t("Response Type"),
      cell: ({ row }) => (
        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
          {row.original.responseType}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setObEditItem(row.original);
              setObForm({
                title: row.original.title,
                question: row.original.question || "",
                score: row.original.score,
                questionType: row.original.questionType,
                responseType: row.original.responseType,
                parentId: row.original.parentId || "",
              });
              setObDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => handleDeleteObQuestion(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // Compute total score for display
  const totalScore = obQuestions.reduce((sum, q) => sum + (q.score || 0), 0);

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile-fields">{t("Vendor Profile Fields")}</TabsTrigger>
          <TabsTrigger value="onboarding-questions">{t("Onboarding Questions")}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile Fields */}
        <TabsContent value="profile-fields" className="mt-4">
          <div className="flex items-center justify-end mb-4">
            <Button size="sm" onClick={() => { setPfEditItem(null); setPfFieldName(""); setPfDialogOpen(true); }}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
            </Button>
          </div>
          {pfLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <DataGrid columns={pfColumns} data={profileFields} />
          )}
        </TabsContent>

        {/* Tab 2: Onboarding Questions */}
        <TabsContent value="onboarding-questions" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {t("Total Score")}: <span className={`font-bold ${totalScore > maxVrrScore ? "text-destructive" : "text-foreground"}`}>{totalScore}</span> / {maxVrrScore}
            </div>
            <Button size="sm" onClick={() => {
              setObEditItem(null);
              setObForm({ title: "", question: "", score: 0, questionType: "Parent", responseType: "Yes/No", parentId: "" });
              setObDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
            </Button>
          </div>
          {obLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <DataGrid columns={obColumns} data={obQuestions} />
          )}

          {/* VRR Reference Table — fetched dynamically from Control Center */}
          {vrrReference.length > 0 && (
            <div className="mt-6 border rounded-lg p-4 bg-slate-50">
              <h3 className="text-sm font-semibold mb-3">{t("Vendor Risk Rating Reference")}</h3>
              <div className="grid grid-cols-5 gap-2">
                {vrrReference.map((item) => (
                  <div key={item.category} className="text-center p-2 bg-white rounded border">
                    <div className="text-xs text-muted-foreground">{t(item.category)}</div>
                    <div className="font-bold text-lg">{item.score}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Profile Field Dialog */}
      <Dialog open={pfDialogOpen} onOpenChange={setPfDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{pfEditItem ? t("Edit Field") : t("Add Field")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("Field Title")}</Label>
              <Input
                value={pfFieldName}
                onChange={(e) => setPfFieldName(e.target.value)}
                placeholder={t("Enter field name")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPfDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleSaveProfileField}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding Question Dialog */}
      <Dialog open={obDialogOpen} onOpenChange={setObDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{obEditItem ? t("Edit Question") : t("Add Question")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("Title")}</Label>
              <Input
                value={obForm.title}
                onChange={(e) => setObForm({ ...obForm, title: e.target.value })}
                placeholder={t("Enter question title")}
              />
            </div>
            <div>
              <Label>{t("Question")}</Label>
              <Textarea
                value={obForm.question}
                onChange={(e) => setObForm({ ...obForm, question: e.target.value })}
                placeholder={t("Enter question text")}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("Score")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={maxVrrScore}
                  value={obForm.score}
                  onChange={(e) => setObForm({ ...obForm, score: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("Max")}: {maxVrrScore}
                </p>
              </div>
              <div>
                <Label>{t("Question Type")}</Label>
                <Select
                  value={obForm.questionType}
                  onValueChange={(v) => setObForm({ ...obForm, questionType: v, parentId: v === "Parent" ? "" : obForm.parentId })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Parent">{t("Parent")}</SelectItem>
                    <SelectItem value="Child">{t("Child")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Parent question dropdown - only visible when Child is selected */}
            {obForm.questionType === "Child" && (
              <div>
                <Label>{t("Parent Question")}</Label>
                <Select
                  value={obForm.parentId}
                  onValueChange={(v) => setObForm({ ...obForm, parentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select parent question")} />
                  </SelectTrigger>
                  <SelectContent>
                    {parentQuestions.map((pq) => (
                      <SelectItem key={pq.id} value={pq.id}>
                        {pq.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t("Response Type")}</Label>
              <Select
                value={obForm.responseType}
                onValueChange={(v) => setObForm({ ...obForm, responseType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes/No">{t("Yes/No")}</SelectItem>
                  <SelectItem value="FreeText">{t("Free Text")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setObDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleSaveObQuestion}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== SIMPLE CRUD SECTION ====================
// Used for Service Categories, Disciplines, and Departments

function SimpleCrudSection({ type, nameLabel }: { type: string; nameLabel: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<SimpleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<SimpleItem | null>(null);
  const [name, setName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tprm/configurations/${type}`);
      if (res.ok) setItems(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load data"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [type, toast, t]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      const method = editItem ? "PATCH" : "POST";
      const body = editItem ? { id: editItem.id, name: name.trim() } : { name: name.trim() };
      const res = await fetch(`/api/tprm/configurations/${type}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to save"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: editItem ? t("Updated successfully") : t("Created successfully") });
      setDialogOpen(false);
      setEditItem(null);
      setName("");
      loadItems();
    } catch {
      toast({ title: t("Error"), description: t("Failed to save"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tprm/configurations/${type}?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Deleted successfully") });
      loadItems();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(t("Are you sure you want to delete all items?"))) return;
    try {
      const res = await fetch(`/api/tprm/configurations/${type}?deleteAll=true`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: t("Success"), description: t("All items deleted") });
        loadItems();
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete all"), variant: "destructive" });
    }
  };

  const filteredItems = searchTerm
    ? items.filter((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : items;

  const columns: ColumnDef<SimpleItem>[] = [
    {
      accessorKey: "name",
      header: t(nameLabel),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setEditItem(row.original);
              setName(row.original.name);
              setDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Search...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setEditItem(null); setName(""); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
          </Button>
          {type === "service-categories" && (
            <Button size="sm" variant="outline" onClick={handleDeleteAll}>
              <Trash2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Delete All")}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <DataGrid columns={columns} data={filteredItems} />
      )}

      <div className="mt-2 text-xs text-muted-foreground">
        {t("Total")}: {filteredItems.length} {t("items")}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editItem ? t("Edit") : t("Add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t(nameLabel)}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Enter name")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleSave}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== QUESTIONNAIRE MANAGEMENT ====================

function QuestionnaireManagementSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<QuestionnaireTemplate | null>(null);
  const [form, setForm] = useState({
    templateName: "",
    frameworkName: "",
    templateCategory: "Default",
  });

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/configurations/questionnaire-templates");
      if (res.ok) setTemplates(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load templates"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSave = async () => {
    if (!form.templateName.trim()) return;
    try {
      const method = editItem ? "PATCH" : "POST";
      const body = editItem ? { id: editItem.id, ...form } : form;
      const res = await fetch("/api/tprm/configurations/questionnaire-templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to save"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: editItem ? t("Template updated") : t("Template created") });
      setDialogOpen(false);
      setEditItem(null);
      setForm({ templateName: "", frameworkName: "", templateCategory: "Default" });
      loadTemplates();
    } catch {
      toast({ title: t("Error"), description: t("Failed to save"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tprm/configurations/questionnaire-templates?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Template deleted") });
      loadTemplates();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  const columns: ColumnDef<QuestionnaireTemplate>[] = [
    {
      accessorKey: "templateName",
      header: t("Assessment Template"),
      cell: ({ row }) => <span className="font-medium">{row.original.templateName}</span>,
    },
    {
      accessorKey: "frameworkName",
      header: t("Framework"),
      cell: ({ row }) => row.original.frameworkName || "-",
    },
    {
      accessorKey: "templateCategory",
      header: t("Category"),
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.original.templateCategory === "Default"
            ? "bg-blue-100 text-blue-800"
            : row.original.templateCategory === "ISMS"
            ? "bg-green-100 text-green-800"
            : "bg-purple-100 text-purple-800"
        }`}>
          {row.original.templateCategory}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setEditItem(row.original);
              setForm({
                templateName: row.original.templateName,
                frameworkName: row.original.frameworkName || "",
                templateCategory: row.original.templateCategory,
              });
              setDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => {
            setEditItem(null);
            setForm({ templateName: "", frameworkName: "", templateCategory: "Default" });
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <DataGrid columns={columns} data={templates} />
      )}

      {/* Add/Edit Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editItem ? t("Edit Template") : t("Add Template")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("Template Name")}</Label>
              <Input
                value={form.templateName}
                onChange={(e) => setForm({ ...form, templateName: e.target.value })}
                placeholder={t("Enter template name")}
              />
            </div>
            <div>
              <Label>{t("Framework")}</Label>
              <Input
                value={form.frameworkName}
                onChange={(e) => setForm({ ...form, frameworkName: e.target.value })}
                placeholder={t("Enter framework name")}
              />
            </div>
            <div>
              <Label>{t("Template Category")}</Label>
              <div className="flex items-center gap-4 mt-2">
                {["Default", "ISMS", "Compliance"].map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="templateCategory"
                      value={cat}
                      checked={form.templateCategory === cat}
                      onChange={() => setForm({ ...form, templateCategory: cat })}
                      className="accent-primary"
                    />
                    <span className="text-sm">{t(cat)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleSave}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== OFFBOARDING SECTION ====================

function OffboardingSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<OffboardingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<OffboardingQuestion | null>(null);
  const [form, setForm] = useState({ title: "", question: "" });

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/configurations/offboarding-questions");
      if (res.ok) setQuestions(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load questions"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      const method = editItem ? "PATCH" : "POST";
      const body = editItem ? { id: editItem.id, ...form } : form;
      const res = await fetch("/api/tprm/configurations/offboarding-questions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to save"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: editItem ? t("Question updated") : t("Question created") });
      setDialogOpen(false);
      setEditItem(null);
      setForm({ title: "", question: "" });
      loadQuestions();
    } catch {
      toast({ title: t("Error"), description: t("Failed to save"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tprm/configurations/offboarding-questions?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Question deleted") });
      loadQuestions();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  const columns: ColumnDef<OffboardingQuestion>[] = [
    {
      accessorKey: "sequenceNo",
      header: t("SQ.NO"),
      cell: ({ row }) => <span className="font-medium">{row.original.sequenceNo}</span>,
      size: 80,
    },
    {
      accessorKey: "title",
      header: t("Title"),
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "question",
      header: t("Question"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-2">
          {row.original.question || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setEditItem(row.original);
              setForm({
                title: row.original.title,
                question: row.original.question || "",
              });
              setDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => {
            setEditItem(null);
            setForm({ title: "", question: "" });
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <DataGrid columns={columns} data={questions} />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editItem ? t("Edit Question") : t("Add Question")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("Title")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("Enter title")}
              />
            </div>
            <div>
              <Label>{t("Question")}</Label>
              <Textarea
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder={t("Enter question")}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleSave}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== SCORECARD CONFIGURATION ====================

function ScorecardSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<ScorecardConfig>({
    scoringFormula: "AVG",
    securityPostureWeight: 50,
    threatExposureWeight: 50,
  });
  const [factors, setFactors] = useState<ScorecardFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFactor, setEditFactor] = useState<ScorecardFactor | null>(null);
  const [editForm, setEditForm] = useState({ name: "", weightage: 0, isMandatory: false });
  const [configSaving, setConfigSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, factorsRes] = await Promise.all([
        fetch("/api/tprm/configurations/scorecard-config"),
        fetch("/api/tprm/configurations/scorecard-factors"),
      ]);
      if (configRes.ok) setConfig(await configRes.json());
      if (factorsRes.ok) setFactors(await factorsRes.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load scorecard data"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveConfig = async (updates: Partial<ScorecardConfig>) => {
    setConfigSaving(true);
    try {
      const newConfig = { ...config, ...updates };
      const res = await fetch("/api/tprm/configurations/scorecard-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        setConfig(newConfig);
        toast({ title: t("Success"), description: t("Configuration saved") });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to save configuration"), variant: "destructive" });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleEditFactor = async () => {
    if (!editFactor) return;
    try {
      const res = await fetch("/api/tprm/configurations/scorecard-factors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editFactor.id,
          name: editForm.name,
          weightage: editForm.weightage,
          isMandatory: editForm.isMandatory,
        }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Factor updated") });
        setEditDialogOpen(false);
        setEditFactor(null);
        loadData();
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to update factor"), variant: "destructive" });
    }
  };

  const securityPostureFactors = factors.filter((f) => f.scoreType === "SecurityPosture");
  const threatExposureFactors = factors.filter((f) => f.scoreType === "ThreatExposure");

  const factorColumns: ColumnDef<ScorecardFactor>[] = [
    {
      id: "index",
      header: t("ID"),
      cell: ({ row }) => <span className="font-medium">{row.index + 1}</span>,
      size: 60,
    },
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "weightage",
      header: t("Weightage"),
      cell: ({ row }) => <span>{row.original.weightage}%</span>,
      size: 100,
    },
    {
      accessorKey: "isMandatory",
      header: t("Mandatory"),
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.original.isMandatory ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
        }`}>
          {row.original.isMandatory ? t("Yes") : t("No")}
        </span>
      ),
      size: 100,
    },
    {
      id: "actions",
      header: t("Edit"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            setEditFactor(row.original);
            setEditForm({
              name: row.original.name,
              weightage: row.original.weightage,
              isMandatory: row.original.isMandatory,
            });
            setEditDialogOpen(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
      size: 60,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scoring Formula Section */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-4">{t("Scoring Formula")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>{t("Formula")}</Label>
            <Select
              value={config.scoringFormula}
              onValueChange={(v) => saveConfig({ scoringFormula: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVG">{t("AVG (Average)")}</SelectItem>
                <SelectItem value="SUM">{t("SUM (Summation)")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("Security Posture Score")} (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={config.securityPostureWeight}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                saveConfig({ securityPostureWeight: val, threatExposureWeight: 100 - val });
              }}
            />
          </div>
          <div>
            <Label>{t("Threat Exposure Score")} (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={config.threatExposureWeight}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                saveConfig({ threatExposureWeight: val, securityPostureWeight: 100 - val });
              }}
            />
          </div>
        </div>
      </div>

      {/* Security Posture Score Matrix */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-4">{t("Security Posture Score Matrix")}</h3>
        <DataGrid columns={factorColumns} data={securityPostureFactors} />
      </div>

      {/* Threat Exposure Score Matrix */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-4">{t("Threat Exposure Score Matrix")}</h3>
        <DataGrid columns={factorColumns} data={threatExposureFactors} />
      </div>

      {/* Edit Factor Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("Edit Factor")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("Name")}</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("Weightage")} (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editForm.weightage}
                onChange={(e) => setEditForm({ ...editForm, weightage: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.isMandatory}
                onCheckedChange={(v) => setEditForm({ ...editForm, isMandatory: v })}
              />
              <Label>{t("Mandatory")}</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleEditFactor}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
