"use client";

import { useState } from "react";
import {
  ArrowLeft, ChevronRight, ChevronDown, Phone, Mail,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== TYPES ====================

interface HelpItem {
  title: string;
  children?: { title: string; description: string }[];
}

// ==================== DATA ====================

const NAVIGATIONAL_HELP: HelpItem[] = [
  {
    title: "Control Center",
    children: [
      { title: "Due Diligence Configuration", description: "Configure vendor risk rating thresholds and due diligence requirements for different risk categories." },
      { title: "Scorecard Thresholds", description: "Set up security posture and threat exposure score thresholds that determine vendor risk ratings." },
    ],
  },
  {
    title: "Configurations",
    children: [
      { title: "Vendor Onboarding", description: "Manage vendor profile fields and onboarding questionnaire used during vendor registration." },
      { title: "Service Categories", description: "Define service categories for vendor classification (e.g., IT Services, Cloud)." },
      { title: "Questionnaire Templates", description: "Create and manage assessment questionnaire templates for vendor evaluations." },
      { title: "Scorecard Configuration", description: "Configure the scoring formula and factor weightages for vendor security scorecards." },
    ],
  },
  {
    title: "Master Data Management",
    children: [
      { title: "Questions", description: "Manage the master question bank used across assessment questionnaires." },
      { title: "Questionnaires", description: "Link master questions to questionnaire templates for reuse across assessments." },
      { title: "Domains", description: "Define assessment domains (e.g., Information Security, Privacy, Business Continuity)." },
    ],
  },
  {
    title: "Application Data Management",
    children: [
      { title: "Vendor Management", description: "View and manage all vendor records, their risk profiles, and engagement details." },
      { title: "Assessment Workspace", description: "Manage active assessments, view results, and track assessment logs." },
      { title: "Task Queue", description: "Process pending assessment tasks, initiate reassessments, and handle returned items." },
    ],
  },
];

const FAQS = [
  { q: "How do I add a new vendor?", a: "Navigate to Vendor Management, click 'Add Vendor', fill in the vendor details including name, service category, and risk assessment information, then save." },
  { q: "How do I initiate a vendor assessment?", a: "Go to Assessment Workspace, click 'Initiate Assessment', select the vendor, choose a questionnaire template, and assign an assessor." },
  { q: "How are vendor risk ratings calculated?", a: "Vendor Risk Ratings (VRR) are calculated based on the security posture score and threat exposure score, weighted according to the scorecard configuration in Control Center." },
  { q: "How do I configure the scoring formula?", a: "Navigate to Configurations > Scorecard Configuration. You can choose between Average (AVG) and Weighted scoring formulas, and adjust the weightage for Security Posture and Threat Exposure factors." },
  { q: "Can I customize the onboarding questionnaire?", a: "Yes, go to Configurations > Vendor Onboarding > Onboarding Questions tab to add, edit, or remove questions from the onboarding questionnaire." },
  { q: "How do I export vendor data?", a: "Navigate to Vendor Management or Reports and click the 'Export' button to download vendor data as a CSV file." },
  { q: "What is the Task Queue?", a: "The Task Queue shows pending assessment tasks assigned to you. You can process assessments, initiate reassessments for expired evaluations, and handle returned assessment items." },
  { q: "How do I set up assessment domains?", a: "Go to Master Data Management > Domains to create and manage assessment domain categories used in questionnaires." },
];

// ==================== MAIN COMPONENT ====================

export default function SupportPage() {
  const { t, isRTL } = useLanguage();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (title: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("Support")}</h1>
        <p className="text-muted-foreground mt-1">{t("Get help and support for TPRM module")}</p>
      </div>

      <Tabs defaultValue="navigational-help">
        <TabsList>
          <TabsTrigger value="navigational-help">{t("Navigational Help")}</TabsTrigger>
          <TabsTrigger value="faqs">{t("FAQs")}</TabsTrigger>
          <TabsTrigger value="contact-us">{t("Contact Us")}</TabsTrigger>
        </TabsList>

        {/* Navigational Help */}
        <TabsContent value="navigational-help" className="mt-6">
          <div className="flex items-center justify-end gap-4 mb-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <ChevronRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
              <span>- {t("Open Sub-Menu")}</span>
            </div>
            <div className="flex items-center gap-1">
              <ChevronDown className="h-4 w-4" />
              <span>- {t("Close Sub-Menu")}</span>
            </div>
          </div>

          <div className="space-y-2">
            {NAVIGATIONAL_HELP.map((item) => {
              const isExpanded = expandedItems.has(item.title);
              return (
                <div key={item.title} className="border rounded-lg bg-white">
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggleItem(item.title)}
                  >
                    <span className="font-medium text-primary">{t(item.title)}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className={`h-4 w-4 text-muted-foreground ${isRTL ? "rotate-180" : ""}`} />
                    )}
                  </button>
                  {isExpanded && item.children && (
                    <div className="border-t px-6 py-4 space-y-3">
                      {item.children.map((child) => (
                        <div key={child.title} className="flex items-start gap-3 p-3 bg-muted/20 rounded-md">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{t(child.title)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t(child.description)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* FAQs */}
        <TabsContent value="faqs" className="mt-6">
          <div className="space-y-2">
            {FAQS.map((faq, i) => {
              const key = `faq-${i}`;
              const isExpanded = expandedItems.has(key);
              return (
                <div key={key} className="border rounded-lg bg-white">
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggleItem(key)}
                  >
                    <span className="font-medium text-sm">{t(faq.q)}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 ${isRTL ? "rotate-180" : ""}`} />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t px-6 py-4">
                      <p className="text-sm text-muted-foreground">{t(faq.a)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Contact Us */}
        <TabsContent value="contact-us" className="mt-6">
          <div className="max-w-lg space-y-6">
            <div className="bg-white border rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg">{t("Get in Touch")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("For any queries or support regarding the TPRM module, please reach out to us through the following channels.")}
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-md">
                  <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t("Email Support")}</p>
                    <p className="text-sm text-muted-foreground">support@baarez.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-md">
                  <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t("Phone Support")}</p>
                    <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-md">
                  <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t("Live Chat")}</p>
                    <p className="text-sm text-muted-foreground">{t("Available Monday to Friday, 9 AM - 6 PM EST")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
