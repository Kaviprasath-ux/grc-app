"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";

interface FrameworkCardProps {
  id: string;
  name: string;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
  onClick?: () => void;
}

// Progress indicator component matching verifai design
function ProgressIndicator({
  percentage,
  label,
  type,
  onClick,
}: {
  percentage: number;
  label: string;
  type: "policy" | "evidence";
  onClick?: (e: React.MouseEvent) => void;
}) {
  const size = 50;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition-colors"
      onClick={onClick}
    >
      {/* Icon with badge */}
      <div className="relative">
        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
          {type === "policy" ? (
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          )}
        </div>
        {/* Yellow badge */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-sm transform rotate-45" />
      </div>

      {/* Progress ring with percentage */}
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90" width={size} height={size}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#e5e7eb"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#22c55e"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-gray-900 mt-1">{percentage.toFixed(1)}%</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </div>
  );
}

export function FrameworkCard({
  id,
  name,
  compliancePercentage,
  policyPercentage,
  evidencePercentage,
  onClick,
}: FrameworkCardProps) {
  const router = useRouter();

  // Color based on compliance percentage
  const getComplianceColor = (pct: number) => {
    if (pct >= 70) return "#22c55e"; // green
    if (pct >= 40) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  const donutData = [
    { name: "Compliant", value: compliancePercentage, color: getComplianceColor(compliancePercentage) },
    { name: "Non Compliant", value: 100 - compliancePercentage, color: "#e5e7eb" },
  ];

  const handlePolicyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/compliance/governance?frameworkId=${id}`);
  };

  const handleEvidenceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/compliance/evidence?frameworkId=${id}`);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer group transition-all duration-300 hover:shadow-lg hover:border-primary/30"
    >
      <div className="p-5">
        {/* Framework Name */}
        <div className="mb-4 pb-3 border-b border-gray-100">
          <h3 className="text-primary font-semibold text-sm truncate">{name}</h3>
        </div>

        {/* Content Row */}
        <div className="flex items-start justify-between">
          {/* Donut Chart - Left side */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={42}
                    paddingAngle={2}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{compliancePercentage.toFixed(1)}%</span>
              </div>
            </div>
            <span className="text-xs text-gray-500 mt-1">Compliance</span>
          </div>

          {/* Policy and Evidence - Right side */}
          <div className="flex flex-col gap-4">
            <ProgressIndicator
              percentage={policyPercentage}
              label="Policy"
              type="policy"
              onClick={handlePolicyClick}
            />
            <ProgressIndicator
              percentage={evidencePercentage}
              label="Evidence"
              type="evidence"
              onClick={handleEvidenceClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
