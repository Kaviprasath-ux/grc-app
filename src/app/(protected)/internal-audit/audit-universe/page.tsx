"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, CalendarDays, CheckCircle, AlertTriangle, PlayCircle } from "lucide-react";

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
  const router = useRouter();
  const [data, setData] = useState<AuditUniverseData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const getStatusColor = (actualHours: number, plannedHours: number, status: string) => {
    const statusLower = status?.toLowerCase() || '';

    // Completed audits
    if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'closed') {
      return actualHours > plannedHours ? "bg-red-500" : "bg-green-500";
    }

    // In progress audits
    if (statusLower === 'in progress' || statusLower === 'inprogress' || statusLower === 'ongoing' || statusLower === 'active') {
      if (actualHours > plannedHours) return "bg-red-500"; // Over budget
      if (actualHours > plannedHours * 0.8) return "bg-yellow-500"; // Approaching limit
      return "bg-orange-500"; // In progress
    }

    // Planned/Draft audits
    return "bg-blue-500";
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
    router.push(`/internal-audit/fieldwork/${auditId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Audit Universe</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">Loading audit universe...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Audit Universe</h1>
        <div className="text-sm text-slate-500">
          {data?.totalDepartments || 0} Departments | {data?.totalAudits || 0} Audits
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6">
          <div className="relative">
            {/* Root Node */}
            <div className="flex justify-center mb-8">
              <div className="bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold">
                Audit Universe
              </div>
            </div>

            {/* Connection line from root */}
            <div className="flex justify-center mb-4">
              <div className="w-0.5 h-8 bg-slate-300"></div>
            </div>

            {/* Scrollable container for horizontal line and departments */}
            <div className="overflow-x-auto pb-4">
              {/* Horizontal line connecting all departments */}
              {data?.departments && data.departments.length > 0 && (
                <div className="flex mb-4">
                  <div className="h-0.5 bg-slate-300 flex-1" style={{ minWidth: `${data.departments.length * 160}px` }}></div>
                </div>
              )}

              {/* Department branches - single row */}
              <TooltipProvider>
                <div className="flex gap-6" style={{ minWidth: 'max-content' }}>
                  {data?.departments.map((dept) => (
                  <div key={dept.id} className="flex flex-col items-center flex-shrink-0">
                    {/* Vertical line to department */}
                    <div className="w-0.5 h-4 bg-slate-300"></div>

                    {/* Department box */}
                    <div className={`border rounded-lg px-4 py-3 mb-4 min-w-[140px] text-center transition-colors ${
                      dept.audits.length > 0
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-dashed border-slate-200 bg-slate-50'
                    }`}>
                      <span className={`text-sm font-semibold ${dept.audits.length > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                        {dept.name}
                      </span>
                      <div className={`text-xs mt-1 ${dept.audits.length > 0 ? 'text-slate-400' : 'text-slate-300'}`}>
                        {dept.audits.length > 0 ? `${dept.audits.length} audit(s)` : 'No audits'}
                      </div>
                    </div>

                    {/* Audit items */}
                    <div className="flex flex-col items-center gap-3">
                      {dept.audits.length > 0 ? (
                        dept.audits.map((audit) => (
                          <div key={audit.id} className="flex flex-col items-center">
                            {/* Connection line */}
                            <div className="w-0.5 h-3 bg-slate-300"></div>

                            {/* Audit card with tooltip */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`${getStatusColor(audit.actualHours, audit.plannedHours, audit.status)} text-white rounded-lg px-4 py-3 min-w-[130px] text-center cursor-pointer hover:opacity-90 transition-all hover:scale-105`}
                                  onClick={() => handleAuditClick(audit.id)}
                                >
                                  <div className="flex items-center justify-center gap-1 font-semibold text-sm mb-2">
                                    {getStatusIcon(audit.status)}
                                    <span>{audit.auditId}</span>
                                  </div>
                                  <div className="text-xs space-y-1">
                                    <div className="flex justify-between gap-4">
                                      <span className="opacity-80">Actual</span>
                                      <span className="opacity-80">Planned</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="font-medium">
                                        {audit.actualHours > 0 ? `${audit.actualHours}h` : '-'}
                                      </span>
                                      <span className="font-medium">
                                        {audit.plannedHours > 0 ? `${audit.plannedHours}h` : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div className="space-y-2">
                                  <p className="font-semibold">{audit.engagementTitle}</p>
                                  <div className="text-xs space-y-1">
                                    <div className="flex items-center gap-2">
                                      <CalendarDays className="h-3 w-3" />
                                      <span>Start: {formatDate(audit.startDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <CalendarDays className="h-3 w-3" />
                                      <span>End: {formatDate(audit.endDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3" />
                                      <span>Status: {audit.status}</span>
                                    </div>
                                    {audit.actualHours > audit.plannedHours && (
                                      <div className="flex items-center gap-2 text-red-600">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>Over budget by {audit.actualHours - audit.plannedHours}h</span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 italic">Click to view details</p>
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
            {(!data?.departments || data.departments.length === 0) && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg">No audits in the universe yet</p>
                <p className="text-sm mt-2">Audits will appear here once created and assigned to departments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Legend</h3>
        </div>
        <div className="p-6">
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm text-slate-600">Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm text-slate-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-slate-600">Approaching Budget</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-slate-600">Completed (On Budget)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-slate-600">Over Budget</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hours Summary */}
      {data?.departments && data.departments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">Hours Summary by Department</h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-600">Department</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Audits</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Total Planned Hours</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Total Actual Hours</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map((dept) => {
                    const totalPlanned = dept.audits.reduce((sum, a) => sum + a.plannedHours, 0);
                    const totalActual = dept.audits.reduce((sum, a) => sum + a.actualHours, 0);
                    const variance = totalActual - totalPlanned;
                    const hasAudits = dept.audits.length > 0;
                    return (
                      <tr key={dept.id} className={`border-b border-slate-100 hover:bg-slate-50 ${!hasAudits ? 'text-slate-400' : 'text-slate-700'}`}>
                        <td className="py-2 px-3">{dept.name}</td>
                        <td className="text-right py-2 px-3">{dept.audits.length}</td>
                        <td className="text-right py-2 px-3">{hasAudits ? `${totalPlanned}h` : '-'}</td>
                        <td className="text-right py-2 px-3">{hasAudits ? `${totalActual}h` : '-'}</td>
                        <td className={`text-right py-2 px-3 font-medium ${hasAudits ? (variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : '') : ''}`}>
                          {hasAudits ? `${variance > 0 ? '+' : ''}${variance}h` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-slate-50 text-slate-800">
                    <td className="py-2 px-3">Total</td>
                    <td className="text-right py-2 px-3">{data.totalAudits}</td>
                    <td className="text-right py-2 px-3">
                      {data.departments.reduce((sum, d) => sum + d.audits.reduce((s, a) => s + a.plannedHours, 0), 0)}h
                    </td>
                    <td className="text-right py-2 px-3">
                      {data.departments.reduce((sum, d) => sum + d.audits.reduce((s, a) => s + a.actualHours, 0), 0)}h
                    </td>
                    <td className="text-right py-2 px-3">
                      {(() => {
                        const totalP = data.departments.reduce((sum, d) => sum + d.audits.reduce((s, a) => s + a.plannedHours, 0), 0);
                        const totalA = data.departments.reduce((sum, d) => sum + d.audits.reduce((s, a) => s + a.actualHours, 0), 0);
                        const v = totalA - totalP;
                        return <span className={v > 0 ? 'text-red-600' : v < 0 ? 'text-green-600' : ''}>{v > 0 ? '+' : ''}{v}h</span>;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
