"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  FolderOpen,
  FileText,
  Upload,
  Download,
} from "lucide-react";

export default function DocumentLibraryPage() {
  const router = useRouter();

  const stats = {
    total: 0,
    templates: 0,
    workpapers: 0,
    reports: 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Library</h1>
          <p className="text-gray-500 mt-1">
            Manage audit documents and templates
          </p>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
          <Upload className="h-4 w-4 mr-1" />
          Upload Document
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Documents</CardTitle>
            <FolderOpen className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Templates</CardTitle>
            <FileText className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.templates}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Workpapers</CardTitle>
            <FileText className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.workpapers}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Reports</CardTitle>
            <Download className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reports}</div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <Card>
        <div className="p-8 text-center text-gray-500">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No documents uploaded yet</p>
          <p className="text-sm mt-2">
            Upload audit templates, workpapers, and reports
          </p>
        </div>
      </Card>
    </div>
  );
}
