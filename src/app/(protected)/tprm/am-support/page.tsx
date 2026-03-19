"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, ChevronRight, ChevronDown, Loader2, Search } from "lucide-react";

interface SubItem { id: string; title: string; }
interface NavSection { id: string; title: string; items: SubItem[]; }

interface FAQItem { question: string; answer: string; category: string; }

const AM_FAQS: FAQItem[] = [
  // Getting Started
  { category: "Getting Started", question: "What is the role of an Account Manager (AM) in TPRM?", answer: "The Account Manager is the vendor-side representative responsible for responding to assessment questionnaires, managing follow-ups (clarifications and issue remediations), delegating questions to Subject Matter Experts (SMEs), and reporting vendor-side issues. You serve as the primary point of contact between your organization and the TPRM team." },
  { category: "Getting Started", question: "What menus are available for an Account Manager?", answer: "As an AM, you have access to: Assessments (respond to active assessments, view submitted and past assessments), Follow-Ups (handle clarifications, issue remediations, and vendor issues), SME Management (create and manage Subject Matter Experts), and Support (help guides, FAQs, and contact information)." },
  { category: "Getting Started", question: "How do I get started when I first log in?", answer: "After logging in, check the Assessments page for any active assessments that need your response. Active assessments appear in the 'Active' tab. Click 'Start' on any assessment to begin responding to the questionnaire. Your responses are auto-saved as you work." },

  // Assessments
  { category: "Assessments", question: "How do I respond to an assessment?", answer: "Go to Assessments, click on the Active tab to see assessments awaiting your response. Click 'Start' to open the Response Questionnaire. Answer each question with Yes, No, or N/A. Upload required artifacts (evidence documents) for each question. Your responses are auto-saved. Click 'Submit Assessment' when all mandatory questions are answered." },
  { category: "Assessments", question: "What do the assessment tabs mean?", answer: "Active — assessments that need your response (Draft, In Progress, or Returned status). Submitted — assessments you have submitted for review by the Assessor. Past — completed, approved, or rejected assessments. Offboard — cancelled or expired assessments related to vendor offboarding." },
  { category: "Assessments", question: "Can I save my progress and come back later?", answer: "Yes, your responses are auto-saved as you work on the questionnaire. You can close the assessment and return to it anytime from the Active tab. The assessment will retain all your previous answers and uploaded artifacts." },
  { category: "Assessments", question: "What happens after I submit an assessment?", answer: "After submission, the assessment moves to the Assessor for review. The Assessor evaluates your responses and artifacts, may raise clarifications if needed, and provides compliance ratings. If the Assessor returns the assessment, it will reappear in your Active tab for updates." },
  { category: "Assessments", question: "What if an assessment is returned to me?", answer: "A returned assessment means the Assessor needs additional information or corrections. The assessment will reappear in your Active tab with comments from the Assessor explaining what needs to be addressed. Update your responses and resubmit." },
  { category: "Assessments", question: "How do I upload artifacts (evidence documents)?", answer: "While responding to a question in the questionnaire, click the upload button to attach evidence documents. Supported formats typically include PDF, DOC, DOCX, XLS, XLSX, and image files. Each question may have specific artifact requirements." },
  { category: "Assessments", question: "What types of assessments might I receive?", answer: "You may receive: (1) Due Diligence Assessment — during initial vendor onboarding. (2) On-Demand Assessment — requested at any time by the BO/RM. (3) Periodic Assessment — automatically triggered based on your vendor's risk rating cadence. (4) Offboard Assessment — when your vendor engagement is being terminated." },

  // Follow-Ups
  { category: "Follow-Ups", question: "What are Clarifications?", answer: "Clarifications are questions raised by the Assessor during their review of your assessment responses. When an Assessor needs more information about a specific answer, they send a clarification request. These appear in the Clarifications tab under Follow-Ups. You should respond promptly to avoid delays." },
  { category: "Follow-Ups", question: "How do I respond to a Clarification?", answer: "Go to Follow-Ups → Clarifications tab. You'll see all pending clarification requests. Click on a clarification to view the Assessor's question, then provide your response with any additional details or supporting documents needed." },
  { category: "Follow-Ups", question: "What is Issue Remediation?", answer: "Issue Remediation tracks issues identified during the assessment process that require your vendor to take corrective action. These issues have severity levels (High, Medium, Low) and deadlines. You need to address each issue and provide evidence of remediation." },
  { category: "Follow-Ups", question: "How do I handle Issue Remediation requests?", answer: "Go to Follow-Ups → Issue Remediation tab. View each issue's details including severity, description, and deadline. Take corrective action, then update the issue status with your remediation response and any supporting evidence. The TPRM team will review your remediation." },
  { category: "Follow-Ups", question: "How do I report a Vendor Issue?", answer: "Go to Follow-Ups → Vendor Issues tab. Click to create a new vendor issue. Specify the severity level (High, Medium, Low), provide a description of the issue, and set a due date for resolution. Track the issue through Open, Submitted, and Closed stages." },

  // SME Management
  { category: "SME Management", question: "What is a Subject Matter Expert (SME)?", answer: "A Subject Matter Expert (SME) is a specialist within your organization who can be delegated to answer specific assessment questions in their area of expertise. For example, a network security specialist can answer security-related questions, while an HR representative can answer compliance-related questions." },
  { category: "SME Management", question: "How do I create an SME?", answer: "Go to SME Management and click to add a new SME. Fill in their full name, email address, and area of expertise. SMEs you create are only visible to you as the Account Manager. Once created, you can delegate specific assessment questions to them." },
  { category: "SME Management", question: "How do I delegate questions to an SME?", answer: "While responding to an assessment questionnaire, you can delegate specific questions to an SME by selecting them from the delegation option on each question. The SME will receive notification to respond to those specific questions." },
  { category: "SME Management", question: "Can other Account Managers see my SMEs?", answer: "No, SMEs you create are private to your account. Other Account Managers within your organization cannot see or use your SMEs. Each AM manages their own pool of Subject Matter Experts." },

  // Offboarding
  { category: "Offboarding", question: "What happens during vendor offboarding?", answer: "During offboarding, you will receive an Offboard Assessment questionnaire. This assessment covers the vendor's exit process, data handling, access revocation, and transition plans. You need to respond to all questions, after which the Assessor reviews, the RM approves, and the BO gives final approval." },
  { category: "Offboarding", question: "How do I respond to an Offboard Assessment?", answer: "Offboard Assessments appear in the Offboard tab of your Assessments page. The process is similar to regular assessments — open the questionnaire, answer each question, upload any required artifacts, and submit when complete. Respond promptly to avoid delays in the offboarding process." },

  // General
  { category: "General", question: "How do I contact the TPRM team for support?", answer: "Use the Contact Us tab in the Support section to send a support request. Fill in your name, phone number, company name, and describe your issue or question. The TPRM team will respond to your request." },
  { category: "General", question: "Are my responses confidential?", answer: "Yes, your assessment responses and uploaded artifacts are securely stored and only accessible to authorized TPRM team members (Assessors, Approvers, BO, RM) involved in your vendor's assessment process." },
];

const NAV_HELP_SECTIONS: NavSection[] = [
  {
    id: "process-flows",
    title: "Process Flows",
    items: [
      { id: "pf-assessments", title: "Responding to Assessments" },
      { id: "pf-follow-ups", title: "Handling Follow-Ups" },
      { id: "pf-sme", title: "Managing SMEs" },
      { id: "pf-issues", title: "Reporting Vendor Issues" },
    ],
  },
  {
    id: "menus",
    title: "Menus",
    items: [
      { id: "m-assessments", title: "Assessments" },
      { id: "m-follow-ups", title: "Follow-Ups" },
      { id: "m-sme", title: "SME Management" },
      { id: "m-support", title: "Support" },
    ],
  },
];

const NAV_HELP_CONTENT: Record<string, { title: string; content: string[] }> = {
  "pf-assessments": {
    title: "Responding to Assessments",
    content: [
      "When an assessment is initiated for your vendor, it will appear in the Active tab.",
      "Click 'Start' to open the Response Questionnaire.",
      "Answer each question with Yes, No, or N/A. Upload required artifacts.",
      "Your responses are auto-saved as you work.",
      "Click 'Submit Assessment' when all mandatory questions are answered.",
    ],
  },
  "pf-follow-ups": {
    title: "Handling Follow-Ups",
    content: [
      "Clarifications: When an assessor needs clarification on your response, it appears in the Clarifications tab.",
      "Issue Remediation: If issues are found during assessment, you'll see remediation requests.",
      "Vendor Issues: You can report issues from your side using the Vendor Issues tab.",
    ],
  },
  "pf-sme": {
    title: "Managing SMEs",
    content: [
      "Subject Matter Experts (SMEs) can be delegated to answer specific assessment questions.",
      "Create SMEs with their name, email, and area of expertise.",
      "SMEs you create are only visible to you.",
    ],
  },
  "pf-issues": {
    title: "Reporting Vendor Issues",
    content: [
      "Use the Vendor Issues tab under Follow-Ups to report issues.",
      "Specify the severity level and due date for resolution.",
      "Track issue status through Open, Submitted, and Closed stages.",
    ],
  },
  "m-assessments": {
    title: "Assessments Menu",
    content: [
      "Active: Assessments that need your response (Draft, In Progress, Returned).",
      "Submitted: Assessments you have submitted for review.",
      "Past: Completed, Approved, or Rejected assessments.",
      "Offboard: Cancelled or Expired assessments.",
    ],
  },
  "m-follow-ups": {
    title: "Follow-Ups Menu",
    content: [
      "Clarifications: Respond to assessor questions about your assessment answers.",
      "Issue Remediation: Address issues identified during the assessment process.",
      "Vendor Issues: Report and track issues from the vendor side.",
    ],
  },
  "m-sme": {
    title: "SME Management Menu",
    content: [
      "Create and manage Subject Matter Experts for your vendor.",
      "SMEs can be assigned to specific assessment questions via delegation.",
      "Manage their access and expertise areas.",
    ],
  },
  "m-support": {
    title: "Support Menu",
    content: [
      "Navigational Help: How-to guides for the Account Manager portal.",
      "FAQs: Frequently asked questions.",
      "Contact Us: Send a support request to the TPRM team.",
    ],
  },
};

export default function AMSupportPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState("nav-help");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["process-flows"]));
  const [selectedItem, setSelectedItem] = useState("pf-assessments");
  const [sending, setSending] = useState(false);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const [faqSearch, setFaqSearch] = useState("");

  // Contact form
  const [name, setName] = useState(session?.user?.name || "");
  const [phone, setPhone] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [company, setCompany] = useState(String((session?.user as any)?.customerAccountName || ""));
  const [message, setMessage] = useState("");

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
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
    ? AM_FAQS.filter(f => f.question.toLowerCase().includes(faqSearch.toLowerCase()) || f.answer.toLowerCase().includes(faqSearch.toLowerCase()) || f.category.toLowerCase().includes(faqSearch.toLowerCase()))
    : AM_FAQS;

  const faqCategories = [...new Set(filteredFaqs.map(f => f.category))];

  const handleSendRequest = async () => {
    if (!message.trim()) {
      toast({ title: t("Error"), description: t("Message is required"), variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/tprm/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, company, message }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Support request sent successfully") });
      setMessage("");
    } catch {
      toast({ title: t("Error"), description: t("Failed to send support request"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const content = NAV_HELP_CONTENT[selectedItem];

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>/</span>
        <span>{t("TPRM")}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{t("Support")}</span>
      </div>

      <h1 className="text-2xl font-semibold">{t("Support")}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="ltr:justify-start rtl:justify-end">
          <TabsTrigger value="nav-help">{t("Navigational Help")}</TabsTrigger>
          <TabsTrigger value="faqs">{t("FAQs")}</TabsTrigger>
          <TabsTrigger value="contact">{t("Contact Us")}</TabsTrigger>
        </TabsList>

        {/* Navigational Help */}
        <TabsContent value="nav-help">
          <div className="grid grid-cols-12 gap-6 min-h-[60vh]">
            {/* Left sidebar */}
            <div className="col-span-4 ltr:border-r rtl:border-l ltr:pr-4 rtl:pl-4">
              {NAV_HELP_SECTIONS.map(section => (
                <div key={section.id} className="mb-2">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center gap-2 w-full ltr:text-left rtl:text-right font-medium text-sm py-2 hover:text-primary"
                  >
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {t(section.title)}
                  </button>
                  {expandedSections.has(section.id) && (
                    <div className="ltr:ml-6 rtl:mr-6 space-y-1">
                      {section.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItem(item.id)}
                          className={`block w-full ltr:text-left rtl:text-right text-sm py-1.5 px-2 rounded ${
                            selectedItem === item.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted text-muted-foreground"
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

            {/* Right content */}
            <div className="col-span-8">
              {content ? (
                <div>
                  <h2 className="text-xl font-medium mb-4">{t(content.title)}</h2>
                  <ul className="space-y-2">
                    {content.content.map((line, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{t(line)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">{t("Select an item from the left panel")}</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* FAQs */}
        <TabsContent value="faqs">
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
                        const globalIndex = AM_FAQS.indexOf(faq);
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
        <TabsContent value="contact">
          <Card>
            <CardContent className="p-6 max-w-lg mx-auto space-y-4">
              <h2 className="text-lg font-medium">{t("Contact Us")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("Send us a message and our support team will get back to you.")}
              </p>
              <div>
                <Label>{t("Name")}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>{t("Phone")}</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <Label>{t("Company")}</Label>
                <Input value={company} onChange={e => setCompany(e.target.value)} />
              </div>
              <div>
                <Label>{t("Message")} *</Label>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t("Describe your issue or question...")}
                  rows={5}
                />
              </div>
              <Button
                onClick={handleSendRequest}
                disabled={sending || !message.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                {t("Send Request")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("By submitting this form, you agree to our terms and conditions.")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
