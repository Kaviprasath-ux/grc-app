"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: Date;
  result?: string;
}

export default function RiskIdentificationPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [auditFocus, setAuditFocus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    fetchDepartments();
    // Load recent searches from localStorage
    const saved = localStorage.getItem("riskIdentificationSearches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleSuggestRisks = async () => {
    if (!selectedDepartment) {
      toast.error("Please select a department first");
      return;
    }

    setLoading(true);
    try {
      // Simulate AI risk suggestion (in a real app, this would call an AI API)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const deptName = departments.find(d => d.id === selectedDepartment)?.name || "Unknown";
      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        query: `${deptName}${auditFocus ? ` - ${auditFocus}` : ""}`,
        timestamp: new Date(),
        result: `AI analysis for ${deptName}. Based on industry standards and common risk patterns, suggested risks include: compliance risk, operational risk, and strategic risk.`
      };

      const updatedSearches = [newSearch, ...recentSearches].slice(0, 10);
      setRecentSearches(updatedSearches);
      localStorage.setItem("riskIdentificationSearches", JSON.stringify(updatedSearches));

      toast.success("Risk suggestions generated successfully");
    } catch (error) {
      toast.error("Failed to generate risk suggestions");
    } finally {
      setLoading(false);
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

  if (pageLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-900 mb-6">Risk Identification</h1>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-900">Risk Identification</h1>
        <Button
          variant="link"
          className="text-blue-600"
          onClick={() => router.push("/internal-audit/risk-register")}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI-Powered Risk Assessment
        </Button>
      </div>

      {/* Main Form Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Department Selection */}
          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Select a Department to Assess
            </label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Specific Audit Focus */}
          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Specific Audit Focus (Optional)
            </label>
            <Textarea
              placeholder="Describe specific areas or processes to focus on..."
              value={auditFocus}
              onChange={(e) => setAuditFocus(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* File Upload Area - Placeholder */}
          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Supporting Documents (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500">
              <p>Drag and drop files here or click to upload</p>
              <p className="text-xs mt-1">Supported formats: PDF, DOC, DOCX, XLS, XLSX</p>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSuggestRisks}
            disabled={loading || !selectedDepartment}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Suggest Risks with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-blue-800 mb-4">Recent Searches</h3>
            <div className="space-y-3">
              {recentSearches.map((search) => (
                <div key={search.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-gray-400" />
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
    </div>
  );
}
