"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RiskMatrixData {
  likelihood: number;
  impact: number;
  count: number;
  risks: string[];
}

interface RiskMatrixProps {
  data: RiskMatrixData[];
  title?: string;
}

// Color based on risk score (likelihood * impact)
function getCellColor(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 20) return "bg-red-600 hover:bg-red-700";
  if (score >= 15) return "bg-orange-500 hover:bg-orange-600";
  if (score >= 10) return "bg-amber-500 hover:bg-amber-600";
  if (score >= 5) return "bg-yellow-400 hover:bg-yellow-500";
  return "bg-green-500 hover:bg-green-600";
}

// Rating values matching website: Catastrophic, Very high, High, Low Risk
function getCellLabel(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

const likelihoodLabels = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const impactLabels = ["", "Insignificant", "Minor", "Moderate", "Major", "Catastrophic"];

export function RiskMatrix({ data, title = "Risk Heat Map" }: RiskMatrixProps) {
  // Create a map for quick lookup
  const matrixMap = new Map<string, RiskMatrixData>();
  data.forEach((item) => {
    matrixMap.set(`${item.likelihood}-${item.impact}`, item);
  });

  return (
    <Card className="w-full bg-grc-card border-grc-card-border shadow-grc">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-grc-text">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs font-medium text-grc-text-secondary"></th>
                {[1, 2, 3, 4, 5].map((impact) => (
                  <th
                    key={impact}
                    className="p-2 text-xs font-medium text-grc-text-secondary text-center"
                  >
                    <div>{impact}</div>
                    <div className="text-[10px] font-normal">{impactLabels[impact]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[5, 4, 3, 2, 1].map((likelihood) => (
                <tr key={likelihood}>
                  <td className="p-2 text-xs font-medium text-grc-text-secondary text-right pr-4">
                    <div>{likelihood}</div>
                    <div className="text-[10px] font-normal">{likelihoodLabels[likelihood]}</div>
                  </td>
                  {[1, 2, 3, 4, 5].map((impact) => {
                    const cellData = matrixMap.get(`${likelihood}-${impact}`);
                    const count = cellData?.count || 0;
                    const risks = cellData?.risks || [];

                    return (
                      <td key={impact} className="p-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`
                                  w-full aspect-square min-w-[48px] min-h-[48px]
                                  flex items-center justify-center
                                  rounded-md cursor-pointer transition-colors
                                  ${getCellColor(likelihood, impact)}
                                  ${count > 0 ? "text-white font-bold" : "text-white/60"}
                                `}
                              >
                                {count > 0 ? count : "-"}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]">
                              <div className="text-sm">
                                <p className="font-medium">
                                  {getCellLabel(likelihood, impact)} Risk
                                </p>
                                <p className="text-xs text-gray-400">
                                  Score: {likelihood * impact} (L:{likelihood} × I:{impact})
                                </p>
                                {count > 0 && (
                                  <div className="mt-1 text-xs">
                                    <p>{count} risk(s):</p>
                                    <ul className="list-disc pl-4">
                                      {risks.slice(0, 5).map((riskId, i) => (
                                        <li key={i}>{riskId}</li>
                                      ))}
                                      {risks.length > 5 && (
                                        <li>...and {risks.length - 5} more</li>
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-grc-text-secondary">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-400"></div>
              <span className="text-grc-text-secondary">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500"></div>
              <span className="text-grc-text-secondary">High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500"></div>
              <span className="text-grc-text-secondary">Very High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-600"></div>
              <span className="text-grc-text-secondary">Catastrophic</span>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-grc-text-secondary">
            <span className="font-medium">Impact →</span> | <span className="font-medium">↑ Likelihood</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
