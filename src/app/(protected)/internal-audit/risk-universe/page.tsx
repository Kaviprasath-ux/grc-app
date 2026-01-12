"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

interface RiskItem {
  id: string;
  riskId: string;
  riskName: string;
  riskLevel: string | null;
  inherentScore: number | null;
  residualScore: number | null;
}

interface DepartmentData {
  id: string;
  name: string;
  risks: RiskItem[];
}

interface RiskUniverseData {
  departments: DepartmentData[];
  totalDepartments: number;
  totalRisks: number;
}

export default function RiskUniversePage() {
  const router = useRouter();
  const [data, setData] = useState<RiskUniverseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredRisk, setHoveredRisk] = useState<RiskItem | null>(null);

  useEffect(() => {
    fetchRiskUniverse();
  }, []);

  const fetchRiskUniverse = async () => {
    try {
      const response = await fetch("/api/internal-audit/risk-universe");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch risk universe:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string | null) => {
    switch (level?.toLowerCase()) {
      case "extreme":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-blue-900">Risk Universe</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-blue-900">Risk Universe</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative overflow-x-auto">
            {/* Root Node */}
            <div className="flex justify-center mb-8">
              <div className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md">
                Risk Universe
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

                  {/* Risk items */}
                  <div className="flex flex-col items-center gap-2">
                    {dept.risks.map((risk) => (
                      <div key={risk.id} className="flex flex-col items-center relative">
                        {/* Connection line */}
                        <div className="w-0.5 h-3 bg-gray-300"></div>

                        {/* Risk card */}
                        <div
                          className={`${getRiskLevelColor(risk.riskLevel)} text-white rounded px-3 py-2 min-w-[90px] text-center shadow cursor-pointer`}
                          onMouseEnter={() => setHoveredRisk(risk)}
                          onMouseLeave={() => setHoveredRisk(null)}
                        >
                          <div className="font-semibold text-sm">{risk.riskId}</div>
                          {risk.riskLevel && (
                            <div className="text-xs mt-1">{risk.riskLevel}</div>
                          )}
                        </div>

                        {/* Tooltip on hover */}
                        {hoveredRisk?.id === risk.id && (
                          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-lg shadow-lg p-3 min-w-[200px]">
                            <p className="font-semibold text-gray-800">{risk.riskName}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Risk Level: <span className="font-medium">{risk.riskLevel || "-"}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              Risk Score: <span className="font-medium">{risk.residualScore || risk.inherentScore || "-"}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {(!data?.departments || data.departments.length === 0) && (
              <div className="text-center py-12 text-gray-500">
                <p>No risks in the universe yet</p>
                <p className="text-sm mt-2">Risks will appear here once identified and assessed</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Risk Level Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm">Extreme</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm">Low</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
