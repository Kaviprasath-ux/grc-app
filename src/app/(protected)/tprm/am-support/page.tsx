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
import { Home, ChevronRight, ChevronDown, Loader2 } from "lucide-react";

interface SubItem { id: string; title: string; }
interface NavSection { id: string; title: string; items: SubItem[]; }

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
        <TabsList>
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
            <CardContent className="p-12 text-center text-muted-foreground">
              {t("FAQs will be available soon.")}
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
