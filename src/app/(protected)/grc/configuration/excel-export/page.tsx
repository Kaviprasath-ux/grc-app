"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download } from "lucide-react";

export default function ExcelExportPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Download className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">Excel Exporting</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Excel Export Configuration</CardTitle>
          <CardDescription>
            Configure Excel export settings and templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Download className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Excel Exporting configuration coming soon.</p>
            <p className="text-sm mt-2">This feature will allow you to configure export templates and settings.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
