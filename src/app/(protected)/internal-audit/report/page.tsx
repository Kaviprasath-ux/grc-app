"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface CompletedEngagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  departmentName: string;
  auditType: string;
  assignedAuditorName: string;
  status: string;
  hasReport: boolean;
  reportId: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isAuditHead = useHasRole("AuditHead");
  const isAuditManager = useHasRole("AuditManager");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");
  const isAuditTeam = isAuditHead || isAuditManager || isAuditor;
  const isAuditeeOnly = isAuditee && !isAuditTeam;

  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<CompletedEngagement[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  // Generate Report Dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<CompletedEngagement | null>(null);
  const [overallResult, setOverallResult] = useState<string>("Pass");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchCompletedEngagements();
  }, [pagination.page]);

  const fetchCompletedEngagements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.limit.toString());

      const response = await fetch(`/api/internal-audit/report/completed-engagements?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEngagements(data.engagements || []);
        setPagination(data.pagination || pagination);
      }
    } catch (error) {
      console.error("Failed to fetch completed engagements:", error);
      toast.error(t("Failed to fetch completed engagements"));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = (engagement: CompletedEngagement) => {
    if (engagement.hasReport) {
      // If report already exists, navigate to view it
      router.push(`/internal-audit/report/${engagement.id}`);
    } else if (!isAuditeeOnly) {
      // Only non-auditee can generate reports
      // Open dialog to select Pass/Fail
      setSelectedEngagement(engagement);
      setOverallResult("Pass");
      setGenerateDialogOpen(true);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!selectedEngagement) return;

    setGenerating(true);
    try {
      const response = await fetch(`/api/internal-audit/report/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId: selectedEngagement.id,
          overallResult: overallResult,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t("Report generated successfully"));
        setGenerateDialogOpen(false);
        // Navigate to the report view page
        router.push(`/internal-audit/report/${selectedEngagement.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to generate report"));
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error(t("Failed to generate report"));
    } finally {
      setGenerating(false);
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("Reports")}</h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 py-4 pl-4">{t("Engagement")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Department")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Audit Type")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Assigned Auditor")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Status")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="relative h-6 w-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : engagements.length > 0 ? (
              engagements.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-4 pl-4 text-sm font-medium text-slate-900 max-w-[200px]">
                    <span className="line-clamp-2">{engagement.engagementTitle}</span>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{engagement.departmentName}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{engagement.auditType}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{engagement.assignedAuditorName}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{engagement.status}</TableCell>
                  <TableCell className="py-4">
                    {/* Auditee can only view existing reports, not generate new ones */}
                    {isAuditeeOnly ? (
                      engagement.hasReport ? (
                        <Button
                          size="sm"
                          className="bg-primary-600 hover:bg-primary-700 text-white"
                          onClick={() => router.push(`/internal-audit/report/${engagement.id}`)}
                        >
                          {t("View Report")}
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-sm">{t("No report")}</span>
                      )
                    ) : (
                      <Button
                        size="sm"
                        className="bg-primary-600 hover:bg-primary-700 text-white"
                        onClick={() => handleGenerateReport(engagement)}
                      >
                        {engagement.hasReport ? t("View Report") : t("Generate Draft Report")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  {t("No completed engagements found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {startIndex} {t("to")} {endIndex} {t("of")} {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page === 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page === 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: pagination.totalPages }))}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Generate Report Dialog - Pass/Fail Selection */}
      {isAuditHead && (
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="sm:max-w-[450px] p-0 gap-0">
            {/* Fixed Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Generate Audit Report")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Select the overall audit result for")} "{selectedEngagement?.engagementTitle}"
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700 mb-3 block">{t("Overall Audit Result")}</Label>
              <RadioGroup
                value={overallResult}
                onValueChange={setOverallResult}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Pass" id="result-pass" />
                  <Label htmlFor="result-pass" className="font-normal cursor-pointer text-green-600">
                    {t("Pass")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Fail" id="result-fail" />
                  <Label htmlFor="result-fail" className="font-normal cursor-pointer text-red-600">
                    {t("Fail")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Fixed Footer */}
            <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setGenerateDialogOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button
                className="bg-primary-600 hover:bg-primary-700"
                onClick={handleConfirmGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("Generating...")}
                  </>
                ) : (
                  t("Generate Report")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
