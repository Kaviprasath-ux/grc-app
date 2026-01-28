"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
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
} from "lucide-react";

interface RecentSearch {
  id: string;
  query: string;
  result: string | null;
  status: string;
  createdAt: string;
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
}

interface DocumentsResponse {
  policies: Document[];
  regulations: Document[];
  auditReports: Document[];
  policiesCount: number;
  regulationsCount: number;
  auditReportsCount: number;
}

export default function DocumentLibraryPage() {
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
  }, [fetchDocuments, fetchRecentSearches]);

  const handleSmartSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a query");
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
        toast.success("Search completed");
        setQuery("");
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(err?.error ?? "Search failed");
      }
    } catch (error) {
      toast.error("Search failed");
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
      }
      toast.success(`File${files.length > 1 ? "s" : ""} uploaded successfully`);
      fetchDocuments();
    } catch (error) {
      toast.error("Failed to upload file");
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
        toast.success("Document deleted successfully");
        fetchDocuments();
      } else {
        toast.error("Failed to delete document");
      }
    } catch (error) {
      toast.error("Failed to delete document");
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
            ? "border-blue-500 bg-blue-50"
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
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-gray-500">Uploading...</span>
          </div>
        ) : (
          <p className="text-gray-500">
            Click here, or drop files here to upload.
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
        <div className="flex items-center justify-end gap-2 mt-4 text-sm text-gray-600">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            {startIndex + 1} to {endIndex} of {items.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
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
          <p>No documents uploaded yet</p>
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
              </div>
              <div className="flex items-center gap-2">
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
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-blue-900">Document Library</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-0">
          <TabsTrigger
            value="smart-search"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-t-lg rounded-b-none px-6 py-2.5"
          >
            Smart Search
          </TabsTrigger>
          <TabsTrigger
            value="policies"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-t-lg rounded-b-none px-6 py-2.5"
          >
            Company&apos;s Policies and Procedures
          </TabsTrigger>
          <TabsTrigger
            value="regulations"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-t-lg rounded-b-none px-6 py-2.5"
          >
            Standard Regulations
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-t-lg rounded-b-none px-6 py-2.5"
          >
            Previous Audit Reports
          </TabsTrigger>
        </TabsList>

        {/* Smart Search Tab */}
        <TabsContent value="smart-search" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                Smart Document Query
              </h3>
              <div className="flex gap-4">
                <Textarea
                  placeholder="Enter your question here"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 resize-none min-h-[80px]"
                  rows={3}
                />
                <Button
                  onClick={handleSmartSearch}
                  disabled={searching || !query.trim()}
                  className="bg-blue-600 hover:bg-blue-700 h-auto px-4"
                >
                  {searching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Searches */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                Recent Searches
              </h3>
              {recentSearches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No recent searches</p>
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
                            <span className="text-xs text-blue-600 whitespace-nowrap">
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
        <TabsContent value="policies" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                Company&apos;s Policies and Procedures
              </h3>
              {renderUploadArea("Policy")}
              {renderDocumentList(documents.policies, policyPage, setPolicyPage)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Standard Regulations Tab */}
        <TabsContent value="regulations" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                Standard Regulations
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
        <TabsContent value="reports" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                Previous Audit Reports
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
