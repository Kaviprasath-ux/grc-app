"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function PdfReportConfigPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">PDF Report Configuration</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF Report Settings</CardTitle>
          <CardDescription>
            Configure PDF report templates, styling, and generation settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>PDF Report configuration coming soon.</p>
            <p className="text-sm mt-2">This feature will allow you to configure report templates and export settings.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
