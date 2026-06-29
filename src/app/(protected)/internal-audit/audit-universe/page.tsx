"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  CalendarDays,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  Tag,
  ShieldAlert,
  ClipboardList,
  BarChart3,
  Workflow,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { FieldworkDetailModal } from "../fieldwork/FieldworkDetailModal";

interface ProcessItem {
  id: string;
  processCode: string | null;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
}

interface RiskItem {
  id: string;
  riskId: string;
  riskName: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  regulatoryRequirement: string | null;
}

interface AuditItem {
  id: string;
  auditId: string;
  engagementTitle: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  lastAuditDate: string | null;
  actualHours: number;
  plannedHours: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface CategoryData {
  id: string;
  name: string;
  processes: ProcessItem[];
  risks: RiskItem[];
  audits: AuditItem[];
}

interface AuditUniverseData {
  categories: CategoryData[];
  totalCategories: number;
  totalProcesses: number;
  totalRisks: number;
  totalAudits: number;
}

export default function AuditUniversePage() {
  const { t } = useLanguage();
  const [data, setData] = useState<AuditUniverseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);

  const allAuditIds = useMemo(() => {
    const ids = new Set<string>();
    data?.categories.forEach(cat => cat.audits.forEach(a => ids.add(a.id)));
    return ids;
  }, [data]);

  // Flatten nested data for translation hooks
  const flatCategories = useMemo(
    () => data?.categories.map(c => ({ id: c.id, name: c.name })) ?? [],
    [data]
  );
  const flatProcesses = useMemo(
    () => data?.categories.flatMap(c => c.processes) ?? [],
    [data]
  );
  const flatRisks = useMemo(
    () => data?.categories.flatMap(c => c.risks) ?? [],
    [data]
  );

  // Flatten unique departments across all entities
  const flatDepartments = useMemo(() => {
    const seen = new Set<string>();
    const depts: { id: string; name: string }[] = [];
    const add = (id: string | null, name: string | null) => {
      if (id && name && !seen.has(id)) { seen.add(id); depts.push({ id, name }); }
    };
    data?.categories.forEach(c => {
      c.processes.forEach(p => add(p.departmentId, p.departmentName));
      c.risks.forEach(r => add(r.departmentId, r.departmentName));
      c.audits.forEach(a => add(a.departmentId, a.departmentName));
    });
    return depts;
  }, [data]);

  const { data: translatedCategories } = useTranslatedData(flatCategories, { modelName: 'AuditCategory' });
  const { data: translatedProcesses } = useTranslatedData(flatProcesses, { modelName: 'InternalAuditProcess' });
  const { data: translatedRisks } = useTranslatedData(flatRisks, { modelName: 'InternalAuditRisk' });
  const { data: translatedDepartments } = useTranslatedData(flatDepartments, { modelName: 'Department' });

  const catNameMap = useMemo(
    () => new Map(translatedCategories.map(c => [c.id, c.name])),
    [translatedCategories]
  );
  const processMap = useMemo(
    () => new Map(translatedProcesses.map(p => [p.id, p])),
    [translatedProcesses]
  );
  const riskMap = useMemo(
    () => new Map(translatedRisks.map(r => [r.id, r])),
    [translatedRisks]
  );
  const deptNameMap = useMemo(
    () => new Map(translatedDepartments.map(d => [d.id, d.name])),
    [translatedDepartments]
  );

  useEffect(() => {
    fetchAuditUniverse();
  }, []);

  const fetchAuditUniverse = async () => {
    try {
      const response = await fetch("/api/internal-audit/audit-universe");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch audit universe:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (actualHours: number, plannedHours: number, status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'closed') {
      return actualHours > plannedHours
        ? { bg: "bg-red-50 border border-red-200", text: "text-red-700", sub: "text-red-600" }
        : { bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700", sub: "text-emerald-600" };
    }
    if (statusLower === 'in progress' || statusLower === 'inprogress' || statusLower === 'ongoing' || statusLower === 'active') {
      if (actualHours > plannedHours) return { bg: "bg-red-50 border border-red-200", text: "text-red-700", sub: "text-red-600" };
      if (actualHours > plannedHours * 0.8) return { bg: "bg-amber-50 border border-amber-200", text: "text-amber-700", sub: "text-amber-600" };
      return { bg: "bg-sky-50 border border-sky-200", text: "text-sky-700", sub: "text-sky-600" };
    }
    return { bg: "bg-slate-50 border border-slate-200", text: "text-slate-700", sub: "text-slate-500" };
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'closed') return <CheckCircle className="h-3 w-3" />;
    if (statusLower === 'in progress' || statusLower === 'inprogress' || statusLower === 'ongoing' || statusLower === 'active') return <PlayCircle className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleAuditClick = (auditId: string) => {
    setSelectedEngagementId(auditId);
    setDetailModalOpen(true);
  };


  function Breadcrumb() {
    return (
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
        <Link href="/internal-audit" className="hover:text-slate-700 flex items-center gap-1">
          <Home className="h-3.5 w-3.5" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-700 font-medium">{t("Audit Universe")}</span>
      </nav>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Breadcrumb />
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
          </div>
          <div className="h-96 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const categories = data?.categories || [];
  const isEmpty = categories.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Breadcrumb />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Audit Universe")}</h1>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t("Categories"), value: data?.totalCategories || 0, icon: <Tag className="h-5 w-5 text-primary-600" /> },
          { label: t("Processes"), value: data?.totalProcesses || 0, icon: <Workflow className="h-5 w-5 text-blue-600" /> },
          { label: t("Risks"), value: data?.totalRisks || 0, icon: <ShieldAlert className="h-5 w-5 text-amber-600" /> },
          { label: t("Total Audits"), value: allAuditIds.size, icon: <BarChart3 className="h-5 w-5 text-primary-600" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 px-3 sm:px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="text-xl font-bold text-slate-800">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Organisation Map */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">{t("Organization Map")}</h3>
          <div className="flex items-center flex-wrap gap-3">
            {[
              ["bg-slate-400", "Planned"],
              ["bg-sky-400", "In Progress"],
              ["bg-amber-400", "Near Budget"],
              ["bg-emerald-400", "Completed"],
              ["bg-red-400", "Over Budget"],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 ${color} rounded-full`} />
                <span className="text-xs text-slate-500">{t(label)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 sm:p-6 overflow-x-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Tag className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-base font-medium text-slate-600">{t("No audit categories yet")}</p>
              <p className="text-sm text-slate-400 mt-1">
                {t("Add categories in Audit Settings, then link processes and risks to them.")}
              </p>
            </div>
          ) : (
            <TooltipProvider>
              <div className="relative min-w-max">
                {/* Root node */}
                <div className="flex justify-center mb-6">
                  <div className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold shadow-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t("Audit Universe")}
                  </div>
                </div>
                <div className="flex justify-center mb-4">
                  <div className="w-0.5 h-6 bg-slate-200" />
                </div>

                {/* Category columns — content-sized wrapper so absolute line hits exact centers */}
                <div className="flex justify-center">
                <div className="relative flex gap-8 items-start">
                  {categories.length > 1 && (
                    <div className="absolute top-0 h-px bg-slate-200 pointer-events-none" style={{ left: 215, right: 215 }} />
                  )}
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex flex-col items-center">
                      <div className="w-0.5 h-4 bg-slate-200" />

                      {/* Category node */}
                      <div className="bg-primary-50 border border-primary-200 text-primary-700 px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 mb-5 min-w-[160px] justify-center">
                        <Tag className="h-3.5 w-3.5" />
                        {catNameMap.get(cat.id) ?? cat.name}
                      </div>

                      {/* Three sub-groups */}
                      <div className="relative flex gap-5 items-start">
                        <div className="absolute top-0 h-px bg-slate-200 pointer-events-none" style={{ left: 65, right: 65 }} />

                        {/* Processes */}
                        <div className="flex flex-col items-center min-w-[130px]">
                          <div className="w-0.5 h-4 bg-slate-200" />
                          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 mb-3">
                            <Workflow className="h-3 w-3" />
                            {t("Processes")}
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            {cat.processes.length === 0 ? (
                              <span className="text-xs text-slate-300 italic px-2">—</span>
                            ) : cat.processes.map(p => (
                              <div key={p.id} className="flex flex-col items-center">
                                <div className="w-0.5 h-3 bg-slate-200" />
                                <div className="rounded-xl px-4 py-2.5 min-w-[130px] text-center border border-blue-100 bg-blue-50/50">
                                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                    <Workflow className="h-3 w-3 text-blue-400" />
                                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">{processMap.get(p.id)?.name ?? p.name}</span>
                                  </div>
                                  {p.processCode && (
                                    <div className="text-xs text-blue-400 font-mono">{p.processCode}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Risks */}
                        <div className="flex flex-col items-center min-w-[130px]">
                          <div className="w-0.5 h-4 bg-slate-200" />
                          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 mb-3">
                            <ShieldAlert className="h-3 w-3" />
                            {t("Risks")}
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            {cat.risks.length === 0 ? (
                              <span className="text-xs text-slate-300 italic px-2">—</span>
                            ) : cat.risks.map(r => (
                              <div key={r.id} className="flex flex-col items-center">
                                <div className="w-0.5 h-3 bg-slate-200" />
                                <div className="rounded-xl px-4 py-2.5 min-w-[130px] text-center border border-amber-100 bg-amber-50/50">
                                  <div className="text-xs font-mono text-amber-500 mb-0.5">{r.riskId}</div>
                                  <div className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{riskMap.get(r.id)?.riskName ?? r.riskName}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Audits */}
                        <div className="flex flex-col items-center min-w-[130px]">
                          <div className="w-0.5 h-4 bg-slate-200" />
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 mb-3">
                            <ClipboardList className="h-3 w-3" />
                            {t("Audits")}
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            {cat.audits.length === 0 ? (
                              <span className="text-xs text-slate-300 italic px-2">—</span>
                            ) : cat.audits.map(audit => {
                              const style = getStatusStyle(audit.actualHours, audit.plannedHours, audit.status);
                              return (
                                <div key={audit.id} className="flex flex-col items-center">
                                  <div className="w-0.5 h-3 bg-slate-200" />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`${style.bg} rounded-xl px-4 py-2.5 min-w-[130px] text-center cursor-pointer transition-all hover:shadow-sm`}
                                        onClick={() => handleAuditClick(audit.id)}
                                      >
                                        <div className={`flex items-center justify-center gap-1.5 font-semibold text-xs mb-1.5 ${style.text}`}>
                                          {getStatusIcon(audit.status)}
                                          <span>{audit.auditId}</span>
                                        </div>
                                        <div className="text-xs space-y-0.5">
                                          <div className="flex justify-between gap-3">
                                            <span className={`${style.sub} opacity-75`}>{t("Actual")}</span>
                                            <span className={`${style.sub} opacity-75`}>{t("Planned")}</span>
                                          </div>
                                          <div className="flex justify-between gap-3">
                                            <span className={`font-medium ${style.text}`}>{audit.actualHours > 0 ? `${audit.actualHours}h` : "-"}</span>
                                            <span className={`font-medium ${style.text}`}>{audit.plannedHours > 0 ? `${audit.plannedHours}h` : "-"}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs p-3">
                                      <div className="space-y-2">
                                        <p className="font-semibold text-slate-800">{audit.engagementTitle}</p>
                                        <div className="text-xs space-y-1.5 text-slate-600">
                                          <div className="flex items-center gap-2"><CalendarDays className="h-3 w-3 text-slate-400" /><span>{t("Start")}: {formatDate(audit.startDate)}</span></div>
                                          <div className="flex items-center gap-2"><CalendarDays className="h-3 w-3 text-slate-400" /><span>{t("End")}: {formatDate(audit.endDate)}</span></div>
                                          <div className="flex items-center gap-2"><Clock className="h-3 w-3 text-slate-400" /><span>{t("Status")}: {audit.status}</span></div>
                                          {audit.actualHours > audit.plannedHours && (
                                            <div className="flex items-center gap-2 text-red-600">
                                              <AlertTriangle className="h-3 w-3" />
                                              <span>{t("Over budget by")} {audit.actualHours - audit.plannedHours}h</span>
                                            </div>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-400 italic pt-1 border-t border-slate-100">{t("Click to view details")}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Detail table grouped by category */}
      {!isEmpty && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary-500" />
            <h3 className="text-base font-semibold text-slate-800">{t("All auditable entities by category")}</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5 min-w-[180px]">{t("Process / System / Entity")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 min-w-[120px]">{t("Department")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 min-w-[160px]">{t("Description")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 min-w-[120px]">{t("Last Audit Date")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 min-w-[110px]">{t("Audit Frequency (Years)")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 min-w-[160px]">{t("Regulatory Requirement")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 min-w-[100px]">{t("Notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(cat => (
                  <React.Fragment key={cat.id}>
                    <TableRow className="bg-primary-50/60 hover:bg-primary-50/60 border-b border-primary-100">
                      <TableCell colSpan={7} className="py-2 pl-5">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-primary-500" />
                          <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">{catNameMap.get(cat.id) ?? cat.name}</span>
                          <span className="text-xs text-primary-500">
                            ({cat.processes.length} {t("process(es)")}, {cat.risks.length} {t("risk(s)")}, {cat.audits.length} {t("audit(s)")})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {cat.processes.map(p => (
                      <TableRow key={`p-${p.id}`} className="border-b border-slate-100">
                        <TableCell className="py-3 pl-8">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="text-sm font-medium text-slate-800">{processMap.get(p.id)?.name ?? p.name}</span>
                            {p.processCode && (
                              <span className="text-xs font-mono text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{p.processCode}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-600">{((p.departmentId ? deptNameMap.get(p.departmentId) : null) ?? p.departmentName) || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-500 max-w-[200px]">
                          <span className="line-clamp-2">{(processMap.get(p.id)?.description ?? p.description) || <span className="text-slate-300">—</span>}</span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                        <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                        <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                        <TableCell className="py-3 pr-5 text-sm text-slate-400">—</TableCell>
                      </TableRow>
                    ))}

                    {cat.risks.map(r => (
                      <TableRow key={`r-${r.id}`} className="border-b border-slate-100">
                        <TableCell className="py-3 pl-8">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span className="text-sm font-medium text-slate-800">{riskMap.get(r.id)?.riskName ?? r.riskName}</span>
                            <span className="text-xs font-mono text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{r.riskId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-600">{((r.departmentId ? deptNameMap.get(r.departmentId) : null) ?? r.departmentName) || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-500 max-w-[200px]">
                          <span className="line-clamp-2">{r.description || <span className="text-slate-300">—</span>}</span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                        <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                        <TableCell className="py-3 text-sm text-slate-500 max-w-[160px]">
                          <span className="line-clamp-2">{r.regulatoryRequirement || <span className="text-slate-300">—</span>}</span>
                        </TableCell>
                        <TableCell className="py-3 pr-5 text-sm text-slate-400">—</TableCell>
                      </TableRow>
                    ))}

                    {cat.audits.map(a => (
                      <TableRow
                        key={`a-${a.id}`}
                        className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                        onClick={() => handleAuditClick(a.id)}
                      >
                        <TableCell className="py-3 pl-8">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="text-sm font-medium text-slate-800">{a.engagementTitle}</span>
                            <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">{a.auditId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-600">{((a.departmentId ? deptNameMap.get(a.departmentId) : null) ?? a.departmentName) || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-500 max-w-[200px]">
                          <span className="line-clamp-2">{a.description || <span className="text-slate-300">—</span>}</span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-600">
                          {a.lastAuditDate ? formatDate(a.lastAuditDate) : <span className="text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                        <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                        <TableCell className="py-3 pr-5 text-sm text-slate-400">—</TableCell>
                      </TableRow>
                    ))}

                    {cat.processes.length === 0 && cat.risks.length === 0 && cat.audits.length === 0 && (
                      <TableRow key={`empty-${cat.id}`} className="border-b border-slate-100">
                        <TableCell colSpan={7} className="py-3 pl-10 text-sm text-slate-400 italic">
                          {t("No entities linked to this category yet")}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Tag className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-base font-medium text-slate-600">{t("No auditable entities yet")}</p>
          <p className="text-sm text-slate-400 mt-1">
            {t("Add categories in Audit Settings, then link processes and risks to them.")}
          </p>
        </div>
      )}

      <FieldworkDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedEngagementId(null);
          fetchAuditUniverse();
        }}
        engagementId={selectedEngagementId}
        mode="view"
      />
    </div>
  );
}
