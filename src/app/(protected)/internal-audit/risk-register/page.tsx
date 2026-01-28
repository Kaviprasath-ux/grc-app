"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown, Eye, Search, Download, Upload, X, FileText, Sparkles, Loader2, Calendar, Target, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Department {
  id: string;
  name: string;
}

interface RecommendedAudit {
  id: string;
  auditName: string;
  department: string;
  riskLevel: string;
  justification: string;
  suggestedScope: string;
  relatedRisks: string[];
  priority: 'High' | 'Medium' | 'Low';
  estimatedDuration: string;
}

interface AIRecommendationsResponse {
  recommendations: RecommendedAudit[];
  summary: {
    totalRisks: number;
    extremeRisks: number;
    highRisks: number;
    departmentsAnalyzed: number;
    recommendationsGenerated: number;
  };
  generatedAt: string;
}

interface AuditCategory {
  id: string;
  name: string;
}

interface InternalAuditRisk {
  id: string;
  riskId: string;
  riskName: string;
  riskDescription: string | null;
  departmentId: string | null;
  department: Department | null;
  categoryId: string | null;
  category: AuditCategory | null;
  creationDate: string;
  inherentScore: number | null;
  residualScore: number | null;
  riskLevel: string | null;
  status: string;
}

export default function RiskRegisterPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [risks, setRisks] = useState<InternalAuditRisk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Check if user has read-only role (DepartmentReviewer or DepartmentContributor)
  // These roles should see the page in read-only mode per UAT requirements
  const isReadOnlyRole = session?.user?.roles?.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  ) ?? false;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InternalAuditRisk | null>(null);

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // AI Recommendations dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendationsResponse | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Generate year options (current year + 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchDepartments();
    fetchRisks();
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [yearFilter, departmentFilter, searchFilter]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchRisks = async () => {
    try {
      const params = new URLSearchParams();
      if (yearFilter && yearFilter !== "all") params.append("year", yearFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await fetch(`/api/internal-audit/risks?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (item: InternalAuditRisk) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/risks/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchRisks();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/internal-audit/risks/export");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `risk-register-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/internal-audit/risks/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        fetchRisks();
        setImportDialogOpen(false);
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Failed to import:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    event.target.value = "";
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/internal-audit/risks/template");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "risk-import-template.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to download template:", error);
    }
  };

  const fetchAIRecommendations = async () => {
    setLoadingAI(true);
    setAiDialogOpen(true);
    try {
      const response = await fetch("/api/internal-audit/risks/ai-recommended-audits");
      if (response.ok) {
        const data = await response.json();
        setAiRecommendations(data);
      }
    } catch (error) {
      console.error("Failed to fetch AI recommendations:", error);
    } finally {
      setLoadingAI(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      High: "destructive",
      Medium: "default",
      Low: "secondary",
    };
    return <Badge variant={variants[priority] || "outline"}>{priority}</Badge>;
  };

  const getRiskLevelBadge = (level: string | null) => {
    if (!level) return null;

    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Low: "secondary",
      Medium: "default",
      High: "destructive",
      Extreme: "destructive",
    };

    return <Badge variant={variants[level] || "outline"}>{level}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Open: "default",
      Closed: "secondary",
      "Under Review": "outline",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">Risk Register</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">Risk Register</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchAIRecommendations}
            className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 hover:from-purple-600 hover:to-blue-600"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Recommended Audits
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {!isReadOnlyRole && (
            <>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => router.push("/internal-audit/risk-register/add")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Risk Manually
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Select value={yearFilter} onValueChange={setYearFilter} disabled={isReadOnlyRole}>
              <SelectTrigger disabled={isReadOnlyRole}>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isReadOnlyRole}>
              <SelectTrigger disabled={isReadOnlyRole}>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Risk ID, Name, or Description..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-10"
                disabled={isReadOnlyRole}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risk ID</TableHead>
              <TableHead>Risk Description</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Creation Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Inherent Score</TableHead>
              <TableHead>Residual Score</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((risk) => (
              <TableRow key={risk.id}>
                <TableCell className="font-medium">{risk.riskId}</TableCell>
                <TableCell className="max-w-[200px] truncate">{risk.riskDescription || risk.riskName}</TableCell>
                <TableCell>{risk.department?.name || "-"}</TableCell>
                <TableCell>{formatDate(risk.creationDate)}</TableCell>
                <TableCell>{risk.category?.name || "-"}</TableCell>
                <TableCell>{risk.inherentScore ?? "-"}</TableCell>
                <TableCell>{risk.residualScore ?? "-"}</TableCell>
                <TableCell>{getRiskLevelBadge(risk.riskLevel)}</TableCell>
                <TableCell>{getStatusBadge(risk.status)}</TableCell>
                <TableCell>
                  {!isReadOnlyRole && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/internal-audit/risk-register/${risk.id}`)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/internal-audit/risk-register/${risk.id}/edit`)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(risk)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {risks.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {isReadOnlyRole ? "No risks found." : "No risks found. Click \"Add Risk Manually\" to create your first risk."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination info */}
        <div className="flex items-center justify-end p-4 border-t text-sm text-muted-foreground">
          Currently showing 1 to {risks.length} of {risks.length}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this risk?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>OK</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-blue-900">Risk Import File Upload</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* File Upload */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium min-w-[100px]">Upload File</label>
              <div className="flex-1 flex items-center gap-2">
                <Input
                  readOnly
                  value={selectedFile?.name || ""}
                  placeholder=""
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("import-file-input")?.click()}
                >
                  Browse...
                </Button>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
              <Button
                onClick={handleDownloadTemplate}
                className="bg-blue-900 hover:bg-blue-800"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Import Template
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || importing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {importing ? "Importing..." : "Import"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false);
                    setSelectedFile(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Recommended Audits Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Recommended Audits
            </DialogTitle>
          </DialogHeader>

          {loadingAI ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
              <p className="text-muted-foreground">Analyzing risks and generating recommendations...</p>
            </div>
          ) : aiRecommendations ? (
            <div className="space-y-6 py-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{aiRecommendations.summary.totalRisks}</p>
                  <p className="text-xs text-blue-600">Total Risks</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{aiRecommendations.summary.extremeRisks}</p>
                  <p className="text-xs text-red-600">Extreme Risks</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{aiRecommendations.summary.highRisks}</p>
                  <p className="text-xs text-orange-600">High Risks</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{aiRecommendations.summary.recommendationsGenerated}</p>
                  <p className="text-xs text-purple-600">Recommendations</p>
                </div>
              </div>

              {/* Recommendations List */}
              {aiRecommendations.recommendations.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-700">Recommended Audits</h3>
                  {aiRecommendations.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-medium px-2 py-1 rounded">
                            {rec.id}
                          </div>
                          <h4 className="font-semibold text-gray-900">{rec.auditName}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(rec.priority)}
                          {getRiskLevelBadge(rec.riskLevel)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Target className="h-4 w-4" />
                          <span>Department: <strong>{rec.department}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>Duration: <strong>{rec.estimatedDuration}</strong></span>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded p-3 mb-3">
                        <p className="text-sm text-gray-700">
                          <strong className="text-gray-900">Justification:</strong> {rec.justification}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="text-gray-600 mb-2">
                          <strong>Suggested Scope:</strong> {rec.suggestedScope}
                        </p>
                        {rec.relatedRisks.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span className="text-gray-500">Related Risks:</span>
                            {rec.relatedRisks.map((riskId) => (
                              <Badge key={riskId} variant="outline" className="text-xs">
                                {riskId}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => {
                            router.push(`/internal-audit/audit-plan?suggested=${encodeURIComponent(rec.auditName)}&department=${encodeURIComponent(rec.department)}`);
                            setAiDialogOpen(false);
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create Audit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No audit recommendations at this time.</p>
                  <p className="text-sm mt-2">Add more risks to the register to generate AI recommendations.</p>
                </div>
              )}

              <div className="text-xs text-gray-400 text-right">
                Generated at: {new Date(aiRecommendations.generatedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Failed to load recommendations. Please try again.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
