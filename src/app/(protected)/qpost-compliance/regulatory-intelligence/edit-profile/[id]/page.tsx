"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  COUNTRIES,
  INDUSTRY_SECTORS,
  ORGANISATION_TYPES,
  TIMEZONES,
  LANGUAGES,
  BUSINESS_MODELS,
  TARGET_AUDIENCES,
  TECHNOLOGIES,
} from "@/lib/regulatory-intelligence-data";

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function EditProfilePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [fullLegalEntityName, setFullLegalEntityName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [url, setUrl] = useState("");
  const [country, setCountry] = useState("");

  const [industrySectors, setIndustrySectors] = useState<string[]>([]);
  const [otherIndustry, setOtherIndustry] = useState("");
  const [organisationType, setOrganisationType] = useState("");
  const [countriesOfOperation, setCountriesOfOperation] = useState<string[]>([]);

  const [headquarterAddress, setHeadquarterAddress] = useState("");
  const [adminContactEmail, setAdminContactEmail] = useState("");

  const [timeZone, setTimeZone] = useState("");
  const [language, setLanguage] = useState("");

  const [businessModel, setBusinessModel] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [technologyUsed, setTechnologyUsed] = useState<string[]>([]);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`/api/qpost-compliance/regulatory-intelligence/profiles/${profileId}`);
        if (!res.ok) throw new Error("Failed to load profile");
        const json = await res.json();
        const p = json.data;

        setFullLegalEntityName(p.fullLegalEntityName || "");
        setRegistrationNo(p.registrationNo || "");
        setUrl(p.url || "");
        setCountry(p.country || "");
        setIndustrySectors(parseJsonArray(p.industrySectors));
        setOtherIndustry(p.otherIndustry || "");
        setOrganisationType(p.organisationType || "");
        setCountriesOfOperation(parseJsonArray(p.countriesOfOperation));
        setHeadquarterAddress(p.headquarterAddress || "");
        setAdminContactEmail(p.adminContactEmail || "");
        setTimeZone(p.timeZone || "");
        setLanguage(p.language || "");
        setBusinessModel(p.businessModel || "");
        setTargetAudience(parseJsonArray(p.targetAudience));
        setTechnologyUsed(parseJsonArray(p.technologyUsed));
      } catch {
        toast({
          title: t("Error"),
          description: t("Failed to load profile"),
          variant: "destructive",
        });
        router.push("/qpost-compliance/regulatory-intelligence");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [profileId, router, toast, t]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!fullLegalEntityName.trim()) {
      newErrors.fullLegalEntityName = "Full Legal Entity Name is required";
    }
    if (registrationNo.trim() && !/^[a-zA-Z0-9\-/]+$/.test(registrationNo)) {
      newErrors.registrationNo = "Registration No must be alphanumeric";
    }
    if (!url.trim()) {
      newErrors.url = "URL is required";
    } else if (!/^https?:\/\/.+\..+/.test(url)) {
      newErrors.url = "Please enter a valid URL (e.g., https://example.com)";
    }
    if (!country) {
      newErrors.country = "Country is required";
    }
    if (adminContactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminContactEmail)) {
      newErrors.adminContactEmail = "Please enter a valid email address";
    }
    if (industrySectors.length === 0) {
      newErrors.industrySectors = "At least one industry/sector is required";
    }
    if (industrySectors.includes("Other") && !otherIndustry.trim()) {
      newErrors.otherIndustry = "Please specify the other industry";
    }
    if (!organisationType) {
      newErrors.organisationType = "Organisation Type is required";
    }
    if (countriesOfOperation.length === 0) {
      newErrors.countriesOfOperation = "At least one country of operation is required";
    }
    if (!businessModel) {
      newErrors.businessModel = "Business Model is required";
    }
    if (technologyUsed.length === 0) {
      newErrors.technologyUsed = "At least one technology is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegistrationNoChange = (value: string) => {
    const filtered = value.replace(/[^a-zA-Z0-9\-/]/g, "");
    setRegistrationNo(filtered);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Step 1: Update the profile
      const res = await fetch(`/api/qpost-compliance/regulatory-intelligence/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullLegalEntityName,
          registrationNo,
          url,
          country,
          industrySectors,
          otherIndustry: industrySectors.includes("Other") ? otherIndustry : null,
          organisationType,
          countriesOfOperation,
          headquarterAddress,
          adminContactEmail,
          timeZone,
          language,
          businessModel,
          targetAudience,
          technologyUsed,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      toast({
        title: t("Success"),
        description: t("Organisation profile updated successfully"),
      });

      // Step 2: Call AI service to refresh regulations (fire and forget with notification)
      toast({
        title: t("Analyzing"),
        description: t("AI is re-analyzing your organisation profile for applicable regulations..."),
      });

      fetch("/api/qpost-compliance/regulatory-intelligence/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      })
        .then(async (suggestRes) => {
          if (suggestRes.ok) {
            const result = await suggestRes.json();
            toast({
              title: t("Regulations Updated"),
              description: `${result.count} ${t("applicable regulations have been identified.")}`,
            });
          }
        })
        .catch((err) => {
          console.error("Error suggesting regulations:", err);
        });

      router.push("/qpost-compliance/regulatory-intelligence");
    } catch (error) {
      toast({
        title: t("Error"),
        description: error instanceof Error ? error.message : t("Failed to update profile"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const industryOptions = INDUSTRY_SECTORS.map((s) => ({ value: s, label: s }));
  const countryOptions = COUNTRIES.map((c) => ({ value: c, label: c }));
  const targetAudienceOptions = TARGET_AUDIENCES.map((a) => ({ value: a, label: a }));
  const technologyOptions = TECHNOLOGIES.map((t) => ({ value: t, label: t }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/qpost-compliance/regulatory-intelligence")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("Edit Organisation Profile")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("Update your organisation's regulatory context and business details")}
            </p>
          </div>
        </div>
      </div>

      {/* Legal Identity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Legal Identity")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullLegalEntityName">{t("Full Legal Entity Name")} <span className="text-red-500">*</span></Label>
            <Input
              id="fullLegalEntityName"
              value={fullLegalEntityName}
              onChange={(e) => setFullLegalEntityName(e.target.value)}
              placeholder={t("Enter full legal entity name")}
            />
            {errors.fullLegalEntityName && (
              <p className="text-sm text-red-500">{t(errors.fullLegalEntityName)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="registrationNo">{t("Registration No")}</Label>
            <Input
              id="registrationNo"
              value={registrationNo}
              onChange={(e) => handleRegistrationNoChange(e.target.value)}
              placeholder={t("Enter registration number")}
            />
            {errors.registrationNo && (
              <p className="text-sm text-red-500">{t(errors.registrationNo)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">{t("URL")} <span className="text-red-500">*</span></Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
            {errors.url && (
              <p className="text-sm text-red-500">{t(errors.url)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">{t("Country")} <span className="text-red-500">*</span></Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select country")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && (
              <p className="text-sm text-red-500">{t(errors.country)}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scope and Presence */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Scope and Presence")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("Industry/Sector")} <span className="text-red-500">*</span></Label>
            <MultiSelect
              options={industryOptions}
              selected={industrySectors}
              onChange={setIndustrySectors}
              placeholder={t("Select industries")}
            />
            {errors.industrySectors && (
              <p className="text-sm text-red-500">{t(errors.industrySectors)}</p>
            )}
          </div>

          {industrySectors.includes("Other") && (
            <div className="space-y-2">
              <Label htmlFor="otherIndustry">{t("Other")} <span className="text-red-500">*</span></Label>
              <Input
                id="otherIndustry"
                value={otherIndustry}
                onChange={(e) => setOtherIndustry(e.target.value)}
                placeholder={t("Specify other industry")}
              />
              {errors.otherIndustry && (
                <p className="text-sm text-red-500">{t(errors.otherIndustry)}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("Organisation Type")} <span className="text-red-500">*</span></Label>
            <Select value={organisationType} onValueChange={setOrganisationType}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select organisation type")} />
              </SelectTrigger>
              <SelectContent>
                {ORGANISATION_TYPES.map((ot) => (
                  <SelectItem key={ot} value={ot}>{ot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.organisationType && (
              <p className="text-sm text-red-500">{t(errors.organisationType)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("Countries of Operation")} <span className="text-red-500">*</span></Label>
            <MultiSelect
              options={countryOptions}
              selected={countriesOfOperation}
              onChange={setCountriesOfOperation}
              placeholder={t("Select countries")}
            />
            {errors.countriesOfOperation && (
              <p className="text-sm text-red-500">{t(errors.countriesOfOperation)}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Physical Presence */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Physical Presence")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="headquarterAddress">{t("Headquarter Address")}</Label>
            <Input
              id="headquarterAddress"
              value={headquarterAddress}
              onChange={(e) => setHeadquarterAddress(e.target.value)}
              placeholder={t("Enter headquarter address")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminContactEmail">{t("Email of Admin Contact")}</Label>
            <Input
              id="adminContactEmail"
              type="email"
              value={adminContactEmail}
              onChange={(e) => setAdminContactEmail(e.target.value)}
              placeholder={t("Enter admin contact email")}
            />
            {errors.adminContactEmail && (
              <p className="text-sm text-red-500">{t(errors.adminContactEmail)}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Regional Preference */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Regional Preference")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("Time Zone")}</Label>
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select time zone")} />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("Language")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select language")} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Business Context for AI */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Business Context for AI")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("Business Model")} <span className="text-red-500">*</span></Label>
            <Select value={businessModel} onValueChange={setBusinessModel}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select business model")} />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_MODELS.map((bm) => (
                  <SelectItem key={bm} value={bm}>{bm}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.businessModel && (
              <p className="text-sm text-red-500">{t(errors.businessModel)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("Target Audience")}</Label>
            <MultiSelect
              options={targetAudienceOptions}
              selected={targetAudience}
              onChange={setTargetAudience}
              placeholder={t("Select target audiences")}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>{t("Technology Used")} <span className="text-red-500">*</span></Label>
            <MultiSelect
              options={technologyOptions}
              selected={technologyUsed}
              onChange={setTechnologyUsed}
              placeholder={t("Select technologies")}
            />
            {errors.technologyUsed && (
              <p className="text-sm text-red-500">{t(errors.technologyUsed)}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {saving ? t("Saving...") : t("Update Profile")}
        </Button>
      </div>
    </div>
  );
}
