"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Home,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  FileText,
  Menu,
} from "lucide-react";

interface HelpSection {
  id: string;
  title: string;
  items?: { id: string; title: string; content: string }[];
}

const NAV_HELP_SECTIONS: HelpSection[] = [
  {
    id: "process-flows",
    title: "Process Flows",
    items: [
      {
        id: "pf-assessment",
        title: "Assessment Workflow",
        content: "The assessment workflow starts when a Business Owner or RM creates an assessment for a vendor. The assessment is then assigned to an Assessor who reviews the vendor's responses and provides compliance ratings.",
      },
      {
        id: "pf-review",
        title: "Review Process",
        content: "After the Assessor completes the review, the assessment is sent to the Approver for final review. The Approver can approve, reject, or return the assessment for further review.",
      },
    ],
  },
  {
    id: "menus",
    title: "Menus",
    items: [
      {
        id: "m-dashboard",
        title: "Dashboard",
        content: "The Dashboard provides an overview of assessment status, issue statistics, risk distribution, and vendor analytics. Use the charts to identify areas requiring attention.",
      },
      {
        id: "m-assessments",
        title: "Assessments",
        content: "The Assessments section contains your work queue, due diligence items, reassessments, offboarding requests, and completed assessments.",
      },
      {
        id: "m-monitoring",
        title: "Continuous Monitoring",
        content: "Continuous Monitoring allows you to analyze vendor security posture by entering vendor details. The system scans and scores various security domains.",
      },
    ],
  },
];

const FAQS = [
  {
    question: "How do I start an assessment?",
    answer: "Navigate to Assessments → My Queue. Click the view button on any assigned assessment to open the Review Questionnaire page where you can review vendor responses.",
  },
  {
    question: "How do I raise a clarification?",
    answer: "While reviewing a questionnaire, click the 'Clarification' button on any question to send a clarification request to the vendor.",
  },
  {
    question: "What does 'Override AI' mean?",
    answer: "The 'Override AI' button allows you to manually override the AI-generated compliance rating for a specific question. This is useful when the AI assessment doesn't match your expert judgment.",
  },
  {
    question: "How do I generate a report?",
    answer: "From the Review Questionnaire page, click the 'Generate Report' button in the top-right corner to download a comprehensive assessment report.",
  },
];

export default function AsrSupportPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("navigational-help");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ "process-flows": true });
  const [selectedId, setSelectedId] = useState<string | null>("process-flows");
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());

  const toggleSection = (sectionId: string) => {
    const isOpening = !expandedSections[sectionId];
    setExpandedSections((prev) => ({ ...prev, [sectionId]: isOpening }));
    if (isOpening) setSelectedId(sectionId);
  };

  const toggleFaq = (index: number) => {
    setExpandedFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getSelectedContent = () => {
    for (const section of NAV_HELP_SECTIONS) {
      if (section.id === selectedId) {
        return (
          <div>
            <h3 className="text-lg font-semibold mb-3">{t(section.title)}</h3>
            {section.items?.map((item) => (
              <div key={item.id} className="mb-4">
                <h4 className="font-medium text-primary">{t(item.title)}</h4>
                <p className="text-sm text-muted-foreground mt-1">{t(item.content)}</p>
              </div>
            ))}
          </div>
        );
      }
      const sub = section.items?.find((i) => i.id === selectedId);
      if (sub) {
        return (
          <div>
            <h3 className="text-lg font-semibold mb-3">{t(sub.title)}</h3>
            <p className="text-sm text-muted-foreground">{t(sub.content)}</p>
          </div>
        );
      }
    }
    return <p className="text-muted-foreground">{t("Select an item from the left menu")}</p>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Support")}</span>
      </nav>

      <Button variant="outline" size="sm" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
        {t("Back")}
      </Button>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="navigational-help">{t("Navigational Help")}</TabsTrigger>
          <TabsTrigger value="faqs">{t("FAQs")}</TabsTrigger>
          <TabsTrigger value="contact">{t("Contact Us")}</TabsTrigger>
        </TabsList>

        {/* Navigational Help */}
        <TabsContent value="navigational-help" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left pane */}
            <div className="border rounded-lg p-4 space-y-2">
              {NAV_HELP_SECTIONS.map((section) => (
                <div key={section.id}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors ${
                      selectedId === section.id ? "bg-muted font-semibold" : ""
                    }`}
                  >
                    {section.id === "process-flows" ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <Menu className="h-4 w-4" />
                    )}
                    <span className="text-sm">{t(section.title)}</span>
                    <ChevronDown
                      className={`h-4 w-4 ltr:ml-auto rtl:mr-auto transition-transform ${
                        expandedSections[section.id] ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </button>
                  {expandedSections[section.id] && section.items && (
                    <div className="ltr:ml-6 rtl:mr-6 space-y-1">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={`w-full text-left text-sm p-1.5 rounded hover:bg-muted/50 ${
                            selectedId === item.id ? "text-primary font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {t(item.title)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right pane */}
            <div className="md:col-span-2 border rounded-lg p-6">{getSelectedContent()}</div>
          </div>
        </TabsContent>

        {/* FAQs */}
        <TabsContent value="faqs" className="mt-4">
          <div className="space-y-3">
            {FAQS.map((faq, index) => (
              <div key={index} className="border rounded-lg">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30"
                >
                  <span className="font-medium text-left">{t(faq.question)}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      expandedFaqs.has(index) ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>
                {expandedFaqs.has(index) && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">{t(faq.answer)}</div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Contact Us */}
        <TabsContent value="contact" className="mt-4">
          <div className="max-w-lg border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{t("Contact Us")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("For any questions or support requests, please reach out to the TPRM administration team.")}
            </p>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">{t("Email")}:</span> support@verifai.com
              </p>
              <p>
                <span className="font-medium">{t("Phone")}:</span> +1 (555) 123-4567
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
