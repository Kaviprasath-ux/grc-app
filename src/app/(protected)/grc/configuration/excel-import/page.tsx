"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function ExcelImportPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Upload className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">Excel Import/Export</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Excel Import Configuration</CardTitle>
          <CardDescription>
            Configure Excel import settings and manage data imports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Upload className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Excel Import/Export configuration coming soon.</p>
            <p className="text-sm mt-2">This feature will allow you to import and export data via Excel files.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
