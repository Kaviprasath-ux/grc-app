"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Send,
  Clock,
  FileText,
  Upload,
  Download,
  Loader2,
} from "lucide-react";

interface RecentSearch {
  id: string;
  query: string;
  timestamp: Date;
  result?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: Date;
  size: string;
}

export default function DocumentLibraryPage() {
  const [activeTab, setActiveTab] = useState("smart-search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem("documentLibrarySearches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const handleSmartSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a query");
      return;
    }

    setSearching(true);
    try {
      // Simulate AI document search
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        query: query,
        timestamp: new Date(),
        result: `The retrieved document content mentions various aspects related to "${query}". Specific references include internal audit procedures, compliance requirements, and governance frameworks. Please refine your query for more specific results.`
      };

      const updatedSearches = [newSearch, ...recentSearches].slice(0, 10);
      setRecentSearches(updatedSearches);
      localStorage.setItem("documentLibrarySearches", JSON.stringify(updatedSearches));

      toast.success("Search completed");
      setQuery("");
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const renderDocumentList = (type: string) => {
    const filteredDocs = documents.filter(d => d.type === type);

    if (filteredDocs.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No documents found</p>
          <p className="text-sm mt-2">Upload documents to see them here</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDocs.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  {doc.name}
                </div>
              </TableCell>
              <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
              <TableCell>{doc.size}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-blue-900">Document Library</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="smart-search" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Smart Search
          </TabsTrigger>
          <TabsTrigger value="policies">
            Company's Policies and Procedures
          </TabsTrigger>
          <TabsTrigger value="regulations">
            Standard Regulations
          </TabsTrigger>
          <TabsTrigger value="reports">
            Previous Audit Reports
          </TabsTrigger>
        </TabsList>

        {/* Smart Search Tab */}
        <TabsContent value="smart-search" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">Smart Document Query</h3>
              <div className="flex gap-4">
                <Textarea
                  placeholder="Enter your question here"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 resize-none"
                  rows={3}
                />
                <Button
                  onClick={handleSmartSearch}
                  disabled={searching || !query.trim()}
                  className="bg-blue-600 hover:bg-blue-700 h-auto"
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
          {recentSearches.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-4">Recent Searches</h3>
                <div className="space-y-4">
                  {recentSearches.map((search) => (
                    <div key={search.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{search.query}</p>
                            <span className="text-xs text-gray-500">
                              {formatDate(search.timestamp)}
                            </span>
                          </div>
                          {search.result && (
                            <p className="text-sm text-gray-600 mt-2">{search.result}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Company Policies Tab */}
        <TabsContent value="policies">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-800">Company's Policies and Procedures</h3>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>
              {renderDocumentList("policy")}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Standard Regulations Tab */}
        <TabsContent value="regulations">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-800">Standard Regulations</h3>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>
              {renderDocumentList("regulation")}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Previous Audit Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-800">Previous Audit Reports</h3>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>
              {renderDocumentList("report")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
