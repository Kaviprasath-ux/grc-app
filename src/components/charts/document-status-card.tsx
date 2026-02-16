"use client";

import { cn } from "@/lib/utils";
import { FileText, FileCheck, FileClock, FileWarning, FileX } from "lucide-react";

interface DocumentStatusItem {
  type: string;
  published: number;
  approved: number;
  draft: number;
  needsReview: number;
  notUploaded: number;
}

interface DocumentStatusCardProps {
  title: string;
  data: DocumentStatusItem[];
  className?: string;
}

// Design system colors
const statusConfig = {
  published: { color: "#6366F1", label: "Published", icon: FileText },
  approved: { color: "#10B981", label: "Approved", icon: FileCheck },
  draft: { color: "#F59E0B", label: "Draft", icon: FileClock },
  needsReview: { color: "#EF4444", label: "Needs Review", icon: FileWarning },
  notUploaded: { color: "#94A3B8", label: "Not Uploaded", icon: FileX },
};

export function DocumentStatusCard({ title, data, className }: DocumentStatusCardProps) {
  // Calculate totals for each status across all document types
  const totals = {
    published: data.reduce((sum, item) => sum + item.published, 0),
    approved: data.reduce((sum, item) => sum + item.approved, 0),
    draft: data.reduce((sum, item) => sum + item.draft, 0),
    needsReview: data.reduce((sum, item) => sum + item.needsReview, 0),
    notUploaded: data.reduce((sum, item) => sum + item.notUploaded, 0),
  };

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <div className={cn(
      "bg-white rounded-xl border border-slate-200 p-3 sm:p-4 transition-all duration-200 flex flex-col",
      "hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300",
      className
    )}>
      {/* Header with summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-[10px] text-slate-500">
                {totals[key as keyof typeof totals]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Document type rows */}
      <div className="flex-1 space-y-3">
        {data.map((item, index) => {
          const itemTotal = item.published + item.approved + item.draft + item.needsReview + item.notUploaded;

          return (
            <div key={index} className="space-y-1.5">
              {/* Label and total */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">{item.type}</span>
                <span className="text-xs text-slate-500">{itemTotal} total</span>
              </div>

              {/* Stacked progress bar */}
              <div className="h-6 bg-slate-100 rounded-md overflow-hidden flex">
                {itemTotal > 0 ? (
                  <>
                    {item.published > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-[10px] font-medium text-white transition-all"
                        style={{
                          backgroundColor: statusConfig.published.color,
                          width: `${(item.published / itemTotal) * 100}%`,
                        }}
                        title={`Published: ${item.published}`}
                      >
                        {item.published > 0 && (item.published / itemTotal) > 0.1 && item.published}
                      </div>
                    )}
                    {item.approved > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-[10px] font-medium text-white transition-all"
                        style={{
                          backgroundColor: statusConfig.approved.color,
                          width: `${(item.approved / itemTotal) * 100}%`,
                        }}
                        title={`Approved: ${item.approved}`}
                      >
                        {item.approved > 0 && (item.approved / itemTotal) > 0.1 && item.approved}
                      </div>
                    )}
                    {item.draft > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-[10px] font-medium text-white transition-all"
                        style={{
                          backgroundColor: statusConfig.draft.color,
                          width: `${(item.draft / itemTotal) * 100}%`,
                        }}
                        title={`Draft: ${item.draft}`}
                      >
                        {item.draft > 0 && (item.draft / itemTotal) > 0.1 && item.draft}
                      </div>
                    )}
                    {item.needsReview > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-[10px] font-medium text-white transition-all"
                        style={{
                          backgroundColor: statusConfig.needsReview.color,
                          width: `${(item.needsReview / itemTotal) * 100}%`,
                        }}
                        title={`Needs Review: ${item.needsReview}`}
                      >
                        {item.needsReview > 0 && (item.needsReview / itemTotal) > 0.1 && item.needsReview}
                      </div>
                    )}
                    {item.notUploaded > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-[10px] font-medium text-white transition-all"
                        style={{
                          backgroundColor: statusConfig.notUploaded.color,
                          width: `${(item.notUploaded / itemTotal) * 100}%`,
                        }}
                        title={`Not Uploaded: ${item.notUploaded}`}
                      >
                        {item.notUploaded > 0 && (item.notUploaded / itemTotal) > 0.1 && item.notUploaded}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">
                    No documents
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-[10px] text-slate-500">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
