"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Send,
  Clock,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";

interface RecentSearch {
  id: string;
  query: string;
  result: string | null;
  status: string;
  createdAt: string;
}

interface IngestJob {
  id: string;
  documentId: string;
  runpodJobId: string;
  status: string;
  error: string | null;
  completedAt: string | null;
}

interface Document {
  id: string;
  documentCode: string;
  name: string;
  description: string | null;
  category: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedAt: string;
  ingestJobs?: IngestJob[];
}

interface DocumentsResponse {
  policies: Document[];
  regulations: Document[];
  auditReports: Document[];
  policiesCount: number;
  regulationsCount: number;
  auditReportsCount: number;
}

// Polling interval in milliseconds
const POLLING_INTERVAL = 3000;

export default function DocumentLibraryPage() {
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [activeTab, setActiveTab] = useState("smart-search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [documents, setDocuments] = useState<DocumentsResponse>({
    policies: [],
    regulations: [],
    auditReports: [],
    policiesCount: 0,
    regulationsCount: 0,
    auditReportsCount: 0,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<string | null>(null);

  // Ingestion state
  const [ingestingDocs, setIngestingDocs] = useState<Set<string>>(new Set());
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Pagination states for each tab
  const [policyPage, setPolicyPage] = useState(1);
  const [regulationPage, setRegulationPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const itemsPerPage = 10;

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/internal-audit/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  }, []);

  const fetchRecentSearches = useCallback(async () => {
    try {
      const response = await fetch("/api/internal-audit/documents/recent-searches");
      if (response.ok) {
        const data = await response.json();
        setRecentSearches(data);
      }
    } catch (error) {
      console.error("Error fetching recent searches:", error);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchRecentSearches();

    // Cleanup polling on unmount
    return () => {
      pollingRef.current.forEach((timer) => clearTimeout(timer));
      pollingRef.current.clear();
    };
  }, [fetchDocuments, fetchRecentSearches]);

  // Poll for ingestion status
  const pollIngestStatus = useCallback(async (jobId: string, documentId: string) => {
    try {
      const response = await fetch(`/api/internal-audit/documents/ingest-status/${jobId}`);
      if (!response.ok) {
        console.error("Failed to poll ingest status:", await response.text());
        return;
      }

      const data = await response.json();
      const status = data.status?.toLowerCase();

      if (status === 'completed') {
        // Ingestion completed
        setIngestingDocs(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });

        // Clear polling timer
        const timer = pollingRef.current.get(jobId);
        if (timer) {
          clearTimeout(timer);
          pollingRef.current.delete(jobId);
        }

        toast.success(t("Document ingested successfully"));
        fetchDocuments(); // Refresh to get updated status
      } else if (status === 'failed') {
        // Ingestion failed
        setIngestingDocs(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });

        // Clear polling timer
        const timer = pollingRef.current.get(jobId);
        if (timer) {
          clearTimeout(timer);
          pollingRef.current.delete(jobId);
        }

        toast.error(data.error || t("Document ingestion failed"));
        fetchDocuments();
      } else {
        // Still processing - continue polling
        const timer = setTimeout(() => pollIngestStatus(jobId, documentId), POLLING_INTERVAL);
        pollingRef.current.set(jobId, timer);
      }
    } catch (error) {
      console.error("Error polling ingest status:", error);
      // Retry polling on error
      const timer = setTimeout(() => pollIngestStatus(jobId, documentId), POLLING_INTERVAL);
      pollingRef.current.set(jobId, timer);
    }
  }, [t, fetchDocuments]);

  // Trigger document ingestion
  const triggerIngest = useCallback(async (documentIds: string[]) => {
    if (documentIds.length === 0) return;

    // Mark documents as ingesting
    setIngestingDocs(prev => {
      const next = new Set(prev);
      documentIds.forEach(id => next.add(id));
      return next;
    });

    try {
      const response = await fetch("/api/internal-audit/documents/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Ingestion failed");
      }

      const data = await response.json();
      const jobId = data.job_id;

      if (jobId) {
        // Start polling for status
        const timer = setTimeout(() => {
          documentIds.forEach(docId => pollIngestStatus(jobId, docId));
        }, POLLING_INTERVAL);
        pollingRef.current.set(jobId, timer);

        toast.success(t("Document ingestion started"));
      }
    } catch (error) {
      // Remove from ingesting state on error
      setIngestingDocs(prev => {
        const next = new Set(prev);
        documentIds.forEach(id => next.delete(id));
        return next;
      });
      toast.error(error instanceof Error ? error.message : t("Failed to start ingestion"));
    }
  }, [t, pollIngestStatus]);

  const handleSmartSearch = async () => {
    if (!query.trim()) {
      toast.error(t("Please enter a query"));
      return;
    }

    setSearching(true);
    try {
      const response = await fetch("/api/internal-audit/documents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        await fetchRecentSearches();
        toast.success(t("Search completed"));
        setQuery("");
      } else {
        toast.error(t("Search failed"));
      }
    } catch (error) {
      toast.error(t("Search failed"));
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSmartSearch();
    }
  };

  const handleFileUpload = async (files: FileList | null, category: string) => {
    if (!files || files.length === 0) return;

    setUploading(category);
    const uploadedDocIds: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", category);
        formData.append("name", file.name);

        const response = await fetch("/api/internal-audit/documents", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const doc = await response.json();
        uploadedDocIds.push(doc.id);
      }

      toast.success(files.length > 1 ? t("Files uploaded successfully") : t("File uploaded successfully"));
      await fetchDocuments();

      // Trigger ingestion for uploaded documents
      if (uploadedDocIds.length > 0) {
        triggerIngest(uploadedDocIds);
      }
    } catch (error) {
      toast.error(t("Failed to upload file"));
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/internal-audit/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("Document deleted successfully"));
        fetchDocuments();
      } else {
        toast.error(t("Failed to delete document"));
      }
    } catch (error) {
      toast.error(t("Failed to delete document"));
    }
  };

  const handleDownload = (doc: Document) => {
    // Use the download API endpoint instead of direct file path
    window.open(`/api/internal-audit/documents/${doc.id}/download`, "_blank");
  };

  const handleDrag = (e: React.DragEvent, category: string, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active ? category : null);
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    handleFileUpload(e.dataTransfer.files, category);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getFileIcon = (fileType: string | null) => {
    const type = fileType?.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(type || "")) {
      return <FileImage className="h-5 w-5 text-blue-500" />;
    }
    if (["xls", "xlsx", "csv"].includes(type || "")) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    }
    if (["pdf", "doc", "docx", "txt"].includes(type || "")) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const getIngestStatusIcon = (doc: Document) => {
    const isIngesting = ingestingDocs.has(doc.id);

    if (isIngesting) {
      return (
        <div className="flex items-center gap-1 text-blue-500" title={t("Ingesting...")}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">{t("Ingesting")}</span>
        </div>
      );
    }

    // Check if document has been ingested (has completed job)
    if (doc.ingestJobs && doc.ingestJobs.length > 0) {
      const latestJob = doc.ingestJobs[0];
      if (latestJob.status === 'completed') {
        return (
          <div className="flex items-center gap-1 text-green-500" title={t("Ingested")}>
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">{t("Ingested")}</span>
          </div>
        );
      } else if (latestJob.status === 'failed') {
        return (
          <div className="flex items-center gap-1 text-red-500" title={latestJob.error || t("Ingestion failed")}>
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">{t("Failed")}</span>
          </div>
        );
      }
    }

    return null;
  };

  const renderUploadArea = (category: string) => {
    const categoryMap: Record<string, string> = {
      Policy: "policies",
      Regulation: "regulations",
      PreviousReport: "reports",
    };
    const isActive = dragActive === category;
    const isUploading = uploading === category;

    return (
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isActive
            ? "border-primary-500 bg-primary-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragEnter={(e) => handleDrag(e, category, true)}
        onDragLeave={(e) => handleDrag(e, category, false)}
        onDragOver={(e) => handleDrag(e, category, true)}
        onDrop={(e) => handleDrop(e, category)}
        onClick={() => {
          const input = document.getElementById(`file-input-${categoryMap[category]}`);
          input?.click();
        }}
      >
        <input
          id={`file-input-${categoryMap[category]}`}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, category)}
        />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            <span className="text-gray-500">{t("Uploading...")}</span>
          </div>
        ) : (
          <p className="text-gray-500">
            {t("Click here, or drop files here to upload.")}
          </p>
        )}
      </div>
    );
  };

  const renderPagination = (
    items: Document[],
    currentPage: number,
    setPage: (page: number) => void
  ) => {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      pagination: items.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-slate-500">
            {startIndex + 1} to {endIndex} of {items.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 w-8"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ),
    };
  };

  const renderDocumentList = (
    categoryDocs: Document[],
    currentPage: number,
    setPage: (page: number) => void
  ) => {
    const { items, pagination } = renderPagination(categoryDocs, currentPage, setPage);

    if (categoryDocs.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>{t("No documents uploaded yet")}</p>
        </div>
      );
    }

    return (
      <>
        {pagination}
        <div className="space-y-2 mt-4">
          {items.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(doc.fileType)}
                <span className="text-gray-700">{doc.fileName}</span>
                {getIngestStatusIcon(doc)}
              </div>
              <div className="flex items-center gap-2">
                {/* Re-ingest button for failed or not ingested documents */}
                {!ingestingDocs.has(doc.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => triggerIngest([doc.id])}
                    className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                    title={t("Ingest Document")}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Document Library")}</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-800">{t("Document Library")}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="smart-search">{t("Smart Search")}</TabsTrigger>
          <TabsTrigger value="policies">{t("Company's Policies and Procedures")}</TabsTrigger>
          <TabsTrigger value="regulations">{t("Standard Regulations")}</TabsTrigger>
          <TabsTrigger value="reports">{t("Previous Audit Reports")}</TabsTrigger>
        </TabsList>

        {/* Smart Search Tab */}
        <TabsContent value="smart-search" className="space-y-6">
          {/* Smart Document Query */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              {t("Smart Document Query")}
            </h3>
            <div className="relative">
              <Textarea
                placeholder={t("Enter your question here")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="resize-none min-h-[120px] bg-white border-slate-200 pr-14 pb-12"
                rows={4}
              />
              <Button
                onClick={handleSmartSearch}
                disabled={searching || !query.trim()}
                className="absolute bottom-3 right-3 bg-primary-600 hover:bg-primary-700 h-9 w-9 p-0 rounded-lg"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Recent Searches */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {t("Recent Searches")}
              </h3>
              {recentSearches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>{t("No recent searches")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentSearches.map((search) => (
                    <div
                      key={search.id}
                      className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-medium text-gray-900 truncate">
                              {search.query}
                            </p>
                            <span className="text-xs text-primary-600 whitespace-nowrap">
                              {formatDate(search.createdAt)}
                            </span>
                          </div>
                          {search.result && (
                            <p
                              className={`text-sm mt-2 ${
                                search.status === "Unsatisfactory"
                                  ? "text-amber-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {search.result}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Policies Tab */}
        <TabsContent value="policies">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {t("Company's Policies and Procedures")}
              </h3>
              {renderUploadArea("Policy")}
              {renderDocumentList(documents.policies, policyPage, setPolicyPage)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Standard Regulations Tab */}
        <TabsContent value="regulations">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {t("Standard Regulations")}
              </h3>
              {renderUploadArea("Regulation")}
              {renderDocumentList(
                documents.regulations,
                regulationPage,
                setRegulationPage
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Previous Audit Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {t("Previous Audit Reports")}
              </h3>
              {renderUploadArea("PreviousReport")}
              {renderDocumentList(
                documents.auditReports,
                reportPage,
                setReportPage
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
