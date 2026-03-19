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
import {
  Home,
  ChevronRight,
  ChevronDown,
  Search,
} from "lucide-react";

interface FAQItem { question: string; answer: string; category: string; }

const RM_FAQS: FAQItem[] = [
  // Getting Started
  { category: "Getting Started", question: "What is the role of a Relationship Manager (RM) in TPRM?", answer: "The Relationship Manager acts as the liaison between the Business Owner and the TPRM team. RMs can onboard vendors, initiate assessments, manage contracts, handle issue remediation by routing issues to appropriate stakeholders (BO, IT, or back to vendor), and monitor vendor security posture." },
  { category: "Getting Started", question: "What menus are available for a Relationship Manager?", answer: "As an RM, you have access to: Dashboard (vendor criticality and assessment status), Vendor Inventory (onboard and manage vendors), Assessments (track ongoing, completed, and offboard assessments), Issue Management (issue register and remediation), Contracts (manage and renew vendor contracts), Monitoring (continuous vendor security monitoring), and Support." },
  { category: "Getting Started", question: "How do I navigate the RM Dashboard?", answer: "The RM Dashboard provides two main visual charts: Vendor Criticality (distribution of vendors across VRR levels — Critical, High, Moderate, Low, Nominal) and Assessment Status (tracks the progress of ongoing assessments). Click on chart elements to drill down for details." },
  { category: "Getting Started", question: "How is the RM role different from the Business Owner (BO)?", answer: "The RM has similar access to the BO but cannot manage users (create/edit RMs). The RM acts as a liaison between the business side and the TPRM team, handling day-to-day vendor management tasks delegated by the BO. The BO retains final approval authority for offboarding and vendor termination decisions." },

  // Vendor Onboarding
  { category: "Vendor Onboarding", question: "How do I onboard a new vendor?", answer: "Go to Vendor Inventory, click 'Onboard New Vendor'. Fill in Vendor Name, Engagements, Service Description, and Contact Number. Select or create an Account Manager (AM). Choose the Service Category and fill in additional fields. Then respond to the Onboarding Questions — the VRR will be calculated and questionnaires recommended for assessment." },
  { category: "Vendor Onboarding", question: "What is a Vendor Risk Rating (VRR)?", answer: "The VRR is an automatically calculated risk classification based on onboarding questionnaire responses and assessment results. VRR levels are: Critical, High, Moderate, Low, and Nominal. The VRR determines assessment cadence (how often periodic assessments are triggered) and remediation periods for identified issues." },
  { category: "Vendor Onboarding", question: "Can I import vendors in bulk?", answer: "Yes, you can bulk import vendors using a CSV file. Go to Vendor Inventory, click the Import button, download the template first, fill in vendor details in the template format, then upload the completed file. The system will validate and create vendor records for each row." },
  { category: "Vendor Onboarding", question: "What happens after vendor onboarding?", answer: "After onboarding, the vendor status changes to 'Onboarded'. If you clicked 'Initiate Assessment' during onboarding, an assessment request is sent to the Account Manager (AM) to respond to the questionnaire. The assessment then follows the review cycle: AM responds → Assessor reviews → Approver approves → Risk rating finalized." },
  { category: "Vendor Onboarding", question: "How do I create an Account Manager (AM) during onboarding?", answer: "During vendor onboarding, if the AM is not already listed, you can fill in the AM's name and email address directly in the onboarding form. The system will create the AM account and associate it with the vendor." },

  // Assessments
  { category: "Assessments", question: "What types of assessments are available?", answer: "There are four types: (1) Onboarding/Due Diligence Assessment — initiated during vendor onboarding. (2) On-Demand Assessment — initiated any time for existing vendors with active contracts. (3) Periodic Assessment — automatically triggered based on VRR cadence configuration. (4) Offboard Assessment — initiated during vendor offboarding or 30 days before contract expiry." },
  { category: "Assessments", question: "How do I initiate an On-Demand assessment?", answer: "Go to Vendor Inventory, select the existing vendor engagement, and click 'Initiate Assessment'. Choose the questionnaire template(s) to include. The assessment request will be submitted to the Assessor for further processing." },
  { category: "Assessments", question: "How are Periodic Assessments scheduled?", answer: "Periodic assessments are automatically scheduled based on VRR cadence configuration set by the administrator. Typical cadences: Critical — every 1 month, High — every 3 months, Moderate — every 6 months, Low — every 24 months, Nominal — every 36 months. If an On-Demand assessment occurs before a scheduled periodic one, the next periodic is rescheduled." },
  { category: "Assessments", question: "What do the assessment statuses mean?", answer: "Draft — created but not sent. Awaiting Response — sent to vendor. Submitted — vendor has responded. In Progress — assessor reviewing. Returned — sent back to vendor for more info. Reviewed — assessor completed review. Approved — approver approved. Completed — fully done with risk rating calculated." },
  { category: "Assessments", question: "How do I track assessment progress?", answer: "Use the Assessments menu which organizes assessments into: Ongoing Assessments (currently in progress), Completed Assessments (finished with final risk ratings), and Offboard Assessments (related to vendor offboarding). Each assessment shows its current status, vendor name, and dates." },

  // Issue Management
  { category: "Issue Management", question: "How does issue remediation work for an RM?", answer: "After an assessment is completed, the Approver generates a report listing identified issues. These appear in your Issue Management section. As RM, you act as liaison: you can reject issues back to the vendor, assign issues to IT for remediation, or escalate issues to the BO for risk acceptance or vendor termination decisions." },
  { category: "Issue Management", question: "What are the issue tabs in Issue Management?", answer: "Issue Management has multiple tabs: Open Issues — issues assigned by the Assessor to the RM. Assigned to IT — issues forwarded to the internal IT team. Assigned to BO — issues escalated to the Business Owner for decisions. Issue Register — overview of all issues across all vendors." },
  { category: "Issue Management", question: "What are the issue severity levels?", answer: "Issues are classified as High, Medium, or Low severity. High severity issues require urgent remediation within the shortest timeframe. The remediation deadline is automatically calculated based on the vendor's VRR and severity level, as configured in the Control Center by the administrator." },
  { category: "Issue Management", question: "Can I reject an issue back to the vendor?", answer: "Yes. From the Open Issues tab, you can reject issues which sends them back to the vendor (Account Manager) for further action or remediation. The vendor will then need to address the issue and respond." },

  // Contracts
  { category: "Contracts", question: "How do I manage vendor contracts?", answer: "The Contracts menu shows 'All Vendor Contracts' for active contracts and 'Expiring Contracts' for those with less than 30 days to expiry. You can view contract details, track expiry dates, and initiate renewal or offboarding processes." },
  { category: "Contracts", question: "How do I renew an expiring contract?", answer: "Contracts with less than 30 days to expiry appear in the Expiring Contracts section. Click 'Renew Contract' and a scope change check will be performed. If no scope changes, extend by adding a new date. If scope changes exist, a new engagement is created for due diligence. Contracts are automatically terminated if no action is taken before expiry." },
  { category: "Contracts", question: "When should a contract be added?", answer: "Contracts should be added only after the assessment is completed and approved. You will receive a notification when the assessment is done. Go to Vendor Inventory, select the vendor engagement, and click 'Add Contract' to upload the signed contract." },
  { category: "Contracts", question: "Can I request deletion of a contract?", answer: "Contract deletion requires a formal request process for audit trail purposes. You can submit a contract deletion request, which will be reviewed and approved by the administrator before the contract document is removed." },

  // Offboarding
  { category: "Offboarding", question: "How do I initiate vendor offboarding?", answer: "Vendor offboarding is done through an Offboarding Assessment. As an RM, you can initiate it during the due diligence stage or when a contract is expiring. The vendor responds to the offboard questionnaire, the Assessor reviews it, then you approve, and finally the BO gives final approval." },
  { category: "Offboarding", question: "What is the offboarding approval chain?", answer: "Offboarding follows a multi-step process: (1) Account Manager fills the offboard questionnaire, (2) Assessor reviews responses, (3) Relationship Manager approves, (4) Business Owner gives final approval. The vendor is only marked as 'Offboarded' after all steps complete." },

  // Monitoring
  { category: "Monitoring", question: "What is Continuous Monitoring?", answer: "Continuous Monitoring provides ongoing security assessment of vendors between formal assessments. It tracks KPI metrics including Network Security, DNS Health, Patching, IP Reputation, Email Security, SSL/TLS, Privacy, and Breach Information. The system generates an overall security posture score." },
  { category: "Monitoring", question: "How do I view monitoring results?", answer: "Go to the Monitoring menu to see the list of vendors being monitored. Click on any vendor to view their security posture score, threat exposure details, KPI breakdowns, and any vulnerabilities detected. You can also trigger manual scans from this page." },

  // Reports
  { category: "Reports", question: "What reports are available?", answer: "The Reports section provides assessment reports for completed assessments, vendor risk summaries, issue remediation status, and trend analysis. Reports can be viewed on-screen or downloaded for offline review." },
  { category: "Reports", question: "How do I access a specific assessment report?", answer: "Go to Vendor Inventory, select the vendor engagement, and navigate to the Report Library. Assessment reports for all completed assessments are stored here. You can also access reports from the Assessments menu under Completed Assessments." },
];

interface SubItem {
  id: string;
  title: string;
}

interface NavSection {
  id: string;
  title: string;
  items: SubItem[];
}

const NAV_HELP_SECTIONS: NavSection[] = [
  {
    id: "process-flows",
    title: "Process Flows",
    items: [
      { id: "pf-onboarding", title: "Onboarding Vendors" },
      { id: "pf-assessments", title: "Initiating Assessments" },
      { id: "pf-issues", title: "Remediating Issues" },
      { id: "pf-contracts", title: "Managing Contracts" },
    ],
  },
  {
    id: "menus",
    title: "Menus",
    items: [
      { id: "m-dashboard", title: "Dashboard" },
      { id: "m-inventory", title: "Vendor Inventory" },
      { id: "m-assessments", title: "Assessments" },
      { id: "m-issues", title: "Issue Management" },
      { id: "m-contracts", title: "Contracts" },
    ],
  },
];

function OnboardingVendorsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Onboarding Vendors")}</h2>
      <h3 className="text-base font-semibold mb-2">{t("Adding Vendors to the Inventory")}</h3>
      <ol className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t('To onboard a Vendor, go to the')} <strong>{t("Vendor Inventory")}</strong> {t("menu.")}</li>
        <li>{t('Click on "Onboard New Vendor" to open Vendor Onboarding screen.')}</li>
        <li>{t("Fill in the details of Vendor Name, Engagements, Service Description, Contact Number.")}</li>
        <li>{t("Select Account Manager (AM) if Vendor name has an AM associated with it.")}</li>
        <li>{t("If AM is not listed, fill in the details of AM name & E-mail ID.")}</li>
        <li>{t("Choose the Service category")} <em>({t("based on Admin Configuration")}).</em></li>
        <li>{t("Fill in additional details")} <em>({t("if applicable based on Admin Configuration of Vendor Profile Fields")}).</em></li>
      </ol>
      <h3 className="text-base font-semibold mt-5 mb-2">{t("Evaluating Vendor Risk Rating")}</h3>
      <ol start={8} className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t("Respond to the Onboarding Questions")} <em>({t("based on Admin Configuration")}).</em></li>
        <li>
          {t('Click "Next" to Check Risk Rating and')}
          <p className="italic mt-1">{t("Depending on the response provided for the Onboarding questions, the VRR will be calculated and the Questionnaires that were assigned will be recommended for the assessment process.")}</p>
        </li>
        <li>{t('Clicking on "Initiate Assessment" button will start the Due Diligence assessment process and adds the Vendor to the Inventory.')}</li>
      </ol>
    </>
  );
}

function InitiatingAssessmentsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Initiating Assessments")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("There are four types of assessments available in VerifAI TPRM.")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1 text-sm text-muted-foreground mb-4">
        <li>{t("Onboarding Assessment/Due Diligence Assessment.")}</li>
        <li>{t("On-Demand Assessments.")}</li>
        <li>{t("Periodic Assessments.")}</li>
        <li>{t("Offboard Assessments.")}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Onboarding Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t('Onboarding Assessments are initiated at the end of the "Onboard New Vendor" process.')}</li>
        <li>{t("The RM selects the questionnaires that should be included for the assessment.")}</li>
        <li>{t('Clicking on the "Initiate Assessment" button submits the assessment to the vendor.')}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("On-Demand Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("On-Demand Assessments can be initiated at any time for existing vendors with an active contract.")}</li>
        <li>{t("To initiate the assessment, go to the Vendor Inventory and select the existing vendor.")}</li>
        <li>{t('Clicking on the "Initiate Assessment" button submits the assessment request to the assessor for further actions.')}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Periodic Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("Periodic Assessments are initiated automatically by VerifAI.")}</li>
        <li>{t("The period is scheduled based on the cadence configuration of VRR done by the administrator.")}</li>
        <li><em>{t("Note: If an On-Demand assessment takes place before the scheduled periodic assessment, the next periodic assessment will be rescheduled based on the completion date of the On-Demand assessment and cadence configuration.")}</em></li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Offboard Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t("Offboarding Assessments can be initiated during the remediation process or 30 days before the contract expiry.")}</li>
      </ul>
    </>
  );
}

function RemediatingIssuesContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Remediating Issues")}</h2>
      <p className="text-sm text-muted-foreground mb-2">{t("Issue Remediation process will be required only if issues were identified by the TPRM team during the assessment process.")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("After the Assessment is completed, the Approver generates a report with the list of identified issues.")}</li>
        <li>{t("The report updates the Issue Register and Issue Remediation sections for all the stakeholders who were involved in the Onboarding process.")}</li>
        <li>{t("The RM acts as liaison between the Business and TPRM team in resolving the issues.")}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Liaison during Remediation")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t('The issues assigned by the Assessor to the RM will be listed under "Open Issues" tab.')}</li>
        <li>{t("RM can reject the issues which will be sent back to the Vendor for further actions.")}</li>
        <li>{t('RM can assign the issues to IT which will be listed under "Assigned to IT" tab.')}</li>
        <li>{t('RM can assign the issues to BO which will be listed under "Assigned to BO" tab.')}</li>
      </ul>
    </>
  );
}

function ManagingContractsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Managing Contracts")}</h2>
      <p className="text-sm text-muted-foreground mb-2">{t("The Contracts menu allows the RM to view and renew contracts.")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t('"All Vendor Contracts" section keeps track of all the Active Contracts.')}</li>
        <li>{t("Expiring Contracts section lists the Contract that have less than 30 days to expire.")}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Renewing Expiring Contracts")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t('Contracts that have less than 30 days to expire will be notified to the RM and moved to the "Expiring Contracts" section.')}</li>
        <li>{t('After clicking on "Renew Contract", a check on Change of Scope will be done.')}</li>
        <li>{t("If there are no changes to scope, the contract can be extended by adding the new extended date.")}</li>
        <li>{t("If there are changes to scope, a new engagement will be created to initiate the Due Diligence process.")}</li>
        <li><em>{t("Note: Contracts will be automatically terminated if no action is taken before the date of expiry")}</em></li>
      </ul>
    </>
  );
}

function DashboardContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Dashboard")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Dashboard provides a visually engaging representation of data through charts, enhancing the user experience and facilitating richer data consumption.")}</p>
      <p className="text-sm text-muted-foreground mb-3">{t("There are two standard Dashboards available for RM:")}</p>
      <div className="space-y-3">
        <div><h3 className="text-sm font-semibold">{t("Vendor Criticality")}</h3><p className="text-sm text-muted-foreground">{t("Distribution of Vendors across various Vendor Risk Rating.")}</p></div>
        <div><h3 className="text-sm font-semibold">{t("Assessment Status")}</h3><p className="text-sm text-muted-foreground">{t("Tracks the status of Ongoing Assessments.")}</p></div>
      </div>
    </>
  );
}

function VendorInventoryContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Vendor Inventory")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Vendor Inventory menu is the storehouse of all the vendors that have been onboarded by either BO or RM and is used for managing the lifecycle of vendors from Onboarding* to Offboarding**.")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("The Vendor section can be used to choose the different engagements for each vendor.")}</li>
        <li>{t("Clicking on the vendor engagement provides an overview of the vendor along with a service description.")}</li>
        <li>{t("The Report Library holds the assessment reports of completed assessments.")}</li>
        <li>{t("The Document Library is a repository of all the evidence submitted by the vendor during the Due Diligence stage.")}</li>
        <li>{t("The Legal Contract section is used for adding the signed contract and extracting security obligations from the contract.")}</li>
      </ul>
      <p className="text-xs text-muted-foreground italic">{t("*Refer to Onboarding Vendors under the Process Flow section for a detailed process.")}</p>
    </>
  );
}

function AssessmentsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Assessments")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The")} <strong>{t("Assessments")}</strong> {t("menu keeps track of all the assessments that were initiated by the BO.")}</p>
      <p className="text-sm text-muted-foreground mb-3">{t("The types of assessments that can be tracked along with their status are as follows:")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1 text-sm text-muted-foreground">
        <li>{t("Ongoing Assessments")}</li>
        <li>{t("Completed Assessments")}</li>
        <li>{t("Offboard Assessments")}</li>
      </ul>
    </>
  );
}

function IssueManagementContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Issue Management")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Issue Management menu is used for tracking and remediating* the identified issues.")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("The overview of all the issues across each vendor is tracked using the Issue Register tab.")}</li>
        <li>{t("The list of all the issues to be resolved by BO is tracked in the Issue Remediation tab.")}</li>
      </ul>
      <p className="text-xs text-muted-foreground italic">{t("*Refer to Remediation Issues under the Process Flow section for a detailed process.")}</p>
    </>
  );
}

function ContractsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Contracts")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Contracts menu is used for managing* Vendor contracts which involves renewing expiring Contracts.")}</p>
      <p className="text-xs text-muted-foreground italic">{t("*Refer Managing Contracts under Process Flow section for detailed process")}</p>
    </>
  );
}

function ProcessFlowsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-3">{t("Process Flows")}</h2>
      <p className="text-sm text-muted-foreground">{t("This section outlines the various process flows that are applicable to the role of a Relationship Manager (RM).")}</p>
    </>
  );
}

function MenusContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-3">{t("Menus")}</h2>
      <p className="text-sm text-muted-foreground">{t("This section outlines the purpose of each menu along with their elements.")}</p>
    </>
  );
}

export default function RMSupportPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ "process-flows": true });
  const [selectedId, setSelectedId] = useState<string | null>("process-flows");

  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const [faqSearch, setFaqSearch] = useState("");

  const [contactName, setContactName] = useState(session?.user?.name || "");
  const [contactPhone, setContactPhone] = useState("");
  const [contactCompany, setContactCompany] = useState(session?.user?.customerAccountName || "");
  const [contactMessage, setContactMessage] = useState("");

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
    ? RM_FAQS.filter(f => f.question.toLowerCase().includes(faqSearch.toLowerCase()) || f.answer.toLowerCase().includes(faqSearch.toLowerCase()) || f.category.toLowerCase().includes(faqSearch.toLowerCase()))
    : RM_FAQS;

  const faqCategories = [...new Set(filteredFaqs.map(f => f.category))];

  const [sending, setSending] = useState(false);

  const handleSendRequest = async () => {
    if (!contactMessage.trim()) { toast({ title: t("Please enter a message"), variant: "destructive" }); return; }
    setSending(true);
    try {
      const res = await fetch("/api/tprm/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, phone: contactPhone, company: contactCompany, message: contactMessage }),
      });
      if (res.ok) {
        toast({ title: t("Your request has been submitted successfully") });
        setContactMessage("");
      } else {
        toast({ title: t("Failed to send request"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to send request"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const renderContent = () => {
    switch (selectedId) {
      case "process-flows": return <ProcessFlowsContent t={t} />;
      case "menus": return <MenusContent t={t} />;
      case "pf-onboarding": return <OnboardingVendorsContent t={t} />;
      case "pf-assessments": return <InitiatingAssessmentsContent t={t} />;
      case "pf-issues": return <RemediatingIssuesContent t={t} />;
      case "pf-contracts": return <ManagingContractsContent t={t} />;
      case "m-dashboard": return <DashboardContent t={t} />;
      case "m-inventory": return <VendorInventoryContent t={t} />;
      case "m-assessments": return <AssessmentsContent t={t} />;
      case "m-issues": return <IssueManagementContent t={t} />;
      case "m-contracts": return <ContractsContent t={t} />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500"><Home className="h-4 w-4" /><span>{t("TPRM")}</span></div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Support")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Support")}</h1>

      <Tabs defaultValue="navigational-help">
        <TabsList>
          <TabsTrigger value="navigational-help">{t("Navigational Help")}</TabsTrigger>
          <TabsTrigger value="faqs">{t("FAQs")}</TabsTrigger>
          <TabsTrigger value="contact-us">{t("Contact Us")}</TabsTrigger>
        </TabsList>

        <TabsContent value="navigational-help">
          <Card>
            <CardContent className="p-0">
              <div className="flex min-h-[450px]">
                <div className="w-72 shrink-0 p-4 space-y-2">
                  {NAV_HELP_SECTIONS.map((section) => (
                    <div key={section.id}>
                      <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between px-4 py-3 ltr:text-left rtl:text-right font-semibold text-base hover:bg-slate-50 transition-colors">
                        <span>{t(section.title)}</span>
                        {expandedSections[section.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {expandedSections[section.id] && (
                        <div className="border rounded-md ltr:ml-2 rtl:mr-2">
                          {section.items.map((item, idx) => (
                            <button key={item.id} onClick={() => setSelectedId(item.id)}
                              className={`w-full ltr:text-left rtl:text-right px-4 py-2.5 text-sm text-primary-700 hover:bg-slate-50 transition-colors ${idx < section.items.length - 1 ? "border-b" : ""} ${selectedId === item.id ? "bg-slate-100 font-medium" : ""}`}>
                              {t(item.title)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex-1 border-l p-6">{renderContent()}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                        const globalIndex = RM_FAQS.indexOf(faq);
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

        <TabsContent value="contact-us">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="md:w-1/3"><h2 className="text-3xl font-bold leading-tight">{t("Get in touch with us.")}</h2></div>
                <div className="md:w-2/3 space-y-4 bg-slate-50 rounded-lg p-6">
                  <div className="space-y-1.5"><Label>{t("Your Name")}</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>{t("Phone number")}</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>{t("Company Name")}</Label><Input value={contactCompany} onChange={(e) => setContactCompany(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>{t("Your Message")}</Label><Textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder={t("Type Your Message...")} rows={4} /></div>
                  <p className="text-xs text-muted-foreground">{t("By submitting this form you agree to our terms and conditions and our Privacy Policy which explains how we may collect, use and disclose your personal information including to third parties.")}</p>
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSendRequest} disabled={sending}>{sending ? t("Sending...") : t("Send Request")}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
