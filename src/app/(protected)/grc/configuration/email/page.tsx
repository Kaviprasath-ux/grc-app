"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function EmailConfigPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">Email Configuration</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Settings</CardTitle>
          <CardDescription>
            Configure email server settings, templates, and notification preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Mail className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Email configuration coming soon.</p>
            <p className="text-sm mt-2">This feature will allow you to configure SMTP settings and email templates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
