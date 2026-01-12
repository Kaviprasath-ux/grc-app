"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface AuditItem {
  id: string;
  auditId: string;
  engagementTitle: string;
  actualHours: number;
  plannedHours: number;
  status: string;
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
    if (status === "Completed") return "bg-green-500";
    if (actualHours > plannedHours) return "bg-red-500";
    if (actualHours > 0) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-900 mb-6">Audit Universe</h1>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-blue-900">Audit Universe</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="relative overflow-x-auto">
            {/* Root Node */}
            <div className="flex justify-center mb-8">
              <div className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md">
                Audit Universe
              </div>
            </div>

            {/* Connection line from root */}
            <div className="flex justify-center mb-4">
              <div className="w-0.5 h-8 bg-gray-300"></div>
            </div>

            {/* Horizontal line connecting all departments */}
            {data?.departments && data.departments.length > 0 && (
              <div className="flex justify-center mb-4">
                <div className="h-0.5 bg-gray-300" style={{ width: `${Math.min(data.departments.length * 150, 1200)}px` }}></div>
              </div>
            )}

            {/* Department branches */}
            <div className="flex flex-wrap justify-center gap-4">
              {data?.departments.map((dept) => (
                <div key={dept.id} className="flex flex-col items-center">
                  {/* Vertical line to department */}
                  <div className="w-0.5 h-4 bg-gray-300"></div>

                  {/* Department box */}
                  <div className="border border-gray-300 rounded px-4 py-2 bg-white mb-4 min-w-[120px] text-center">
                    <span className="text-sm font-medium">{dept.name}</span>
                  </div>

                  {/* Audit items */}
                  <div className="flex flex-col items-center gap-2">
                    {dept.audits.map((audit) => (
                      <div key={audit.id} className="flex flex-col items-center">
                        {/* Connection line */}
                        <div className="w-0.5 h-3 bg-gray-300"></div>

                        {/* Audit card */}
                        <div
                          className={`${getStatusColor(audit.actualHours, audit.plannedHours, audit.status)} text-white rounded px-3 py-2 min-w-[100px] text-center shadow`}
                        >
                          <div className="font-semibold text-sm">{audit.auditId}</div>
                          <div className="text-xs mt-1 flex justify-between gap-2">
                            <span>Actual Hours</span>
                            <span>Planned Hours</span>
                          </div>
                          <div className="text-xs flex justify-between gap-2">
                            <span>:{audit.actualHours}</span>
                            <span>:{audit.plannedHours}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {(!data?.departments || data.departments.length === 0) && (
              <div className="text-center py-12 text-gray-500">
                <p>No audits in the universe yet</p>
                <p className="text-sm mt-2">Audits will appear here once created and assigned to departments</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm">On Track / Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm">Over Budget</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
