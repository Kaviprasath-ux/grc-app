"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, ChevronRight, Home, Eye, Link2,
  ClipboardList, FolderTree, Building2, BookOpen, FileQuestion,
  Award, UserCheck, ArrowLeft, Download, Upload, X, Search,
  ImageIcon, FileSpreadsheet, CheckSquare, Clock, Save, Loader2, Bot,
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
import { useTranslatedData, triggerTranslation, clearTranslationCache } from "@/hooks/useTranslatedData";
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
  imageUrl: string | null;
  vendorProfileQuestionIds: string | null;
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

interface MasterQuestionFull {
  id: string;
  questionText: string;
  verifaiPrompt: string | null;
  domainId: string | null;
  domain: { id: string; name: string } | null;
  isActive: boolean;
  isParentQuestion: boolean;
  parentId: string | null;
  mandatoryAttachment: boolean;
  validateThroughAI: boolean;
  mandatoryQuestion: boolean;
  evidence: string | null;
  issue: string | null;
  risk: string | null;
  recommendation: string | null;
  severity: string | null;
}

interface TemplateQuestion {
  id: string;
  questionId: string;
  sortOrder: number;
  question: MasterQuestionFull;
}

interface TemplateWithQuestions extends QuestionnaireTemplate {
  masterQuestionLinks: TemplateQuestion[];
}

interface DomainItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
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
      <div className="p-4 lg:p-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("TPRM")}</span>
          </div>
          <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
          <span className="text-primary-700 font-medium">{t("Configurations")}</span>
        </nav>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Configurations")}</h1>
          <p className="text-sm text-slate-500">
            {t("Configure TPRM module settings and parameters")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {configCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                className="group bg-white rounded-xl border border-slate-200 p-3 sm:p-5 ltr:text-left rtl:text-right hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer"
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
    <div className="p-4 lg:p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <button
          onClick={() => setActiveCard(null)}
          className="text-slate-500 hover:text-primary transition-colors"
        >
          {t("Configurations")}
        </button>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium">{t(cardTitle)}</span>
      </nav>

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

  const { data: translatedProfileFields } = useTranslatedData(profileFields.filter(f => !f.isSystem), { modelName: 'TPRMVendorProfileField' });
  const { data: translatedObQuestions } = useTranslatedData(obQuestions, { modelName: 'TPRMOnboardingQuestion' });

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
      const data = await res.json();
      triggerTranslation('TPRMVendorProfileField', data.id, { fieldName: data.fieldName });
      toast({ title: t("Success"), description: pfEditItem ? t("Field updated") : t("Field created") });
      setPfDialogOpen(false);
      setPfEditItem(null);
      setPfFieldName("");
      loadProfileFields();
      setTimeout(() => { clearTranslationCache(); loadProfileFields(); }, 4000);
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
      const data = await res.json();
      triggerTranslation('TPRMOnboardingQuestion', data.id, { title: data.title, question: data.question });
      toast({ title: t("Success"), description: obEditItem ? t("Question updated") : t("Question created") });
      setObDialogOpen(false);
      setObEditItem(null);
      setObForm({ title: "", question: "", score: 0, questionType: "Parent", responseType: "Yes/No", parentId: "" });
      loadObQuestions();
      setTimeout(() => { clearTranslationCache(); loadObQuestions(); }, 4000);
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
      cell: ({ row }) => <span className="font-medium">{row.original.isSystem ? t(row.original.fieldName) : row.original.fieldName}</span>,
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
          {t(row.original.questionType)}
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
          {row.original.responseType === "FreeText" ? t("Free Text") : t(row.original.responseType)}
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
        <TabsList className="ltr:justify-start rtl:justify-end">
          <TabsTrigger value="profile-fields">{t("Vendor Profile Fields")}</TabsTrigger>
          <TabsTrigger value="onboarding-questions">{t("Onboarding Questions")}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile Fields */}
        <TabsContent value="profile-fields" className="mt-4">
          <div className="flex items-center ltr:justify-end rtl:justify-start mb-4">
            <Button size="sm" onClick={() => { setPfEditItem(null); setPfFieldName(""); setPfDialogOpen(true); }}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
            </Button>
          </div>
          {pfLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <DataGrid columns={pfColumns} data={profileFields.map(f => f.isSystem ? f : (translatedProfileFields.find(tf => tf.id === f.id) || f))} />
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
            <DataGrid columns={obColumns} data={translatedObQuestions} />
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
            <div className="flex ltr:justify-end rtl:justify-start gap-2">
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
            <div className="flex ltr:justify-end rtl:justify-start gap-2">
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

const SIMPLE_CRUD_MODEL_MAP: Record<string, string> = {
  'service-categories': 'TPRMServiceCategory',
  'disciplines': 'TPRMDiscipline',
  'departments': 'TPRMDepartment',
};

function SimpleCrudSection({ type, nameLabel }: { type: string; nameLabel: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<SimpleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<SimpleItem | null>(null);
  const [name, setName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const modelName = SIMPLE_CRUD_MODEL_MAP[type] || type;
  const { data: translatedItems } = useTranslatedData(items, { modelName });

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
      const data = await res.json();
      triggerTranslation(modelName, data.id, { name: data.name });
      toast({ title: t("Success"), description: editItem ? t("Updated successfully") : t("Created successfully") });
      setDialogOpen(false);
      setEditItem(null);
      setName("");
      loadItems();
      setTimeout(() => { clearTranslationCache(); loadItems(); }, 4000);
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
    ? translatedItems.filter((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : translatedItems;

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
          <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Search...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ltr:pl-9 rtl:pr-9"
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
            <div className="flex ltr:justify-end rtl:justify-start gap-2">
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
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();

  // ---- Navigation ----
  const [subView, setSubView] = useState<"list" | "questions">("list");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // ---- Template list ----
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: translatedTemplates } = useTranslatedData(templates, { modelName: 'TPRMQuestionnaireTemplate' });

  // ---- Wizard ----
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardForm, setWizardForm] = useState({ templateName: "", frameworkName: "", templateCategory: "Default" });
  const [wizardImage, setWizardImage] = useState<File | null>(null);
  const [wizardImagePreview, setWizardImagePreview] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ totalRows: number; validRows: number; errors: { row: number; column: string; message: string }[] } | null>(null);
  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>([]);
  const [selectedProfileQuestionIds, setSelectedProfileQuestionIds] = useState<Set<string>>(new Set());
  const [wizardSaving, setWizardSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ---- Edit template dialog ----
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<QuestionnaireTemplate | null>(null);
  const [editForm, setEditForm] = useState({ templateName: "", frameworkName: "", templateCategory: "Default" });

  // ---- Cover Image ----
  const [coverImageTemplate, setCoverImageTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const handleCoverImageUpload = async (file: File, templateId: string) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: t("Error"), description: t("Please select an image file"), variant: "destructive" });
      return;
    }
    setUploadingCoverImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!upRes.ok) throw new Error("Upload failed");
      const upData = await upRes.json();
      const imageUrl = upData.file?.filePath || null;
      if (!imageUrl) throw new Error("No file path returned");

      const res = await fetch("/api/tprm/configurations/questionnaire-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId, imageUrl }),
      });
      if (!res.ok) throw new Error("Failed to update template");

      toast({ title: t("Success"), description: t("Cover image updated") });
      setCoverImageTemplate((prev) => prev ? { ...prev, imageUrl } : null);
      loadTemplates();
    } catch (err) {
      toast({ title: t("Error"), description: String(err), variant: "destructive" });
    } finally {
      setUploadingCoverImage(false);
      if (coverImageInputRef.current) coverImageInputRef.current.value = "";
    }
  };

  // ---- Enable AI Validation ----
  const [enablingAI, setEnablingAI] = useState<string | null>(null);
  const handleEnableAI = async (templateId: string) => {
    setEnablingAI(templateId);
    try {
      const res = await fetch("/api/tprm/master-data/questionnaires-enable-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: t("AI Validation Enabled"), description: `${data.updatedCount} ${t("questions updated")}` });
    } catch (err) {
      toast({ title: t("Error"), description: String(err), variant: "destructive" });
    } finally {
      setEnablingAI(null);
    }
  };

  // ---- Template questions (sub-view) ----
  const [templateData, setTemplateData] = useState<TemplateWithQuestions | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [allMasterQuestions, setAllMasterQuestions] = useState<MasterQuestionFull[]>([]);

  // ---- Question dialog ----
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editQuestionLink, setEditQuestionLink] = useState<TemplateQuestion | null>(null);
  const [qForm, setQForm] = useState({
    isParentQuestion: true, parentId: "", questionText: "", verifaiPrompt: "",
    domainId: "", mandatoryAttachment: false, validateThroughAI: false,
    mandatoryQuestion: false, evidence: "", issue: "", risk: "",
    recommendation: "", severity: "",
  });

  // ---- Link existing questions dialog ----
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());
  const [linkSearch, setLinkSearch] = useState("");

  // ========== Data Loading ==========

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

  const loadTemplateData = useCallback(async (tmplId: string) => {
    setQuestionsLoading(true);
    try {
      const res = await fetch("/api/tprm/master-data/questionnaires");
      if (res.ok) {
        const all: TemplateWithQuestions[] = await res.json();
        setTemplateData(all.find((x) => x.id === tmplId) || null);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load template questions"), variant: "destructive" });
    } finally {
      setQuestionsLoading(false);
    }
  }, [toast, t]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [domRes, qRes] = await Promise.all([
        fetch("/api/tprm/master-data/domains"),
        fetch("/api/tprm/master-data/questions"),
      ]);
      if (domRes.ok) setDomains(await domRes.json());
      if (qRes.ok) setAllMasterQuestions(await qRes.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    if (subView === "questions" && selectedTemplateId) {
      loadTemplateData(selectedTemplateId);
      loadReferenceData();
    }
  }, [subView, selectedTemplateId, loadTemplateData, loadReferenceData]);

  // ========== Template CRUD ==========

  // Load onboarding questions for Step 3
  const loadOnboardingQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/tprm/configurations/onboarding-questions");
      if (res.ok) setOnboardingQuestions(await res.json());
    } catch { /* silent */ }
  }, []);

  // Handle image file selection
  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: t("Error"), description: t("Please select an image file"), variant: "destructive" });
      return;
    }
    setWizardImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setWizardImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Handle import file selection with client-side preview (flexible column matching)
  const handleImportFileSelect = async (file: File) => {
    setImportFile(file);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setImportPreview({ totalRows: 0, validRows: 0, errors: [{ row: 0, column: "", message: "Empty file" }] }); return; }
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
      if (rows.length < 2) { setImportPreview({ totalRows: 0, validRows: 0, errors: [{ row: 0, column: "", message: "No data rows found" }] }); return; }
      const headers = (rows[0] as string[]).map((h) => String(h).trim().toLowerCase());
      // Check for a "question title" column (required)
      const questionAliases = ["question title", "question title *", "question", "question text", "title"];
      const hasQuestion = questionAliases.some((a) => headers.includes(a));
      const errs: { row: number; column: string; message: string }[] = [];
      if (!hasQuestion) errs.push({ row: 1, column: "", message: "Missing required column: Question Title (or similar)" });
      // Count non-empty data rows
      let dataRows = 0;
      for (let i = 1; i < rows.length; i++) {
        const isEmptyRow = (rows[i] as unknown[]).every((c) => c === undefined || c === null || String(c).trim() === "");
        if (!isEmptyRow) dataRows++;
      }
      setImportPreview({ totalRows: rows.length - 1, validRows: dataRows, errors: errs });
    } catch {
      setImportPreview({ totalRows: 0, validRows: 0, errors: [{ row: 0, column: "", message: "Failed to parse file" }] });
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    const { generateExcelTemplate } = await import("@/lib/excel-import");
    const columns = [
      "SQNO.", "Domain Name", "IsParent", "Question Title",
      "Evidence", "Mandatory Attachment", "Mandatory Question",
      "Control Question Description",
      "Issue", "Risk", "Recommendation", "Severity",
    ];
    const buffer = generateExcelTemplate(columns, "Questions Template");
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questionnaire-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset wizard state
  const resetWizard = () => {
    setWizardStep(1);
    setWizardForm({ templateName: "", frameworkName: "", templateCategory: "Default" });
    setWizardImage(null);
    setWizardImagePreview(null);
    setImportFile(null);
    setImportPreview(null);
    setSelectedProfileQuestionIds(new Set());
    setWizardSaving(false);
  };

  const handleWizardSave = async () => {
    if (!wizardForm.templateName.trim()) {
      toast({ title: t("Error"), description: t("Template name is required"), variant: "destructive" });
      return;
    }
    setWizardSaving(true);
    try {
      // Step 1: Upload image if selected
      let imageUrl: string | null = null;
      if (wizardImage) {
        const fd = new FormData();
        fd.append("file", wizardImage);
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (upRes.ok) {
          const upData = await upRes.json();
          imageUrl = upData.file?.filePath || null;
        }
      }

      // Step 2: Create template
      const profileIds = selectedProfileQuestionIds.size > 0
        ? JSON.stringify(Array.from(selectedProfileQuestionIds))
        : null;
      const res = await fetch("/api/tprm/configurations/questionnaire-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...wizardForm,
          imageUrl,
          vendorProfileQuestionIds: profileIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to create"), variant: "destructive" });
        setWizardSaving(false);
        return;
      }
      const created = await res.json();
      triggerTranslation('TPRMQuestionnaireTemplate', created.id, { templateName: created.templateName, frameworkName: created.frameworkName });
      setTimeout(() => { clearTranslationCache(); loadTemplates(); }, 4000);

      // Step 3: Import questions if file selected
      if (importFile) {
        const fd = new FormData();
        fd.append("file", importFile);
        fd.append("templateId", created.id);
        const impRes = await fetch("/api/tprm/master-data/questions-import", { method: "POST", body: fd });
        if (impRes.ok) {
          const impData = await impRes.json();
          toast({ title: t("Success"), description: `${t("Template created")}. ${impData.created} ${t("questions imported")}.` });
        } else {
          toast({ title: t("Success"), description: t("Template created but question import had errors") });
        }
      } else {
        toast({ title: t("Success"), description: t("Template created successfully") });
      }

      setWizardOpen(false);
      resetWizard();
      loadTemplates();
      setSelectedTemplateId(created.id);
      setSubView("questions");
    } catch {
      toast({ title: t("Error"), description: t("Failed to create template"), variant: "destructive" });
    } finally {
      setWizardSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editItem || !editForm.templateName.trim()) return;
    try {
      const res = await fetch("/api/tprm/configurations/questionnaire-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editItem.id, ...editForm }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to update"), variant: "destructive" });
        return;
      }
      const data = await res.json();
      triggerTranslation('TPRMQuestionnaireTemplate', data.id, { templateName: data.templateName, frameworkName: data.frameworkName });
      toast({ title: t("Success"), description: t("Template updated") });
      setEditDialogOpen(false);
      setEditItem(null);
      loadTemplates();
      setTimeout(() => { clearTranslationCache(); loadTemplates(); }, 4000);
    } catch {
      toast({ title: t("Error"), description: t("Failed to update"), variant: "destructive" });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm(t("Delete this template and all linked questions?"))) return;
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

  // ========== Question CRUD ==========

  const resetQForm = () => setQForm({
    isParentQuestion: true, parentId: "", questionText: "", verifaiPrompt: "",
    domainId: "", mandatoryAttachment: false, validateThroughAI: false,
    mandatoryQuestion: false, evidence: "", issue: "", risk: "",
    recommendation: "", severity: "",
  });

  const openAddQuestion = () => { setEditQuestionLink(null); resetQForm(); setQuestionDialogOpen(true); };

  const openEditQuestion = (link: TemplateQuestion) => {
    setEditQuestionLink(link);
    const q = link.question;
    setQForm({
      isParentQuestion: q.isParentQuestion, parentId: q.parentId || "",
      questionText: q.questionText, verifaiPrompt: q.verifaiPrompt || "",
      domainId: q.domainId || "", mandatoryAttachment: q.mandatoryAttachment,
      validateThroughAI: q.validateThroughAI, mandatoryQuestion: q.mandatoryQuestion,
      evidence: q.evidence || "", issue: q.issue || "", risk: q.risk || "",
      recommendation: q.recommendation || "", severity: q.severity || "",
    });
    setQuestionDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!qForm.questionText.trim()) {
      toast({ title: t("Error"), description: t("Question text is required"), variant: "destructive" });
      return;
    }
    const payload = {
      questionText: qForm.questionText.trim(),
      verifaiPrompt: qForm.verifaiPrompt.trim() || null,
      domainId: qForm.domainId || null,
      isParentQuestion: qForm.isParentQuestion,
      parentId: qForm.isParentQuestion ? null : (qForm.parentId || null),
      mandatoryAttachment: qForm.mandatoryAttachment,
      validateThroughAI: qForm.validateThroughAI,
      mandatoryQuestion: qForm.mandatoryQuestion,
      evidence: qForm.evidence.trim() || null,
      issue: qForm.issue.trim() || null,
      risk: qForm.risk.trim() || null,
      recommendation: qForm.recommendation.trim() || null,
      severity: qForm.severity || null,
    };
    try {
      if (editQuestionLink) {
        const res = await fetch("/api/tprm/master-data/questions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editQuestionLink.question.id, ...payload }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({ title: t("Error"), description: err.error || t("Failed to update"), variant: "destructive" });
          return;
        }
        const data = await res.json();
        triggerTranslation('TPRMMasterQuestion', data.id, { questionText: data.questionText, evidence: data.evidence || '', issue: data.issue || '', risk: data.risk || '', recommendation: data.recommendation || '' });
        toast({ title: t("Success"), description: t("Question updated") });
      } else {
        const createRes = await fetch("/api/tprm/master-data/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          toast({ title: t("Error"), description: err.error || t("Failed to create"), variant: "destructive" });
          return;
        }
        const newQ = await createRes.json();
        triggerTranslation('TPRMMasterQuestion', newQ.id, { questionText: newQ.questionText, evidence: newQ.evidence || '', issue: newQ.issue || '', risk: newQ.risk || '', recommendation: newQ.recommendation || '' });
        if (selectedTemplateId) {
          await fetch("/api/tprm/master-data/questionnaires", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateId: selectedTemplateId, questionIds: [newQ.id] }),
          });
        }
        toast({ title: t("Success"), description: t("Question added to template") });
      }
      setQuestionDialogOpen(false);
      if (selectedTemplateId) loadTemplateData(selectedTemplateId);
      loadReferenceData();
      setTimeout(() => { clearTranslationCache(); if (selectedTemplateId) loadTemplateData(selectedTemplateId); loadReferenceData(); }, 4000);
    } catch {
      toast({ title: t("Error"), description: t("Failed to save question"), variant: "destructive" });
    }
  };

  const handleUnlinkQuestion = async (linkId: string) => {
    if (!confirm(t("Remove this question from the template?"))) return;
    try {
      const res = await fetch(`/api/tprm/master-data/questionnaires?id=${linkId}`, { method: "DELETE" });
      if (!res.ok) {
        toast({ title: t("Error"), description: t("Failed to remove"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Question removed from template") });
      if (selectedTemplateId) loadTemplateData(selectedTemplateId);
    } catch {
      toast({ title: t("Error"), description: t("Failed to remove"), variant: "destructive" });
    }
  };

  const handleLinkQuestions = async () => {
    if (!selectedTemplateId || selectedLinkIds.size === 0) return;
    try {
      const res = await fetch("/api/tprm/master-data/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId, questionIds: Array.from(selectedLinkIds) }),
      });
      if (!res.ok) {
        toast({ title: t("Error"), description: t("Failed to link questions"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Questions linked successfully") });
      setLinkDialogOpen(false);
      loadTemplateData(selectedTemplateId);
    } catch {
      toast({ title: t("Error"), description: t("Failed to link questions"), variant: "destructive" });
    }
  };

  // ========== Helpers ==========

  const parentQuestions = (templateData?.masterQuestionLinks || [])
    .filter((l) => l.question.isParentQuestion && l.question.id !== editQuestionLink?.question.id)
    .map((l) => l.question);

  const getAvailableForLink = () => {
    if (!templateData) return [];
    const linked = new Set(templateData.masterQuestionLinks.map((l) => l.questionId));
    return allMasterQuestions
      .filter((q) => q.isActive && !linked.has(q.id))
      .filter((q) => !linkSearch || q.questionText.toLowerCase().includes(linkSearch.toLowerCase()));
  };

  const activeDomains = domains.filter((d) => d.isActive);

  // ========== Question Dialog (shared between views) ==========

  const renderQuestionDialog = () => (
    <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editQuestionLink ? t("Edit Question") : t("Add Question")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Is Parent Question */}
          <div>
            <Label>{t("Is Parent Question")}</Label>
            <div className="flex items-center gap-4 mt-1">
              {[true, false].map((val) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="isParent" checked={qForm.isParentQuestion === val}
                    onChange={() => setQForm({ ...qForm, isParentQuestion: val, parentId: val ? "" : qForm.parentId })}
                    className="accent-primary" />
                  <span className="text-sm">{val ? t("Yes") : t("No")}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Parent Question (when not parent) */}
          {!qForm.isParentQuestion && (
            <div>
              <Label>{t("Parent Question")}</Label>
              <Select value={qForm.parentId || "none"} onValueChange={(v) => setQForm({ ...qForm, parentId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("Select parent question")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("None")}</SelectItem>
                  {parentQuestions.map((pq) => (
                    <SelectItem key={pq.id} value={pq.id}>{pq.questionText.substring(0, 80)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Question Title */}
          <div>
            <Label>{t("Question Title")} *</Label>
            <Textarea value={qForm.questionText} onChange={(e) => setQForm({ ...qForm, questionText: e.target.value })}
              placeholder={t("Enter question text")} rows={3} />
          </div>
          {/* VerifAI Prompt */}
          <div>
            <Label>{t("VerifAI Prompt Question")}</Label>
            <Textarea value={qForm.verifaiPrompt} onChange={(e) => setQForm({ ...qForm, verifaiPrompt: e.target.value })}
              placeholder={t("Enter VerifAI prompt")} rows={2} />
          </div>
          {/* Domain */}
          <div>
            <Label>{t("Domain")}</Label>
            <Select value={qForm.domainId || "none"} onValueChange={(v) => setQForm({ ...qForm, domainId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder={t("Select domain")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("No Domain")}</SelectItem>
                {activeDomains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Template (disabled) */}
          <div>
            <Label>{t("Template")}</Label>
            <Input value={templates.find((x) => x.id === selectedTemplateId)?.templateName || ""} disabled className="bg-muted" />
          </div>
          {/* Boolean fields row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">{t("Mandatory Attachment")}</Label>
              <div className="flex items-center gap-3 mt-1">
                {[true, false].map((val) => (
                  <label key={String(val)} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="mandAtt" checked={qForm.mandatoryAttachment === val}
                      onChange={() => setQForm({ ...qForm, mandatoryAttachment: val })} className="accent-primary" />
                    <span className="text-xs">{val ? t("Yes") : t("No")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("Validate Through AI")}</Label>
              <div className="flex items-center gap-3 mt-1">
                {[true, false].map((val) => (
                  <label key={String(val)} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="valAI" checked={qForm.validateThroughAI === val}
                      onChange={() => setQForm({ ...qForm, validateThroughAI: val })} className="accent-primary" />
                    <span className="text-xs">{val ? t("Yes") : t("No")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("Mandatory Question")}</Label>
              <div className="flex items-center gap-3 mt-1">
                {[true, false].map((val) => (
                  <label key={String(val)} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="mandQ" checked={qForm.mandatoryQuestion === val}
                      onChange={() => setQForm({ ...qForm, mandatoryQuestion: val })} className="accent-primary" />
                    <span className="text-xs">{val ? t("Yes") : t("No")}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {/* Evidence, Issue, Risk, Recommendation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("Evidence")}</Label>
              <Input value={qForm.evidence} onChange={(e) => setQForm({ ...qForm, evidence: e.target.value })} placeholder={t("Enter evidence")} />
            </div>
            <div>
              <Label>{t("Issue")}</Label>
              <Input value={qForm.issue} onChange={(e) => setQForm({ ...qForm, issue: e.target.value })} placeholder={t("Enter issue")} />
            </div>
            <div>
              <Label>{t("Risk")}</Label>
              <Input value={qForm.risk} onChange={(e) => setQForm({ ...qForm, risk: e.target.value })} placeholder={t("Enter risk")} />
            </div>
            <div>
              <Label>{t("Recommendation")}</Label>
              <Input value={qForm.recommendation} onChange={(e) => setQForm({ ...qForm, recommendation: e.target.value })} placeholder={t("Enter recommendation")} />
            </div>
          </div>
          {/* Severity */}
          <div>
            <Label>{t("Severity")}</Label>
            <Select value={qForm.severity || "none"} onValueChange={(v) => setQForm({ ...qForm, severity: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder={t("Select severity")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("None")}</SelectItem>
                <SelectItem value="High">{t("High")}</SelectItem>
                <SelectItem value="Medium">{t("Medium")}</SelectItem>
                <SelectItem value="Low">{t("Low")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex ltr:justify-end rtl:justify-start gap-2">
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleSaveQuestion}>{t("Save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ========== Link Existing Questions Dialog ==========

  const renderLinkDialog = () => {
    const available = getAvailableForLink();
    return (
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("Link Existing Questions")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("Search questions...")} value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)} className="ltr:pl-9 rtl:pr-9" />
            </div>
            <div className="max-h-[40vh] overflow-y-auto space-y-2 border rounded-md p-2">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("No available questions")}</p>
              ) : available.map((q) => (
                <label key={q.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selectedLinkIds.has(q.id)}
                    onCheckedChange={() => {
                      setSelectedLinkIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                        return next;
                      });
                    }} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{q.questionText}</p>
                    {q.domain && <span className="text-xs text-muted-foreground">{q.domain.name}</span>}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{selectedLinkIds.size} {t("selected")}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>{t("Cancel")}</Button>
                <Button onClick={handleLinkQuestions} disabled={selectedLinkIds.size === 0}>
                  <Link2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Link Selected")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // ========== QUESTIONS SUB-VIEW ==========

  if (subView === "questions" && selectedTemplateId) {
    const tmpl = templates.find((x) => x.id === selectedTemplateId);
    const links = templateData?.masterQuestionLinks || [];

    const qColumns: ColumnDef<TemplateQuestion>[] = [
      {
        id: "domain",
        header: t("Domain"),
        cell: ({ row }) => (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            row.original.question.domain ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
          }`}>
            {row.original.question.domain?.name || t("Unassigned")}
          </span>
        ),
      },
      {
        id: "questionText",
        header: t("Questions"),
        cell: ({ row }) => (
          <span className="text-sm line-clamp-2 max-w-[300px]" title={row.original.question.questionText}>
            {row.original.question.questionText}
          </span>
        ),
      },
      {
        id: "verifaiPrompt",
        header: t("VerifAI Prompt Question"),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm line-clamp-2 max-w-[200px]">
            {row.original.question.verifaiPrompt || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("Action"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditQuestion(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleUnlinkQuestion(row.original.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ];

    return (
      <>
        {/* Sub-breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <button onClick={() => { setSubView("list"); setSelectedTemplateId(null); }} className="hover:text-primary transition-colors">
            {t("Questionnaire Management")}
          </button>
          <ChevronRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
          <span className="text-foreground font-medium">{tmpl?.templateName || ""}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => { setSubView("list"); setSelectedTemplateId(null); }}>
            <ArrowLeft className={`h-4 w-4 ltr:mr-1 rtl:ml-1 ${isRTL ? "rotate-180" : ""}`} /> {t("Back")}
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              disabled={!selectedTemplateId || enablingAI === selectedTemplateId}
              onClick={() => selectedTemplateId && handleEnableAI(selectedTemplateId)}>
              {enablingAI === selectedTemplateId ? <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" /> : <Bot className="h-4 w-4 ltr:mr-1 rtl:ml-1" />}
              {enablingAI === selectedTemplateId ? t("Enabling...") : t("Enable AI Validation")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setSelectedLinkIds(new Set()); setLinkSearch(""); setLinkDialogOpen(true);
            }}>
              <Link2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Link Existing")}
            </Button>
            <Button size="sm" onClick={openAddQuestion}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
            </Button>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Export")}
            </Button>
          </div>
        </div>

        {questionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t("No questions linked to this template")}</p>
            <p className="text-sm mt-1">{t("Click Add to create a new question or Link Existing to add from the master question bank")}</p>
          </div>
        ) : (
          <DataGrid columns={qColumns} data={links} />
        )}

        {renderQuestionDialog()}
        {renderLinkDialog()}
      </>
    );
  }

  // ========== TEMPLATE LIST VIEW ==========

  const templateColumns: ColumnDef<QuestionnaireTemplate>[] = [
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
          row.original.templateCategory === "Default" ? "bg-blue-100 text-blue-800"
            : row.original.templateCategory === "ISMS" ? "bg-green-100 text-green-800"
            : "bg-purple-100 text-purple-800"
        }`}>
          {t(row.original.templateCategory)}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title={t("View Questions")}
            onClick={() => { setSelectedTemplateId(row.original.id); setSubView("questions"); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title={t("Cover Image")}
            onClick={() => setCoverImageTemplate(row.original)}>
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => {
              setEditItem(row.original);
              setEditForm({
                templateName: row.original.templateName,
                frameworkName: row.original.frameworkName || "",
                templateCategory: row.original.templateCategory,
              });
              setEditDialogOpen(true);
            }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
            onClick={() => handleDeleteTemplate(row.original.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // Step labels for wizard
  const stepLabels = [t("Template Details"), t("Import Questions"), t("Vendor Profile Questions")];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button size="sm" onClick={() => {
          resetWizard();
          setWizardOpen(true);
        }}>
          <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Add")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <DataGrid columns={templateColumns} data={translatedTemplates} />
      )}

      {/* 3-Step Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={(v) => { if (!v) { setWizardOpen(false); resetWizard(); } }}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Add Questionnaire")}</DialogTitle>
          </DialogHeader>
          {/* Wizard step circles with connecting lines */}
          <div className="flex items-center justify-center mb-6 px-4">
            {[1, 2, 3].map((s, idx) => (
              <div key={s} className="flex items-center">
                {/* Step circle + label */}
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                    s < wizardStep
                      ? "bg-primary border-primary text-primary-foreground"
                      : s === wizardStep
                        ? "border-primary text-primary bg-primary/10"
                        : "border-muted-foreground/30 text-muted-foreground bg-muted/30"
                  }`}>
                    {s < wizardStep ? "✓" : s}
                  </div>
                  <p className={`text-[11px] mt-1.5 whitespace-nowrap ${
                    s <= wizardStep ? "text-primary font-medium" : "text-muted-foreground"
                  }`}>
                    {stepLabels[s - 1]}
                  </p>
                </div>
                {/* Connecting line (not after last step) */}
                {idx < 2 && (
                  <div className={`w-20 h-0.5 mx-2 mb-5 transition-colors ${
                    s < wizardStep ? "bg-primary" : "bg-muted-foreground/20"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* ===== STEP 1: Template Details + Image Upload ===== */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label>{t("Template Name")} *</Label>
                <Input value={wizardForm.templateName}
                  onChange={(e) => setWizardForm({ ...wizardForm, templateName: e.target.value })}
                  placeholder={t("Enter template name")} />
              </div>
              <div>
                <Label>{t("Framework")}</Label>
                <Input value={wizardForm.frameworkName}
                  onChange={(e) => setWizardForm({ ...wizardForm, frameworkName: e.target.value })}
                  placeholder={t("Enter framework name")} />
              </div>
              <div>
                <Label>{t("Template Category")}</Label>
                <div className="flex items-center gap-4 mt-2">
                  {["Default", "ISMS", "Compliance"].map((cat) => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="wizardCategory" value={cat}
                        checked={wizardForm.templateCategory === cat}
                        onChange={() => setWizardForm({ ...wizardForm, templateCategory: cat })}
                        className="accent-primary" />
                      <span className="text-sm">{t(cat)}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Image Upload */}
              <div>
                <Label>{t("Cover Image")}</Label>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]); }} />
                {wizardImagePreview ? (
                  <div className="mt-2 relative inline-block">
                    <img src={wizardImagePreview} alt="Preview" className="h-32 w-auto rounded-lg border object-cover" />
                    <button onClick={() => { setWizardImage(null); setWizardImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                      className="absolute -top-2 ltr:-right-2 rtl:-left-2 bg-destructive text-white rounded-full p-0.5 hover:bg-destructive/80">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => imageInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) handleImageSelect(e.dataTransfer.files[0]); }}>
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t("Click or drag to upload cover image")}</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, WebP</p>
                  </div>
                )}
              </div>
              <div className="flex ltr:justify-end rtl:justify-start">
                <Button onClick={() => {
                  if (!wizardForm.templateName.trim()) {
                    toast({ title: t("Error"), description: t("Template name is required"), variant: "destructive" });
                    return;
                  }
                  setWizardStep(2);
                }}>
                  {t("Next")}
                </Button>
              </div>
            </div>
          )}

          {/* ===== STEP 2: Import Questions ===== */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("Download the Excel template, fill in your questions, then import the file. You can skip this step and add questions manually later.")}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {/* Left: Download Template */}
                <div className="border rounded-lg p-4 text-center space-y-3">
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-green-600" />
                  <p className="text-sm font-medium">{t("Download Template")}</p>
                  <p className="text-xs text-muted-foreground">{t("Excel template with 13 required columns")}</p>
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Download")}
                  </Button>
                </div>
                {/* Right: Import File */}
                <div className="border rounded-lg p-4 text-center space-y-3">
                  <Upload className="h-8 w-8 mx-auto text-blue-600" />
                  <p className="text-sm font-medium">{t("Import Questions")}</p>
                  <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleImportFileSelect(e.target.files[0]); }} />
                  {importFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        <span className="truncate max-w-[120px]">{importFile.name}</span>
                        <button onClick={() => { setImportFile(null); setImportPreview(null); if (importInputRef.current) importInputRef.current.value = ""; }}
                          className="text-destructive hover:text-destructive/80">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {importPreview && (
                        <div className="text-xs space-y-1">
                          <p className="text-muted-foreground">{t("Total rows")}: {importPreview.totalRows} | {t("Valid")}: {importPreview.validRows}</p>
                          {importPreview.errors.length > 0 && (
                            <div className="bg-destructive/10 rounded p-2 max-h-24 overflow-y-auto ltr:text-left rtl:text-right">
                              {importPreview.errors.slice(0, 5).map((err, i) => (
                                <p key={i} className="text-destructive text-[10px]">
                                  {err.row > 0 ? `${t("Row")} ${err.row}: ` : ""}{err.message}
                                </p>
                              ))}
                              {importPreview.errors.length > 5 && (
                                <p className="text-destructive text-[10px]">+{importPreview.errors.length - 5} {t("more errors")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
                      <Upload className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Select File")}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(1)}>{t("Previous")}</Button>
                <Button onClick={() => { loadOnboardingQuestions(); setWizardStep(3); }}>{t("Next")}</Button>
              </div>
            </div>
          )}

          {/* ===== STEP 3: Vendor Profile Questions ===== */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("Select onboarding questions to include in the vendor profile for this template. This step is optional.")}
              </p>
              {onboardingQuestions.length === 0 ? (
                <div className="border rounded-lg p-6 text-center text-muted-foreground">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t("No onboarding questions configured")}</p>
                  <p className="text-xs mt-1">{t("Add questions in Vendor Onboarding configuration first")}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{selectedProfileQuestionIds.size} {t("selected")}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        const allIds = new Set<string>();
                        onboardingQuestions.forEach((q) => {
                          allIds.add(q.id);
                          q.children?.forEach((c) => allIds.add(c.id));
                        });
                        setSelectedProfileQuestionIds(allIds);
                      }}>{t("Select All")}</Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedProfileQuestionIds(new Set())}>
                        {t("Deselect All")}
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg max-h-[40vh] overflow-y-auto divide-y">
                    {onboardingQuestions.filter((q) => !q.parentId).map((parent) => (
                      <div key={parent.id}>
                        <label className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                          <Checkbox checked={selectedProfileQuestionIds.has(parent.id)}
                            onCheckedChange={() => {
                              setSelectedProfileQuestionIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(parent.id)) next.delete(parent.id); else next.add(parent.id);
                                return next;
                              });
                            }} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{parent.title}</p>
                            {parent.question && <p className="text-xs text-muted-foreground mt-0.5">{parent.question}</p>}
                          </div>
                        </label>
                        {/* Children */}
                        {parent.children?.map((child) => (
                          <label key={child.id} className="flex items-start gap-3 p-3 ltr:pl-10 rtl:pr-10 hover:bg-muted/50 cursor-pointer border-t border-dashed">
                            <Checkbox checked={selectedProfileQuestionIds.has(child.id)}
                              onCheckedChange={() => {
                                setSelectedProfileQuestionIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(child.id)) next.delete(child.id); else next.add(child.id);
                                  return next;
                                });
                              }} className="mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{child.title}</p>
                              {child.question && <p className="text-xs text-muted-foreground mt-0.5">{child.question}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(2)}>{t("Previous")}</Button>
                <Button onClick={handleWizardSave} disabled={wizardSaving}>
                  {wizardSaving ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" /> {t("Creating...")}</>
                  ) : t("Create")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("Edit Template")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("Template Name")}</Label>
              <Input value={editForm.templateName}
                onChange={(e) => setEditForm({ ...editForm, templateName: e.target.value })} />
            </div>
            <div>
              <Label>{t("Framework")}</Label>
              <Input value={editForm.frameworkName}
                onChange={(e) => setEditForm({ ...editForm, frameworkName: e.target.value })} />
            </div>
            <div>
              <Label>{t("Template Category")}</Label>
              <div className="flex items-center gap-4 mt-2">
                {["Default", "ISMS", "Compliance"].map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="editCategory" value={cat}
                      checked={editForm.templateCategory === cat}
                      onChange={() => setEditForm({ ...editForm, templateCategory: cat })}
                      className="accent-primary" />
                    <span className="text-sm">{t(cat)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex ltr:justify-end rtl:justify-start gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleEditSave}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cover Image Dialog */}
      <Dialog open={!!coverImageTemplate} onOpenChange={() => setCoverImageTemplate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Cover Image")} — {coverImageTemplate?.templateName}</DialogTitle>
          </DialogHeader>
          <input ref={coverImageInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0] && coverImageTemplate) {
                handleCoverImageUpload(e.target.files[0], coverImageTemplate.id);
              }
            }} />
          {coverImageTemplate?.imageUrl ? (
            <div className="space-y-3">
              <img src={coverImageTemplate.imageUrl} alt="Cover" className="w-full rounded-lg border" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={uploadingCoverImage}
                  onClick={() => coverImageInputRef.current?.click()}>
                  {uploadingCoverImage ? <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" /> : <ImageIcon className="h-4 w-4 ltr:mr-1 rtl:ml-1" />}
                  {t("Change Image")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => coverImageInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0] && coverImageTemplate) handleCoverImageUpload(e.dataTransfer.files[0], coverImageTemplate.id); }}>
              {uploadingCoverImage ? (
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
              ) : (
                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">{t("Click or drag to upload cover image")}</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, WebP</p>
            </div>
          )}
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

  const { data: translatedQuestions } = useTranslatedData(questions, { modelName: 'TPRMOffboardingQuestion' });

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
      const data = await res.json();
      triggerTranslation('TPRMOffboardingQuestion', data.id, { title: data.title, question: data.question });
      toast({ title: t("Success"), description: editItem ? t("Question updated") : t("Question created") });
      setDialogOpen(false);
      setEditItem(null);
      setForm({ title: "", question: "" });
      loadQuestions();
      setTimeout(() => { clearTranslationCache(); loadQuestions(); }, 4000);
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
        <DataGrid columns={columns} data={translatedQuestions} />
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
            <div className="flex ltr:justify-end rtl:justify-start gap-2">
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
  const [validationResults, setValidationResults] = useState<{ errors: string[]; passed: boolean } | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const { data: translatedFactors } = useTranslatedData(factors, { modelName: 'TPRMScorecardFactor' });

  // Monitoring schedule state
  const [scheduleRecurrence, setScheduleRecurrence] = useState("none");
  const [scheduleCustomDays, setScheduleCustomDays] = useState<number>(7);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleNextRun, setScheduleNextRun] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, factorsRes, scheduleRes] = await Promise.all([
        fetch("/api/tprm/configurations/scorecard-config"),
        fetch("/api/tprm/configurations/scorecard-factors"),
        fetch("/api/tprm/monitoring/schedule"),
      ]);
      if (configRes.ok) setConfig(await configRes.json());
      if (factorsRes.ok) setFactors(await factorsRes.json());
      if (scheduleRes.ok) {
        const sched = await scheduleRes.json();
        setScheduleRecurrence(sched.data?.recurrence || "none");
        if (sched.data?.customDays) setScheduleCustomDays(sched.data.customDays);
        setScheduleNextRun(sched.data?.nextScheduledRun || null);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load scorecard data"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSchedule = async () => {
    setScheduleSaving(true);
    try {
      const res = await fetch("/api/tprm/monitoring/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrence: scheduleRecurrence, customDays: scheduleRecurrence === "custom" ? scheduleCustomDays : null }),
      });
      if (res.ok) {
        const json = await res.json();
        setScheduleNextRun(json.data?.nextScheduledRun || null);
        toast({ title: t("Saved"), description: t("Monitoring schedule updated") });
      } else {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to save schedule"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Network error"), variant: "destructive" });
    } finally {
      setScheduleSaving(false);
    }
  };

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

    // Validate mandatory weightage total won't exceed 100%
    if (editForm.isMandatory) {
      const sameCategoryFactors = factors.filter(
        (f) => f.scoreType === editFactor.scoreType && f.id !== editFactor.id && f.isMandatory
      );
      const totalOthers = sameCategoryFactors.reduce((sum, f) => sum + f.weightage, 0);
      if (totalOthers + editForm.weightage > 100) {
        toast({
          title: t("Error"),
          description: t("Total mandatory weightage cannot exceed 100%"),
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const res = await fetch("/api/tprm/configurations/scorecard-factors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editFactor.id,
          factorId: editFactor.factorId,
          scoreType: editFactor.scoreType,
          name: editForm.name,
          weightage: editForm.weightage,
          isMandatory: editForm.isMandatory,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        triggerTranslation('TPRMScorecardFactor', data.id, { name: data.name });
        toast({ title: t("Success"), description: t("Factor updated") });
        setEditDialogOpen(false);
        setEditFactor(null);
        loadData();
        setTimeout(() => { clearTranslationCache(); loadData(); }, 4000);
      } else {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to update factor"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to update factor"), variant: "destructive" });
    }
  };

  const securityPostureFactors = translatedFactors.filter((f) => f.scoreType === "SecurityPosture");
  const threatExposureFactors = translatedFactors.filter((f) => f.scoreType === "ThreatExposure");

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

  const handleValidate = () => {
    const errors: string[] = [];
    if (!config.scoringFormula) errors.push(t("Scoring formula is not set"));
    if ((config.securityPostureWeight ?? 0) + (config.threatExposureWeight ?? 0) !== 100)
      errors.push(t("Security Posture and Threat Exposure weights must sum to 100%"));
    const spMandatory = securityPostureFactors.filter(f => f.isMandatory);
    const teMandatory = threatExposureFactors.filter(f => f.isMandatory);
    const spTotal = spMandatory.reduce((s, f) => s + f.weightage, 0);
    const teTotal = teMandatory.reduce((s, f) => s + f.weightage, 0);
    if (spMandatory.length === 0) errors.push(t("No mandatory Security Posture factors configured"));
    else if (spTotal !== 100) errors.push(t("Security Posture mandatory weightage must equal 100%") + ` (${t("current")}: ${spTotal}%)`);
    if (teMandatory.length === 0) errors.push(t("No mandatory Threat Exposure factors configured"));
    else if (teTotal !== 100) errors.push(t("Threat Exposure mandatory weightage must equal 100%") + ` (${t("current")}: ${teTotal}%)`);
    setValidationResults({ errors, passed: errors.length === 0 });
  };

  return (
    <div className="space-y-6">
      {/* Header with Validate button */}
      <div className="flex items-center ltr:justify-end rtl:justify-start">
        <Button onClick={handleValidate} variant="outline">
          <CheckSquare className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Validate Configuration")}
        </Button>
      </div>

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

        {/* Monitoring Recurrence Schedule */}
        <div className="mt-5 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t("Monitoring Recurrence Schedule")}</h4>
            {scheduleRecurrence !== "none" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                {scheduleRecurrence === "custom" ? `${t("Every")} ${scheduleCustomDays} ${t("days")}` : t(scheduleRecurrence.charAt(0).toUpperCase() + scheduleRecurrence.slice(1))}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-xs">{t("Frequency")}</Label>
              <Select value={scheduleRecurrence} onValueChange={setScheduleRecurrence}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("None")}</SelectItem>
                  <SelectItem value="daily">{t("Daily")}</SelectItem>
                  <SelectItem value="weekly">{t("Weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("Monthly")}</SelectItem>
                  <SelectItem value="custom">{t("Custom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scheduleRecurrence === "custom" && (
              <div>
                <Label className="text-xs">{t("Every N days")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={scheduleCustomDays}
                  onChange={(e) => setScheduleCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Button onClick={saveSchedule} disabled={scheduleSaving} size="sm" className="mt-1">
                {scheduleSaving ? <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" /> : <Save className="h-4 w-4 ltr:mr-1 rtl:ml-1" />}
                {scheduleSaving ? t("Saving...") : t("Save Schedule")}
              </Button>
            </div>
            {scheduleNextRun && scheduleRecurrence !== "none" && (
              <div className="text-xs text-muted-foreground">
                {t("Next scan")}: {new Date(scheduleNextRun).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security Posture Score Matrix */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-4">{t("Security Posture Score Matrix")}</h3>
        <DataGrid columns={factorColumns} data={securityPostureFactors} hideSearch />
      </div>

      {/* Threat Exposure Score Matrix */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-4">{t("Threat Exposure Score Matrix")}</h3>
        <DataGrid columns={factorColumns} data={threatExposureFactors} hideSearch />
      </div>

      {/* Validation Results Dialog */}
      <Dialog open={validationResults !== null} onOpenChange={(open) => { if (!open) setValidationResults(null); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t("Configuration Validation")}</DialogTitle>
          </DialogHeader>
          {validationResults?.passed ? (
            <div className="flex flex-col items-center py-4 gap-2">
              <CheckSquare className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium text-green-700">{t("All validations passed. Configuration is ready to use.")}</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">{t("The following items need to be addressed")}:</p>
              <ul className="space-y-2">
                {validationResults?.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex ltr:justify-end rtl:justify-start">
            <Button variant="outline" onClick={() => setValidationResults(null)}>{t("Close")}</Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <div className="flex ltr:justify-end rtl:justify-start gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleEditFactor}>{t("Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
