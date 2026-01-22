"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";

interface RiskItem {
  id: string;
  riskId: string;
  riskName: string;
  riskLevel: string;
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

  const getRiskLevelStyles = (level: string) => {
    switch (level) {
      case "Extreme":
        return "bg-red-600 text-white";
      case "High":
        return "bg-orange-500 text-white";
      case "Medium":
        return "bg-yellow-400 text-gray-900";
      case "Low":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 p-0"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-blue-800">Risk Universe</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Find the maximum number of risks in any department for grid alignment
  const maxRisks = data?.departments.reduce(
    (max, dept) => Math.max(max, dept.risks.length),
    0
  ) || 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-700 p-0"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </Button>
        <h1 className="text-xl font-semibold text-blue-800">Risk Universe</h1>
      </div>

      {/* Tree Structure */}
      <div className="overflow-x-auto pb-8">
        <div className="min-w-max">
          {/* Root Node - Risk Universe */}
          <div className="flex justify-center mb-4">
            <div className="bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-md">
              Risk Universe
            </div>
          </div>

          {/* Vertical line from root */}
          <div className="flex justify-center">
            <div className="w-px h-6 bg-gray-400"></div>
          </div>

          {/* Horizontal line connecting departments */}
          {data?.departments && data.departments.length > 0 && (
            <div className="flex justify-center">
              <div
                className="h-px bg-gray-400"
                style={{
                  width: `${(data.departments.length - 1) * 140 + 100}px`,
                }}
              ></div>
            </div>
          )}

          {/* Departments and Risks Grid */}
          {data?.departments && data.departments.length > 0 ? (
            <div className="flex justify-center">
              <div className="flex gap-2">
                {data.departments.map((dept, deptIndex) => (
                  <div
                    key={dept.id}
                    className="flex flex-col items-center"
                    style={{ width: "130px" }}
                  >
                    {/* Vertical line to department */}
                    <div className="w-px h-4 bg-gray-400"></div>

                    {/* Department Box */}
                    <div className="border border-gray-300 rounded px-3 py-2 bg-white mb-3 w-full text-center shadow-sm">
                      <span className="text-sm font-medium text-gray-800 leading-tight block">
                        {dept.name}
                      </span>
                    </div>

                    {/* Risk Items Column */}
                    <div className="flex flex-col gap-2 w-full">
                      {dept.risks.map((risk) => (
                        <div
                          key={risk.id}
                          className={`${getRiskLevelStyles(
                            risk.riskLevel
                          )} rounded px-3 py-2 text-center shadow-sm cursor-pointer hover:opacity-90 transition-opacity`}
                          title={risk.riskName}
                          onClick={() =>
                            router.push(`/internal-audit/risk-register`)
                          }
                        >
                          <div className="font-semibold text-sm">
                            {risk.riskId}
                          </div>
                          <div className="text-xs mt-0.5">{risk.riskLevel}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>No risks in the risk register yet</p>
              <p className="text-sm mt-2">
                Add risks to the Risk Register to see them here
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/internal-audit/risk-register")}
              >
                Go to Risk Register
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
