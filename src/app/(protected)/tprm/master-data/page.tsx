"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Pencil, Trash2, ChevronRight, Home,
  HelpCircle, ClipboardList, Globe, Search, X,
  ChevronDown, ChevronUp, Link2, Unlink, Loader2,
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation, clearTranslationCache } from "@/hooks/useTranslatedData";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ==================== TYPES ====================

interface Domain {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface MasterQuestion {
  id: string;
  questionText: string;
  verifaiPrompt: string | null;
  domainId: string | null;
  domain: { id: string; name: string } | null;
  isActive: boolean;
  sortOrder: number;
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

interface QuestionnaireLink {
  id: string;
  questionId: string;
  sortOrder: number;
  question: MasterQuestion;
}

interface QuestionnaireWithLinks {
  id: string;
  templateName: string;
  frameworkName: string | null;
  templateCategory: string;
  isActive: boolean;
  masterQuestionLinks: QuestionnaireLink[];
}

// ==================== CONSTANTS ====================

const masterDataCards = [
  {
    id: "questions",
    title: "Questions",
    description: "Manage the master question bank for assessments",
    icon: HelpCircle,
  },
  {
    id: "questionnaires",
    title: "Questionnaires",
    description: "Link questions to questionnaire templates",
    icon: ClipboardList,
  },
  {
    id: "domains",
    title: "Domains",
    description: "Manage assessment domain categories",
    icon: Globe,
  },
];

// ==================== MAIN COMPONENT ====================

export default function MasterDataManagementPage() {
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // ==================== LANDING PAGE ====================
  if (!activeCard) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("TPRM")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Master Data")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Master Data Management")}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {masterDataCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                className="group bg-white rounded-xl border border-slate-200 p-3 sm:p-5 ltr:text-left rtl:text-right hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setActiveCard(card.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-slate-800 group-hover:text-primary transition-colors">{t(card.title)}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t(card.description)}</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-slate-400 group-hover:text-primary transition-colors flex-shrink-0 ${isRTL ? "rotate-180" : ""}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== SUB-PAGE ROUTING ====================
  const cardTitle = masterDataCards.find((c) => c.id === activeCard)?.title || "";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <button
          onClick={() => setActiveCard(null)}
          className="text-slate-500 hover:text-primary transition-colors"
        >
          {t("Master Data")}
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t(cardTitle)}</span>
      </nav>

      {/* Render sub-page content */}
      {activeCard === "domains" && <DomainsSection title={t(cardTitle)} />}
      {activeCard === "questions" && <QuestionsSection title={t(cardTitle)} />}
      {activeCard === "questionnaires" && <QuestionnairesSection title={t(cardTitle)} />}
    </div>
  );
}

// ==================== DOMAINS SECTION ====================

function DomainsSection({ title }: { title: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Domain | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formActive, setFormActive] = useState(true);

  const { data: translatedDomains } = useTranslatedData(domains, { modelName: 'TPRMDomain' });

  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/master-data/domains");
      if (res.ok) setDomains(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load domains"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadDomains(); }, [loadDomains]);

  const openCreate = () => {
    setEditItem(null);
    setFormName("");
    setFormDescription("");
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (item: Domain) => {
    // Always use original (untranslated) data for editing
    const original = domains.find(d => d.id === item.id) || item;
    setEditItem(original);
    setFormName(original.name);
    setFormDescription(original.description || "");
    setFormActive(original.isActive);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      const method = editItem ? "PATCH" : "POST";
      const body = editItem
        ? { id: editItem.id, name: formName.trim(), description: formDescription.trim() || null, isActive: formActive }
        : { name: formName.trim(), description: formDescription.trim() || null };
      const res = await fetch("/api/tprm/master-data/domains", {
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
      triggerTranslation('TPRMDomain', data.id, { name: data.name, description: data.description });
      toast({ title: t("Success"), description: editItem ? t("Domain updated") : t("Domain created") });
      setDialogOpen(false);
      loadDomains();
      // Delayed refetch to pick up async translations
      setTimeout(() => { clearTranslationCache(); loadDomains(); }, 4000);
    } catch {
      toast({ title: t("Error"), description: t("Failed to save"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("Are you sure you want to delete this domain?"))) return;
    try {
      const res = await fetch(`/api/tprm/master-data/domains?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Domain deleted") });
      loadDomains();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  const columns: ColumnDef<Domain>[] = [
    { accessorKey: "name", header: t("Name"), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "description", header: t("Description"), cell: ({ row }) => <span className="text-muted-foreground text-sm line-clamp-2">{row.original.description || "-"}</span> },
    {
      accessorKey: "isActive",
      header: t("Active"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? t("Active") : t("Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Add Domain")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataGrid columns={columns} data={translatedDomains} searchPlaceholder={t("Search domains...")} />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{editItem ? t("Edit Domain") : t("Add Domain")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Name")}</Label>
              <Input
                className="mt-1.5 w-full"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("Enter domain name")}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                className="mt-1.5 w-full"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("Enter description")}
                rows={3}
              />
            </div>
            {editItem && (
              <div className="flex items-center gap-2">
                <Switch checked={formActive} onCheckedChange={setFormActive} />
                <Label className="text-sm font-medium text-slate-700">{t("Active")}</Label>
              </div>
            )}
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{t("Cancel")}</Button>
            <Button size="sm" onClick={handleSave} disabled={!formName.trim()}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== QUESTIONS SECTION ====================

function QuestionsSection({ title }: { title: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<MasterQuestion[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MasterQuestion | null>(null);
  const [domainFilter, setDomainFilter] = useState("all");

  const { data: translatedQuestions } = useTranslatedData(questions, { modelName: 'TPRMMasterQuestion' });
  const { data: translatedQSDomains } = useTranslatedData(domains, { modelName: 'TPRMDomain' });

  // Rich form state (all UAT fields)
  const [qForm, setQForm] = useState({
    isParentQuestion: true, parentId: "", questionText: "", verifaiPrompt: "",
    domainId: "", isActive: true, mandatoryAttachment: false, validateThroughAI: false,
    mandatoryQuestion: false, evidence: "", issue: "", risk: "",
    recommendation: "", severity: "",
  });

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/master-data/questions");
      if (res.ok) setQuestions(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load questions"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const loadDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/tprm/master-data/domains");
      if (res.ok) setDomains(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadQuestions();
    loadDomains();
  }, [loadQuestions, loadDomains]);

  const resetForm = () => setQForm({
    isParentQuestion: true, parentId: "", questionText: "", verifaiPrompt: "",
    domainId: "", isActive: true, mandatoryAttachment: false, validateThroughAI: false,
    mandatoryQuestion: false, evidence: "", issue: "", risk: "",
    recommendation: "", severity: "",
  });

  const openCreate = () => {
    setEditItem(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (item: MasterQuestion) => {
    // Always use original (untranslated) data for editing
    const original = questions.find(q => q.id === item.id) || item;
    setEditItem(original);
    setQForm({
      isParentQuestion: original.isParentQuestion, parentId: original.parentId || "",
      questionText: original.questionText, verifaiPrompt: original.verifaiPrompt || "",
      domainId: original.domainId || "", isActive: original.isActive,
      mandatoryAttachment: original.mandatoryAttachment, validateThroughAI: original.validateThroughAI,
      mandatoryQuestion: original.mandatoryQuestion, evidence: original.evidence || "",
      issue: original.issue || "", risk: original.risk || "",
      recommendation: original.recommendation || "", severity: original.severity || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!qForm.questionText.trim()) return;
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
      const method = editItem ? "PATCH" : "POST";
      const body = editItem ? { id: editItem.id, ...payload, isActive: qForm.isActive } : payload;
      const res = await fetch("/api/tprm/master-data/questions", {
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
      triggerTranslation('TPRMMasterQuestion', data.id, { questionText: data.questionText, verifaiPrompt: data.verifaiPrompt || '', evidence: data.evidence || '', issue: data.issue || '', risk: data.risk || '', recommendation: data.recommendation || '' });
      toast({ title: t("Success"), description: editItem ? t("Question updated") : t("Question created") });
      setDialogOpen(false);
      loadQuestions();
      // Delayed refetch to pick up async translations
      setTimeout(() => { clearTranslationCache(); loadQuestions(); }, 4000);
    } catch {
      toast({ title: t("Error"), description: t("Failed to save"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("Are you sure you want to delete this question?"))) return;
    try {
      const res = await fetch(`/api/tprm/master-data/questions?id=${id}`, { method: "DELETE" });
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

  const activeDomains = translatedQSDomains.filter((d) => d.isActive);
  const tDomainName = useCallback((id: string | null) => {
    if (!id) return null;
    return translatedQSDomains.find((d) => d.id === id)?.name || null;
  }, [translatedQSDomains]);
  const parentQuestions = questions.filter((q) => q.isParentQuestion && q.id !== editItem?.id);

  const filteredByDomain = domainFilter === "all"
    ? translatedQuestions
    : translatedQuestions.filter((q) => q.domainId === domainFilter);

  const columns: ColumnDef<MasterQuestion>[] = [
    {
      accessorKey: "domain",
      header: t("Domain"),
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.original.domain ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
        }`}>
          {(row.original.domain ? tDomainName(row.original.domain.id) || row.original.domain.name : null) || t("Unassigned")}
        </span>
      ),
    },
    {
      accessorKey: "questionText",
      header: t("Questions"),
      cell: ({ row }) => (
        <span className="text-sm line-clamp-2 max-w-[300px]" title={row.original.questionText}>
          {row.original.questionText}
        </span>
      ),
    },
    {
      accessorKey: "evidence",
      header: t("Evidence"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm line-clamp-1 max-w-[150px]">
          {row.original.evidence || "-"}
        </span>
      ),
    },
    {
      accessorKey: "verifaiPrompt",
      header: t("VerifAI Prompt"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm line-clamp-2 max-w-[200px]" title={row.original.verifaiPrompt || ""}>
          {row.original.verifaiPrompt || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Add Question")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataGrid
          columns={columns}
          data={filteredByDomain}
          searchPlaceholder={t("Search questions...")}
          toolbarExtra={
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-[180px] h-9 border-slate-200 bg-white text-sm">
                <SelectValue placeholder={t("All Domains")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Domains")}</SelectItem>
                {activeDomains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}

      {/* Rich Add/Edit Question Dialog (matching UAT) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{editItem ? t("Edit Question") : t("Add Question")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            {/* Is Parent Question */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Is Parent Question")}</Label>
              <div className="flex items-center gap-4 mt-1">
                {[true, false].map((val) => (
                  <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mdIsParent" checked={qForm.isParentQuestion === val}
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
                <Label className="text-sm font-medium text-slate-700">{t("Parent Question")}</Label>
                <Select value={qForm.parentId || "none"} onValueChange={(v) => setQForm({ ...qForm, parentId: v === "none" ? "" : v })}>
                  <SelectTrigger className="mt-1.5 w-full bg-white"><SelectValue placeholder={t("Select parent question")} /></SelectTrigger>
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
              <Label className="text-sm font-medium text-slate-700">{t("Question Title")} *</Label>
              <Textarea className="mt-1.5 w-full" value={qForm.questionText} onChange={(e) => setQForm({ ...qForm, questionText: e.target.value })}
                placeholder={t("Enter question text")} rows={3} />
            </div>
            {/* VerifAI Prompt */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("VerifAI Prompt Question")}</Label>
              <Textarea className="mt-1.5 w-full" value={qForm.verifaiPrompt} onChange={(e) => setQForm({ ...qForm, verifaiPrompt: e.target.value })}
                placeholder={t("Enter VerifAI prompt")} rows={2} />
            </div>
            {/* Domain */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Domain")}</Label>
              <Select value={qForm.domainId || "none"} onValueChange={(v) => setQForm({ ...qForm, domainId: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1.5 w-full bg-white"><SelectValue placeholder={t("Select domain")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("No Domain")}</SelectItem>
                  {activeDomains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Boolean fields row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">{t("Mandatory Attachment")}</Label>
                <div className="flex items-center gap-3 mt-1">
                  {[true, false].map((val) => (
                    <label key={String(val)} className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="mdMandAtt" checked={qForm.mandatoryAttachment === val}
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
                      <input type="radio" name="mdValAI" checked={qForm.validateThroughAI === val}
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
                      <input type="radio" name="mdMandQ" checked={qForm.mandatoryQuestion === val}
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
                <Label className="text-sm font-medium text-slate-700">{t("Evidence")}</Label>
                <Input className="mt-1.5 w-full" value={qForm.evidence} onChange={(e) => setQForm({ ...qForm, evidence: e.target.value })} placeholder={t("Enter evidence")} />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Issue")}</Label>
                <Input className="mt-1.5 w-full" value={qForm.issue} onChange={(e) => setQForm({ ...qForm, issue: e.target.value })} placeholder={t("Enter issue")} />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Risk")}</Label>
                <Input className="mt-1.5 w-full" value={qForm.risk} onChange={(e) => setQForm({ ...qForm, risk: e.target.value })} placeholder={t("Enter risk")} />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Recommendation")}</Label>
                <Input className="mt-1.5 w-full" value={qForm.recommendation} onChange={(e) => setQForm({ ...qForm, recommendation: e.target.value })} placeholder={t("Enter recommendation")} />
              </div>
            </div>
            {/* Severity */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Severity")}</Label>
              <Select value={qForm.severity || "none"} onValueChange={(v) => setQForm({ ...qForm, severity: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1.5 w-full bg-white"><SelectValue placeholder={t("Select severity")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("None")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Medium">{t("Medium")}</SelectItem>
                  <SelectItem value="Low">{t("Low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Active toggle (edit only) */}
            {editItem && (
              <div className="flex items-center gap-2">
                <Switch checked={qForm.isActive} onCheckedChange={(v) => setQForm({ ...qForm, isActive: v })} />
                <Label className="text-sm font-medium text-slate-700">{t("Active")}</Label>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{t("Cancel")}</Button>
            <Button size="sm" onClick={handleSave} disabled={!qForm.questionText.trim()}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== QUESTIONNAIRES SECTION ====================

function QuestionnairesSection({ title }: { title: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<QuestionnaireWithLinks[]>([]);
  const [allQuestions, setAllQuestions] = useState<MasterQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: translatedTemplates } = useTranslatedData(templates, { modelName: 'TPRMQuestionnaireTemplate' });
  const { data: translatedAllQuestions } = useTranslatedData(allQuestions, { modelName: 'TPRMMasterQuestion' });

  // Build a lookup map for translated question text (used for nested link.question display)
  const tqMap = useMemo(() => {
    const m = new Map<string, MasterQuestion>();
    for (const q of translatedAllQuestions) m.set(q.id, q);
    return m;
  }, [translatedAllQuestions]);
  const tq = useCallback((id: string, field: keyof MasterQuestion) => {
    const translated = tqMap.get(id);
    return translated ? String(translated[field] || '') : '';
  }, [tqMap]);

  // Extract unique domains from allQuestions for translation
  const questionnaireDomains = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const q of allQuestions) {
      if (q.domain && !map.has(q.domain.id)) map.set(q.domain.id, q.domain);
    }
    return Array.from(map.values());
  }, [allQuestions]);
  const { data: translatedQDomains } = useTranslatedData(questionnaireDomains, { modelName: 'TPRMDomain' });
  const tQDomain = useCallback((id: string | null) => {
    if (!id) return null;
    return translatedQDomains.find((d) => d.id === id)?.name || null;
  }, [translatedQDomains]);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTemplateId, setLinkTemplateId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/master-data/questionnaires");
      if (res.ok) setTemplates(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load questionnaires"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const loadAllQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/tprm/master-data/questions");
      if (res.ok) setAllQuestions(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadAllQuestions();
  }, [loadTemplates, loadAllQuestions]);

  const openLinkDialog = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    const alreadyLinked = new Set(template?.masterQuestionLinks.map((l) => l.questionId) || []);
    setLinkTemplateId(templateId);
    setSelectedQuestionIds(new Set());
    setQuestionSearch("");
    // Only show questions NOT already linked
    setLinkDialogOpen(true);
  };

  const handleAddLinks = async () => {
    if (!linkTemplateId || selectedQuestionIds.size === 0) return;
    try {
      const res = await fetch("/api/tprm/master-data/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: linkTemplateId,
          questionIds: Array.from(selectedQuestionIds),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to link questions"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Questions linked successfully") });
      setLinkDialogOpen(false);
      loadTemplates();
    } catch {
      toast({ title: t("Error"), description: t("Failed to link questions"), variant: "destructive" });
    }
  };

  const handleUnlink = async (linkId: string) => {
    if (!confirm(t("Remove this question from the template?"))) return;
    try {
      const res = await fetch(`/api/tprm/master-data/questionnaires?id=${linkId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to unlink"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Question unlinked") });
      loadTemplates();
    } catch {
      toast({ title: t("Error"), description: t("Failed to unlink"), variant: "destructive" });
    }
  };

  const filtered = translatedTemplates.filter((t) =>
    t.templateName.toLowerCase().includes(search.toLowerCase()) ||
    (t.frameworkName || "").toLowerCase().includes(search.toLowerCase()) ||
    t.templateCategory.toLowerCase().includes(search.toLowerCase())
  );

  // Questions available to link (not already linked to this template)
  const getAvailableQuestions = () => {
    if (!linkTemplateId) return [];
    const template = templates.find((t) => t.id === linkTemplateId);
    const alreadyLinked = new Set(template?.masterQuestionLinks.map((l) => l.questionId) || []);
    return translatedAllQuestions
      .filter((q) => q.isActive && !alreadyLinked.has(q.id))
      .filter((q) =>
        questionSearch === "" ||
        q.questionText.toLowerCase().includes(questionSearch.toLowerCase()) ||
        (q.domain?.name || "").toLowerCase().includes(questionSearch.toLowerCase())
      );
  };

  const toggleQuestionSelection = (qId: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
        <div className="relative w-72">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Search templates...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ltr:pl-9 rtl:pr-9 h-9 border-slate-200"
          />
          {search && (
            <button className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{t("No questionnaire templates found")}</p>
          <p className="text-sm mt-1">{t("Create templates in the Configurations page first")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tmpl) => {
            const isExpanded = expandedId === tmpl.id;
            return (
              <div key={tmpl.id} className="border border-slate-200 rounded-xl bg-white">
                {/* Header */}
                <button
                  className="w-full flex items-center justify-between p-4 ltr:text-left rtl:text-right hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{tmpl.templateName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tmpl.frameworkName && (
                          <Badge variant="outline" className="text-xs">{tmpl.frameworkName}</Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">{t(tmpl.templateCategory)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {tmpl.masterQuestionLinks.length} {t("questions")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    <div className="flex items-center justify-between py-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("Linked Questions")} ({tmpl.masterQuestionLinks.length})
                      </p>
                      <Button size="sm" variant="outline" onClick={() => openLinkDialog(tmpl.id)}>
                        <Link2 className="h-3.5 w-3.5 ltr:mr-2 rtl:ml-2" /> {t("Add Questions")}
                      </Button>
                    </div>

                    {tmpl.masterQuestionLinks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t("No questions linked yet")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {tmpl.masterQuestionLinks.map((link, idx) => (
                          <div key={link.id} className="flex items-start justify-between gap-3 p-3 bg-muted/30 rounded-md">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground w-6">{idx + 1}.</span>
                                <span className="text-sm">{tq(link.question.id, 'questionText') || link.question.questionText}</span>
                              </div>
                              {link.question.domain && (
                                <Badge variant="outline" className="text-xs mt-1 ltr:ml-8 rtl:mr-8">
                                  {tQDomain(link.question.domain.id) || link.question.domain.name}
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-600 flex-shrink-0"
                              onClick={() => handleUnlink(link.id)}
                              title={t("Remove")}
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Link Questions Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Questions to Template")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search questions...")}
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                className="mt-1.5 w-full ltr:pl-9 rtl:pr-9"
              />
            </div>
            <div className="space-y-2 border rounded-md p-2">
              {getAvailableQuestions().length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("No available questions")}
                </p>
              ) : (
                getAvailableQuestions().map((q) => (
                  <label
                    key={q.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedQuestionIds.has(q.id)}
                      onCheckedChange={() => toggleQuestionSelection(q.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{q.questionText}</p>
                      {q.domain && (
                        <Badge variant="outline" className="text-xs mt-1">{tQDomain(q.domain.id) || q.domain.name}</Badge>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <p className="text-sm text-slate-500">{selectedQuestionIds.size} {t("selected")}</p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(false)}>{t("Cancel")}</Button>
              <Button size="sm" onClick={handleAddLinks} disabled={selectedQuestionIds.size === 0}>
                <Link2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Link Selected")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
