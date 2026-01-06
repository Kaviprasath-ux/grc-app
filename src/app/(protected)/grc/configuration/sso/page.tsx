"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Key } from "lucide-react";

export default function SsoConfigPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Key className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">SSO Configuration</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Single Sign-On Settings</CardTitle>
          <CardDescription>
            Configure SSO providers, SAML settings, and authentication options.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Key className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>SSO configuration coming soon.</p>
            <p className="text-sm mt-2">This feature will allow you to configure Single Sign-On with various identity providers.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
