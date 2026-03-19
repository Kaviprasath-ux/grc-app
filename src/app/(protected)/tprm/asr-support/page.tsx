"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Home,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  FileText,
  Menu,
  Search,
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

interface FAQItem { question: string; answer: string; category: string; }

const ASR_FAQS: FAQItem[] = [
  // Getting Started
  { category: "Getting Started", question: "What is the role of an Assessor in TPRM?", answer: "The Assessor is responsible for reviewing vendor assessment responses, providing compliance ratings for each question, raising clarifications when needed, overriding AI-generated ratings when expert judgment differs, generating assessment reports, and managing the issue register. Assessors are the primary reviewers in the assessment workflow." },
  { category: "Getting Started", question: "What menus are available for an Assessor?", answer: "As an Assessor, you have access to: Dashboard (assessment and issue overview), Assessments (My Queue, Due Diligence, Reassessments, Offboarding, Completed), Vendor Inventory (view vendor details), Continuous Monitoring (security scans), Follow-Ups (clarifications sent to vendors), Issue Register (manage identified issues), Assessment Factory (bulk AI assessments), Factory Reports, Templates, and Support." },
  { category: "Getting Started", question: "How do I navigate the Assessor Dashboard?", answer: "The Dashboard provides an overview of assessment status (pending, in progress, completed), issue statistics (open, closed, overdue), risk distribution across vendors, and vendor analytics. Use the charts to identify areas requiring immediate attention and prioritize your work queue." },

  // Assessment Workflow
  { category: "Assessment Workflow", question: "How do I start reviewing an assessment?", answer: "Navigate to Assessments → My Queue. Click the view button on any assigned assessment to open the Review Questionnaire page. You'll see the vendor's responses, uploaded artifacts, and AI-generated compliance ratings. Review each question and provide your compliance rating." },
  { category: "Assessment Workflow", question: "What is the full assessment workflow?", answer: "The assessment workflow is: (1) BO/RM initiates assessment, (2) Account Manager responds to questionnaire, (3) AI evaluates responses and generates initial ratings, (4) Assessor reviews responses and ratings, (5) Assessor can raise clarifications or override AI ratings, (6) Assessor completes review, (7) Approver gives final approval, (8) Report is generated with issues identified." },
  { category: "Assessment Workflow", question: "How do I raise a clarification?", answer: "While reviewing a questionnaire, click the 'Clarification' button on any question to send a clarification request to the vendor (Account Manager). Provide details about what additional information you need. The vendor will respond, and you can view their response in the Follow-Ups section." },
  { category: "Assessment Workflow", question: "What does 'Override AI' mean?", answer: "The 'Override AI' button allows you to manually override the AI-generated compliance rating for a specific question. This is useful when the AI assessment doesn't match your expert judgment based on your domain knowledge or the specific context of the vendor's response." },
  { category: "Assessment Workflow", question: "How do I return an assessment to the vendor?", answer: "If the vendor's responses are incomplete or need significant updates, you can return the assessment. This sends the assessment back to the Account Manager's Active tab with your comments explaining what needs to be addressed. The vendor will update and resubmit." },
  { category: "Assessment Workflow", question: "How do I generate an assessment report?", answer: "From the Review Questionnaire page, click the 'Generate Report' button in the top-right corner. The system will compile a comprehensive assessment report including all questions, responses, compliance ratings, and identified issues. This report is shared with the Approver for final review." },
  { category: "Assessment Workflow", question: "What are the assessment types I may handle?", answer: "You may handle: Due Diligence Assessments (initial onboarding), On-Demand Assessments (ad-hoc requests), Periodic Assessments (scheduled reassessments), and Offboard Assessments (vendor exit). Each appears in the relevant tab under Assessments." },

  // Issue Management
  { category: "Issue Management", question: "How does the Issue Register work?", answer: "The Issue Register provides an overview of all issues identified across vendor assessments. Issues are created when you complete an assessment review and the report is generated. You can view issues by vendor, severity, status, and due date. Issues are automatically assigned to the RM for remediation routing." },
  { category: "Issue Management", question: "What are the issue severity levels?", answer: "Issues are classified as High, Medium, or Low severity. High severity issues require urgent remediation. The remediation deadline is automatically calculated based on the vendor's VRR (Vendor Risk Rating) and severity level, as configured by the administrator in the Control Center." },
  { category: "Issue Management", question: "How do I assign issues during remediation?", answer: "After generating the assessment report, identified issues are added to the Issue Register. Issues are routed to the Relationship Manager (RM) who acts as liaison. The RM can then assign issues to IT, escalate to the BO, or reject back to the vendor for remediation." },

  // Assessment Factory
  { category: "Assessment Factory", question: "What is the Assessment Factory?", answer: "The Assessment Factory enables bulk AI-powered assessments without the full end-to-end workflow. Upload an Excel template with questionnaire data plus artifact files (evidence documents). The AI backend analyzes the documents and generates assessment responses with confidence scores. This is useful for processing multiple vendor assessments quickly." },
  { category: "Assessment Factory", question: "How do I use the Assessment Factory?", answer: "Go to Assessment Factory, upload the Excel template with vendor questionnaire data, and attach artifact files for evidence. Click 'Start Assessment' to begin AI processing. The AI will analyze documents and generate responses. Review the results in Factory Reports. You can adjust ratings before finalizing." },
  { category: "Assessment Factory", question: "What are Factory Reports?", answer: "Factory Reports show the results of bulk assessments processed through the Assessment Factory. Each report includes AI-generated responses, confidence scores, and compliance ratings. You can review, adjust, and approve these results before they are finalized." },

  // Continuous Monitoring
  { category: "Continuous Monitoring", question: "What is Continuous Monitoring?", answer: "Continuous Monitoring allows you to analyze vendor security posture by scanning various security domains. It tracks KPI metrics including Network Security, DNS Health, Patching, IP Reputation, Email Security, SSL/TLS, Privacy, and Breach Information. The system generates an overall security posture score and threat exposure assessment." },
  { category: "Continuous Monitoring", question: "How do I initiate a monitoring scan?", answer: "Go to Continuous Monitoring, select the vendor, and click 'Scan' to initiate a security assessment. The system will analyze the vendor's external security posture across multiple domains. Results are displayed with scores and recommendations. You can also report issues directly from monitoring findings." },
  { category: "Continuous Monitoring", question: "How are monitoring scores calculated?", answer: "Monitoring scores are calculated across multiple security domains (Network Security, DNS Health, Patching, etc.) using automated scanning tools. Each domain receives a score, and these are combined into an overall Security Posture score and Threat Exposure score. The scores determine the vendor's risk classification." },

  // Templates
  { category: "Templates", question: "How do I manage questionnaire templates?", answer: "Go to the Templates section to view and manage assessment questionnaire templates. Templates define the set of questions used in vendor assessments. You can view template details, associated domains, and the questions included in each template." },

  // Follow-Ups
  { category: "Follow-Ups", question: "How do I track clarification responses?", answer: "Go to Follow-Ups to view all clarification requests you've sent to vendors. You can see which clarifications have been responded to and which are still pending. Click on a clarification to view the vendor's response and decide if the information is sufficient." },
  { category: "Follow-Ups", question: "What if a vendor doesn't respond to a clarification?", answer: "If a vendor hasn't responded to a clarification within a reasonable timeframe, you can send a reminder through the Follow-Ups section. You may also contact the Relationship Manager to follow up with the vendor directly. Persistent non-response may be escalated." },

  // General
  { category: "General", question: "How do I view vendor details?", answer: "Go to Vendor Inventory to see the list of all vendors. Click on any vendor to view their profile, engagement details, assessment history, document library, and current risk rating. This helps you understand the vendor context before reviewing their assessments." },
  { category: "General", question: "Can I reassign an assessment to another assessor?", answer: "Assessment reassignment is typically handled by the TPRM administrator through the Task Queue. If you need an assessment reassigned, contact your TPRM admin or use the Support contact form." },
];

export default function AsrSupportPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("navigational-help");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ "process-flows": true });
  const [selectedId, setSelectedId] = useState<string | null>("process-flows");
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const [faqSearch, setFaqSearch] = useState("");

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

  const filteredFaqs = faqSearch.trim()
    ? ASR_FAQS.filter(f => f.question.toLowerCase().includes(faqSearch.toLowerCase()) || f.answer.toLowerCase().includes(faqSearch.toLowerCase()) || f.category.toLowerCase().includes(faqSearch.toLowerCase()))
    : ASR_FAQS;

  const faqCategories = [...new Set(filteredFaqs.map(f => f.category))];

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
          <Card>
            <CardContent className="p-6 space-y-4">
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
                        const globalIndex = ASR_FAQS.indexOf(faq);
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
            </CardContent>
          </Card>
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
