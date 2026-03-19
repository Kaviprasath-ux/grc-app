"use client";

import { useState } from "react";
import {
  ArrowLeft, ChevronRight, ChevronDown, Phone, Mail,
  MessageSquare, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface FAQItem { question: string; answer: string; category: string; }

const ADMIN_FAQS: FAQItem[] = [
  // Control Center
  { category: "Control Center", question: "How do I configure Due Diligence settings?", answer: "Navigate to Control Center > Due Diligence Configuration. Here you can set vendor risk rating thresholds, configure assessment cadence for each VRR level (Critical, High, Moderate, Low, Nominal), set remediation periods by severity, and define the minimum requirements for due diligence assessments." },
  { category: "Control Center", question: "How do I set up Scorecard Thresholds?", answer: "In Control Center > Scorecard Thresholds, configure the security posture and threat exposure score ranges that determine vendor risk ratings. Define the threshold values for each VRR level (e.g., Critical: 0-20, High: 21-40, etc.) to control how vendors are automatically classified." },
  { category: "Control Center", question: "How are vendor risk ratings calculated?", answer: "Vendor Risk Ratings (VRR) are calculated based on the security posture score and threat exposure score, weighted according to the scorecard configuration. The scoring formula (Average or Weighted) and factor weightages are configured in Configurations > Scorecard Configuration." },

  // Configurations
  { category: "Configurations", question: "How do I customize the vendor onboarding questionnaire?", answer: "Go to Configurations > Vendor Onboarding > Onboarding Questions tab. Here you can add, edit, reorder, or remove questions from the onboarding questionnaire. These questions are presented to BO/RM during vendor onboarding and their responses determine the initial VRR." },
  { category: "Configurations", question: "How do I manage Vendor Profile Fields?", answer: "Navigate to Configurations > Vendor Onboarding > Profile Fields tab. You can add custom fields that appear during vendor registration, such as industry sector, company size, or specific compliance requirements. Fields can be marked as mandatory or optional." },
  { category: "Configurations", question: "How do I create Service Categories?", answer: "Go to Configurations > Service Categories. Click 'Add Category' to create categories like IT Services, Cloud Hosting, Data Processing, etc. Service categories are used to classify vendors during onboarding and can affect which questionnaire templates are recommended." },
  { category: "Configurations", question: "How do I manage Questionnaire Templates?", answer: "Navigate to Configurations > Questionnaire Templates. Create new templates by selecting domains and linking questions from the master question bank. Templates define the assessment questionnaires used for vendor evaluations. You can activate/deactivate templates and manage which domains are included." },
  { category: "Configurations", question: "How do I configure the Scoring Formula?", answer: "Go to Configurations > Scorecard Configuration. Choose between Average (AVG) and Weighted scoring formulas. For weighted scoring, adjust the weightage percentages for Security Posture and Threat Exposure factors. The formula determines how the final vendor score is calculated from individual domain scores." },

  // Master Data Management
  { category: "Master Data Management", question: "How do I manage the master question bank?", answer: "Navigate to Master Data Management > Questions. Here you can add, edit, or remove questions used across assessment questionnaires. Each question belongs to a domain and can be linked to multiple questionnaire templates. You can also import questions in bulk." },
  { category: "Master Data Management", question: "How do I link questions to questionnaire templates?", answer: "Go to Master Data Management > Questionnaires. Select a template and add questions from the master question bank. You can reorder questions, set them as mandatory, and group them by domain. Changes to linked questions are reflected across all assessments using that template." },
  { category: "Master Data Management", question: "How do I set up assessment domains?", answer: "Navigate to Master Data Management > Domains. Create and manage domain categories (e.g., Information Security, Privacy, Business Continuity, Access Control). Domains organize questions into logical groups within assessment questionnaires." },
  { category: "Master Data Management", question: "Can I import questions in bulk?", answer: "Yes, go to Master Data Management > Questions and use the Import feature. Download the Excel template, fill in your questions with their domain assignments and other metadata, then upload the completed file. The system will validate and create question records." },

  // Vendor Management
  { category: "Vendor Management", question: "How do I add a new vendor?", answer: "Navigate to Vendor Management, click 'Add Vendor'. Fill in the vendor details including name, service category, engagement information, and risk assessment data. Assign a Business Owner and Account Manager, then save. The vendor will be added to the inventory." },
  { category: "Vendor Management", question: "How do I view all vendor records?", answer: "Go to Application Data Management > Vendor Management. You'll see a complete list of all vendors with their current status, VRR, engagement details, and key dates. Use the search and filter options to find specific vendors by name, code, or status." },
  { category: "Vendor Management", question: "How do I export vendor data?", answer: "Navigate to Vendor Management or Reports and click the 'Export' button to download vendor data as a CSV file. You can export the full vendor list or apply filters before exporting to get a specific subset of vendors." },
  { category: "Vendor Management", question: "Can I bulk import vendors?", answer: "Yes, in Vendor Management click the Import button. Download the CSV template first, fill in vendor details following the template format, then upload the completed file. The system validates each row and creates vendor records. Any errors are reported for correction." },

  // Assessment Workspace
  { category: "Assessment Workspace", question: "How do I initiate a vendor assessment?", answer: "Go to Assessment Workspace, click 'Initiate Assessment'. Select the vendor, choose a questionnaire template, and assign an assessor. The assessment will be created and sent to the Account Manager for responses." },
  { category: "Assessment Workspace", question: "How do I manage active assessments?", answer: "The Assessment Workspace shows all active assessments with their current status, assigned assessor, vendor, and dates. You can view assessment details, track progress through the workflow stages, and access assessment logs for audit trail." },
  { category: "Assessment Workspace", question: "How do I view assessment logs?", answer: "Click on any assessment in the Assessment Workspace to view its details. The assessment log shows a complete audit trail of all actions taken — status changes, assignments, clarifications, and approvals — with timestamps and user information." },

  // Task Queue
  { category: "Task Queue", question: "What is the Task Queue?", answer: "The Task Queue shows pending assessment tasks that need action. This includes new assessments waiting to be assigned, reassessments for expired evaluations, and returned assessment items. Process tasks by claiming them and routing to the appropriate assessor." },
  { category: "Task Queue", question: "How do I handle returned assessments in the Task Queue?", answer: "Returned assessments appear in the Task Queue when an assessor or approver returns them for additional review. Click on the returned assessment to see the reason for return, then reassign it to the appropriate assessor or take corrective action." },
  { category: "Task Queue", question: "How do I initiate reassessments?", answer: "In the Task Queue, expired or due assessments are flagged for reassessment. Click 'Initiate Reassessment' to create a new assessment cycle for the vendor. The system will use the same questionnaire template and assign it through the standard workflow." },

  // User Management
  { category: "User Management", question: "How do I manage TPRM users?", answer: "Go to User Management to view and manage all TPRM users across different roles (Business Owners, Relationship Managers, Assessors, Approvers, etc.). You can create new users, edit existing profiles, activate/deactivate accounts, and assign roles." },
  { category: "User Management", question: "What TPRM roles can I assign?", answer: "Available TPRM roles include: Business Owner (BO), Relationship Manager (RM), Assessor, Approver, Auditor (read-only), Account Manager (AM), SME (Subject Matter Expert), Factory Admin, Factory Assessor, and Internal IT Team. Each role has specific permissions and menu access." },

  // Monitoring
  { category: "Monitoring", question: "How do I set up Continuous Monitoring?", answer: "Navigate to Monitoring to configure vendor security scanning. Add vendors to the monitoring list, configure scan parameters, and set scan schedules. The system will automatically scan vendor security posture across domains like Network Security, DNS Health, Email Security, SSL/TLS, and more." },
  { category: "Monitoring", question: "How do I configure monitoring scan schedules?", answer: "In the Monitoring section, click on the schedule configuration to set automated scan intervals. You can configure how frequently scans run for different vendors or VRR levels. Manual scans can also be triggered at any time." },

  // Reports & General
  { category: "Reports & General", question: "What reports are available?", answer: "The Reports section provides comprehensive analytics including assessment reports, vendor risk summaries, issue remediation status, VRR distribution, assessment completion trends, and compliance dashboards. Reports can be viewed on-screen, filtered, and exported for offline review." },
  { category: "Reports & General", question: "How do I use the Program Monitor?", answer: "The Program Monitor provides a high-level overview of the entire TPRM program health. It shows metrics like total vendors, assessment completion rates, outstanding issues, and risk distribution. Use it to track program KPIs and identify areas needing attention." },
];

// ==================== MAIN COMPONENT ====================

export default function SupportPage() {
  const { t, isRTL } = useLanguage();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const [faqSearch, setFaqSearch] = useState("");

  const toggleItem = (title: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const toggleFaq = (index: number) => {
    setExpandedFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const filteredFaqs = faqSearch.trim()
    ? ADMIN_FAQS.filter(f => f.question.toLowerCase().includes(faqSearch.toLowerCase()) || f.answer.toLowerCase().includes(faqSearch.toLowerCase()) || f.category.toLowerCase().includes(faqSearch.toLowerCase()))
    : ADMIN_FAQS;

  const faqCategories = [...new Set(filteredFaqs.map(f => f.category))];

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
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">{t("Frequently Asked Questions")}</h2>
              <div className="relative w-72">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("Search FAQs...")}
                  value={faqSearch}
                  onChange={(e) => { setFaqSearch(e.target.value); setExpandedFaqs(new Set()); }}
                  className="ltr:pl-9 rtl:pr-9"
                />
              </div>
            </div>
            {faqCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("No FAQs match your search.")}</p>
            ) : (
              faqCategories.map((category) => {
                const categoryFaqs = filteredFaqs.filter(f => f.category === category);
                return (
                  <div key={category} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{t(category)}</h3>
                    {categoryFaqs.map((faq) => {
                      const globalIndex = ADMIN_FAQS.indexOf(faq);
                      return (
                        <div key={globalIndex} className="border rounded-lg bg-white">
                          <button
                            onClick={() => toggleFaq(globalIndex)}
                            className="w-full flex items-center justify-between px-4 py-3 ltr:text-left rtl:text-right hover:bg-muted/30 transition-colors"
                          >
                            <span className="font-medium text-sm">{t(faq.question)}</span>
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandedFaqs.has(globalIndex) ? "rotate-0" : "-rotate-90"}`} />
                          </button>
                          {expandedFaqs.has(globalIndex) && (
                            <div className="border-t px-4 py-3 text-sm text-muted-foreground leading-relaxed">{t(faq.answer)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
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
