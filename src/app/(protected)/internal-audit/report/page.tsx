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
import { Loader2 } from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";

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
  const isAuditHead = useHasRole("AuditHead");

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
      toast.error("Failed to fetch completed engagements");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = (engagement: CompletedEngagement) => {
    if (engagement.hasReport) {
      // If report already exists, navigate to view it
      router.push(`/internal-audit/report/${engagement.id}`);
    } else {
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
        toast.success("Report generated successfully");
        setGenerateDialogOpen(false);
        // Navigate to the report view page
        router.push(`/internal-audit/report/${selectedEngagement.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to generate report");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-xl font-bold text-[#1e3a5f]">Reports</h1>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#1e3a5f]">
              <TableHead className="text-white font-semibold">Engagement</TableHead>
              <TableHead className="text-white font-semibold">Department</TableHead>
              <TableHead className="text-white font-semibold">Audit Type</TableHead>
              <TableHead className="text-white font-semibold">Assigned Auditor</TableHead>
              <TableHead className="text-white font-semibold">Status</TableHead>
              <TableHead className="text-white font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1e3a5f]" />
                </TableCell>
              </TableRow>
            ) : engagements.length > 0 ? (
              engagements.map((engagement) => (
                <TableRow key={engagement.id} className="hover:bg-gray-50">
                  <TableCell className="max-w-[200px]">
                    <span className="line-clamp-2">{engagement.engagementTitle}</span>
                  </TableCell>
                  <TableCell>{engagement.departmentName}</TableCell>
                  <TableCell>{engagement.auditType}</TableCell>
                  <TableCell>{engagement.assignedAuditorName}</TableCell>
                  <TableCell>{engagement.status}</TableCell>
                  <TableCell>
                    <Button
                      className="bg-[#1e3a5f] hover:bg-[#2e4a6f] text-white text-sm"
                      onClick={() => handleGenerateReport(engagement)}
                    >
                      {engagement.hasReport ? "View Report" : "Generate Draft Report"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No completed engagements found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.total > 0 && (
        <div className="flex items-center justify-end text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}
            >
              {"<<"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              {"<"}
            </Button>
            <span>
              {startIndex} to {endIndex} of {pagination.total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              {">"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: pagination.totalPages }))}
            >
              {">>"}
            </Button>
          </div>
        </div>
      )}

      {/* Generate Report Dialog - Pass/Fail Selection */}
      {isAuditHead && (
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#1e3a5f]">Generate Audit Report</DialogTitle>
              <DialogDescription>
                Select the overall audit result for "{selectedEngagement?.engagementTitle}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="text-[#1e3a5f] font-medium mb-3 block">Overall Audit Result</Label>
              <RadioGroup
                value={overallResult}
                onValueChange={setOverallResult}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Pass" id="result-pass" />
                  <Label htmlFor="result-pass" className="font-normal cursor-pointer text-green-600">
                    Pass
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Fail" id="result-fail" />
                  <Label htmlFor="result-fail" className="font-normal cursor-pointer text-red-600">
                    Fail
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setGenerateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
                onClick={handleConfirmGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
