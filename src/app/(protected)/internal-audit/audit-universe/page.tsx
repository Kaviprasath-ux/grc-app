"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Clock, CalendarDays, CheckCircle, AlertTriangle, PlayCircle, Home, ChevronRight, Building2, BarChart3, Timer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { FieldworkDetailModal } from "../fieldwork/FieldworkDetailModal";

interface AuditItem {
  id: string;
  auditId: string;
  engagementTitle: string;
  actualHours: number;
  plannedHours: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface DepartmentData {
  id: string;
  name: string;
  audits: AuditItem[];
}

interface AuditUniverseData {
  departments: DepartmentData[];
  totalDepartments: number;
  totalAudits: number;
}

export default function AuditUniversePage() {
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [data, setData] = useState<AuditUniverseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);

  // Dynamic data translation — flatten nested structures for translation hooks
  const deptsArray = data?.departments || [];
  const { data: translatedDepts } = useTranslatedData(deptsArray, { modelName: 'Department' });
  const allAudits = useMemo(() => deptsArray.flatMap(d => d.audits), [deptsArray]);
  const { data: translatedAudits } = useTranslatedData(allAudits, { modelName: 'AuditEngagement' });

  // Reconstruct nested structure with translated data
  const translatedDepartments = useMemo(() => {
    const auditMap = new Map(translatedAudits.map(a => [a.id, a]));
    return translatedDepts.map(dept => ({
      ...dept,
      audits: dept.audits.map(a => auditMap.get(a.id) || a),
    }));
  }, [translatedDepts, translatedAudits]);

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

    // Completed audits
    if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'closed') {
      return actualHours > plannedHours
        ? { bg: "bg-red-50 border border-red-200", text: "text-red-700", sub: "text-red-600", dot: "bg-red-400" }
        : { bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700", sub: "text-emerald-600", dot: "bg-emerald-400" };
    }

    // In progress audits
    if (statusLower === 'in progress' || statusLower === 'inprogress' || statusLower === 'ongoing' || statusLower === 'active') {
      if (actualHours > plannedHours) return { bg: "bg-red-50 border border-red-200", text: "text-red-700", sub: "text-red-600", dot: "bg-red-400" };
      if (actualHours > plannedHours * 0.8) return { bg: "bg-amber-50 border border-amber-200", text: "text-amber-700", sub: "text-amber-600", dot: "bg-amber-400" };
      return { bg: "bg-sky-50 border border-sky-200", text: "text-sky-700", sub: "text-sky-600", dot: "bg-sky-400" };
    }

    // Planned/Draft audits
    return { bg: "bg-slate-50 border border-slate-200", text: "text-slate-700", sub: "text-slate-500", dot: "bg-slate-400" };
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';

    if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'closed') {
      return <CheckCircle className="h-3 w-3" />;
    }
    if (statusLower === 'in progress' || statusLower === 'inprogress' || statusLower === 'ongoing' || statusLower === 'active') {
      return <PlayCircle className="h-3 w-3" />;
    }
    return <Clock className="h-3 w-3" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleAuditClick = (auditId: string) => {
    setSelectedEngagementId(auditId);
    setDetailModalOpen(true);
  };

  // Compute summary stats
  const totalPlannedHours = translatedDepartments.reduce((sum, d) => sum + d.audits.reduce((s, a) => s + a.plannedHours, 0), 0);
  const totalActualHours = translatedDepartments.reduce((sum, d) => sum + d.audits.reduce((s, a) => s + a.actualHours, 0), 0);
  const totalVariance = totalActualHours - totalPlannedHours;

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          {canViewDashboard && (
            <>
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            </>
          )}
          <span className="text-primary-700 font-medium">{t("Audit Universe")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Audit Universe")}</h1>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading audit universe...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Audit Universe")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Audit Universe")}</h1>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-3 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Departments")}</p>
              <p className="text-xl font-bold text-slate-800">{data?.totalDepartments || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-3 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Total Audits")}</p>
              <p className="text-xl font-bold text-slate-800">{data?.totalAudits || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-3 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Timer className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Planned Hours")}</p>
              <p className="text-xl font-bold text-slate-800">{totalPlannedHours}h</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-3 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">{t("Variance")}</p>
              <p className={`text-xl font-bold ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-green-600' : 'text-slate-800'}`}>
                {totalVariance > 0 ? '+' : ''}{totalVariance}h
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Map Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">{t("Organization Map")}</h3>
          {/* Inline Legend */}
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-slate-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("Planned")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-sky-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("In Progress")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("Near Budget")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("Completed")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
              <span className="text-xs text-slate-500">{t("Over Budget")}</span>
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-6">
          <div className="relative">
            {/* Root Node */}
            <div className="flex justify-center mb-8">
              <div className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold shadow-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {t("Audit Universe")}
              </div>
            </div>

            {/* Connection line from root */}
            <div className="flex justify-center mb-4">
              <div className="w-0.5 h-8 bg-slate-200"></div>
            </div>

            {/* Scrollable container for horizontal line and departments */}
            <div className="overflow-x-auto pb-4">
              {/* Horizontal line connecting all departments */}
              {translatedDepartments.length > 0 && (
                <div className="flex mb-4">
                  <div className="h-0.5 bg-slate-200 flex-1" style={{ minWidth: `${translatedDepartments.length * 160}px` }}></div>
                </div>
              )}

              {/* Department branches - single row */}
              <TooltipProvider>
                <div className="flex gap-6" style={{ minWidth: 'max-content' }}>
                  {translatedDepartments.map((dept) => (
                  <div key={dept.id} className="flex flex-col items-center flex-shrink-0">
                    {/* Vertical line to department */}
                    <div className="w-0.5 h-4 bg-slate-200"></div>

                    {/* Department box */}
                    <div className={`rounded-xl px-5 py-3 mb-4 min-w-[150px] text-center transition-all ${
                      dept.audits.length > 0
                        ? 'border border-slate-200 bg-white shadow-sm'
                        : 'border border-dashed border-slate-200 bg-slate-50/50'
                    }`}>
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <Building2 className={`h-3.5 w-3.5 ${dept.audits.length > 0 ? 'text-primary-500' : 'text-slate-300'}`} />
                        <span className={`text-sm font-semibold ${dept.audits.length > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                          {dept.name}
                        </span>
                      </div>
                      <div className={`text-xs ${dept.audits.length > 0 ? 'text-slate-400' : 'text-slate-300'}`}>
                        {dept.audits.length > 0 ? `${dept.audits.length} ${t("audit(s)")}` : t("No audits")}
                      </div>
                    </div>

                    {/* Audit items */}
                    <div className="flex flex-col items-center gap-3">
                      {dept.audits.length > 0 ? (
                        dept.audits.map((audit) => (
                          <div key={audit.id} className="flex flex-col items-center">
                            {/* Connection line */}
                            <div className="w-0.5 h-3 bg-slate-200"></div>

                            {/* Audit card with tooltip */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {(() => {
                                  const style = getStatusStyle(audit.actualHours, audit.plannedHours, audit.status);
                                  return (
                                <div
                                  className={`${style.bg} rounded-xl px-4 py-3 min-w-[135px] text-center cursor-pointer transition-all  active:scale-100`}
                                  onClick={() => handleAuditClick(audit.id)}
                                >
                                  <div className={`flex items-center justify-center gap-1.5 font-semibold text-sm mb-2 ${style.text}`}>
                                    {getStatusIcon(audit.status)}
                                    <span>{audit.auditId}</span>
                                  </div>
                                  <div className="text-xs space-y-1">
                                    <div className="flex justify-between gap-4">
                                      <span className={`${style.sub} opacity-75`}>{t("Actual")}</span>
                                      <span className={`${style.sub} opacity-75`}>{t("Planned")}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className={`font-medium ${style.text}`}>
                                        {audit.actualHours > 0 ? `${audit.actualHours}h` : '-'}
                                      </span>
                                      <span className={`font-medium ${style.text}`}>
                                        {audit.plannedHours > 0 ? `${audit.plannedHours}h` : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                  );
                                })()}
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs p-3">
                                <div className="space-y-2">
                                  <p className="font-semibold text-slate-800">{audit.engagementTitle}</p>
                                  <div className="text-xs space-y-1.5 text-slate-600">
                                    <div className="flex items-center gap-2">
                                      <CalendarDays className="h-3 w-3 text-slate-400" />
                                      <span>{t("Start")}: {formatDate(audit.startDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <CalendarDays className="h-3 w-3 text-slate-400" />
                                      <span>{t("End")}: {formatDate(audit.endDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-slate-400" />
                                      <span>{t("Status")}: {audit.status}</span>
                                    </div>
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
                        ))
                      ) : (
                        <div className="text-xs text-slate-300 italic py-2">
                          —
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
            </div>

            {/* Empty state */}
            {translatedDepartments.length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-base font-medium text-slate-600">{t("No audits in the universe yet")}</p>
                <p className="text-sm text-slate-400 mt-1">{t("Audits will appear here once created and assigned to departments")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hours Summary */}
      {translatedDepartments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Hours Summary by Department")}</h3>
          </div>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Department")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 text-right">{t("Audits")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 text-right">{t("Planned Hours")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 text-right">{t("Actual Hours")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 text-right pr-5">{t("Variance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {translatedDepartments.map((dept) => {
                const deptPlanned = dept.audits.reduce((sum, a) => sum + a.plannedHours, 0);
                const deptActual = dept.audits.reduce((sum, a) => sum + a.actualHours, 0);
                const variance = deptActual - deptPlanned;
                const hasAudits = dept.audits.length > 0;
                return (
                  <TableRow key={dept.id} className={`border-b border-slate-100 last:border-0 ${!hasAudits ? 'text-slate-400' : ''}`}>
                    <TableCell className="py-3 pl-5">
                      <div className="flex items-center gap-2">
                        <Building2 className={`h-3.5 w-3.5 ${hasAudits ? 'text-primary-500' : 'text-slate-300'}`} />
                        <span className="text-sm font-medium text-slate-800">{dept.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                        {dept.audits.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-3 text-sm text-slate-700">{hasAudits ? `${deptPlanned}h` : '-'}</TableCell>
                    <TableCell className="text-right py-3 text-sm text-slate-700">{hasAudits ? `${deptActual}h` : '-'}</TableCell>
                    <TableCell className="text-right py-3 pr-5">
                      {hasAudits ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          variance > 0 ? 'bg-red-50 text-red-700' : variance < 0 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {variance > 0 ? '+' : ''}{variance}h
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow className="border-t border-slate-200 bg-slate-50/50 hover:bg-slate-50/50">
                <TableCell className="py-3 pl-5">
                  <span className="text-sm font-semibold text-slate-800">{t("Total")}</span>
                </TableCell>
                <TableCell className="text-right py-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {data?.totalAudits}
                  </span>
                </TableCell>
                <TableCell className="text-right py-3 text-sm font-semibold text-slate-800">
                  {totalPlannedHours}h
                </TableCell>
                <TableCell className="text-right py-3 text-sm font-semibold text-slate-800">
                  {totalActualHours}h
                </TableCell>
                <TableCell className="text-right py-3 pr-5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    totalVariance > 0 ? 'bg-red-50 text-red-700' : totalVariance < 0 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {totalVariance > 0 ? '+' : ''}{totalVariance}h
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* Fieldwork Detail Modal */}
      <FieldworkDetailModal
        open={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedEngagementId(null); fetchAuditUniverse(); }}
        engagementId={selectedEngagementId}
        mode="view"
      />
    </div>
  );
}
