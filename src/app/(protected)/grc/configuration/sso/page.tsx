"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Key } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SsoConfigPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Key className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-blue-700">{t("SSO Configuration")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Single Sign-On Settings")}</CardTitle>
          <CardDescription>
            {t("Configure SSO providers, SAML settings, and authentication options.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Key className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>{t("SSO configuration coming soon.")}</p>
            <p className="text-sm mt-2">{t("This feature will allow you to configure Single Sign-On with various identity providers.")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
