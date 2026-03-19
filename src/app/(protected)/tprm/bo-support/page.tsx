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
import { Home, ChevronRight, ChevronDown, Search } from "lucide-react";

interface FAQItem { question: string; answer: string; category: string; }

const BO_FAQS: FAQItem[] = [
  // Getting Started
  { category: "Getting Started", question: "What is the role of a Business Owner (BO) in TPRM?", answer: "The Business Owner is the primary vendor relationship lead responsible for onboarding vendors, initiating assessments, managing contracts, handling issue remediation decisions (accept risk, send to vendor, or terminate), approving offboarding, and overseeing the overall vendor risk posture through dashboards and reports." },
  { category: "Getting Started", question: "What menus are available for a Business Owner?", answer: "As a BO, you have access to: Dashboard (risk overview and assessment status), RM Management (create/manage Relationship Managers), Vendor Inventory (onboard and manage vendors), Assessments (track assessment progress), Issue Management (issue register and remediation), Contracts (manage vendor contracts), Assessment Factory (bulk AI assessments), Monitoring (continuous vendor monitoring), and Support." },
  { category: "Getting Started", question: "How do I navigate the BO Dashboard?", answer: "The BO Dashboard provides visual charts showing: Assessment Progress (Initiated/In Progress/Completed), Inherent Risk breakdown by VRR (Critical/High/Moderate/Low/Nominal), Assessment Results (Satisfactory/Unsatisfactory/Deficient), Issue Status, Open/Overdue Issues by Severity, Top 5 Vendors by Risk, and Top 5 Domains by Risk. Click on any chart element to drill down for more details." },

  // Relationship Manager
  { category: "Relationship Managers", question: "How do I create a Relationship Manager (RM)?", answer: "Go to the RM Management menu, click 'Onboard New Relationship Manager' to open the 'New Account' pop-up. Fill in Full Name, Username, and Email (the Department is based on your department). Add a profile image and mark the user as Active, then click Save. The RM can then help you manage vendor onboarding and assessments." },
  { category: "Relationship Managers", question: "What can a Relationship Manager do?", answer: "An RM can manage vendor relationships, view and initiate assessments for assigned vendors, manage contracts, handle issue remediation, and view monitoring data. They have similar access to BO except they cannot manage users. RMs are typically created by the BO to delegate vendor management tasks." },

  // Vendor Onboarding
  { category: "Vendor Onboarding", question: "How do I onboard a new vendor?", answer: "Go to Vendor Inventory, click 'Onboard New Vendor'. Fill in Vendor Name, Engagements, Service Description, and Contact Number. Select or create an Account Manager (AM). Choose the Service Category and fill in any additional fields. Then respond to the Onboarding Questions — based on your responses, the Vendor Risk Rating (VRR) will be calculated and questionnaires will be recommended for assessment." },
  { category: "Vendor Onboarding", question: "What is a Vendor Risk Rating (VRR)?", answer: "The VRR is an automatically calculated risk classification for each vendor based on their onboarding questionnaire responses and assessment results. VRR levels are: Critical, High, Moderate, Low, and Nominal. The VRR determines the assessment cadence (how often periodic assessments are triggered) and remediation periods for identified issues." },
  { category: "Vendor Onboarding", question: "Can I import vendors in bulk?", answer: "Yes, you can bulk import vendors using a CSV file. Go to Vendor Management, click the Import button, and download the template first. Fill in the vendor details in the template format, then upload the completed file. The system will validate and create vendor records for each row." },
  { category: "Vendor Onboarding", question: "What happens after I onboard a vendor?", answer: "After onboarding, the vendor status changes to 'Onboarded'. If you clicked 'Initiate Assessment' during onboarding, an assessment request is sent to the Account Manager (AM) to respond to the questionnaire. The assessment then goes through the review cycle: AM responds → Assessor reviews → Approver approves → Risk rating finalized." },

  // Assessments
  { category: "Assessments", question: "What types of assessments are available?", answer: "There are four types: (1) Onboarding/Due Diligence Assessment — initiated during vendor onboarding. (2) On-Demand Assessment — initiated any time for existing vendors with active contracts. (3) Periodic Assessment — automatically triggered by the system based on VRR cadence configuration. (4) Offboard Assessment — initiated during vendor offboarding or 30 days before contract expiry." },
  { category: "Assessments", question: "How do I initiate an On-Demand assessment?", answer: "Go to Vendor Inventory, select the existing vendor engagement, and click 'Initiate Assessment'. Choose the questionnaire template(s) to include. The assessment request will be submitted to the Assessor for further processing." },
  { category: "Assessments", question: "How are Periodic Assessments scheduled?", answer: "Periodic assessments are automatically scheduled based on the VRR cadence configuration set by the administrator. Typical cadences are: Critical vendors — every 1 month, High — every 3 months, Moderate — every 6 months, Low — every 24 months, Nominal — every 36 months. If an On-Demand assessment occurs before a scheduled periodic one, the next periodic assessment is rescheduled based on the On-Demand completion date." },
  { category: "Assessments", question: "What do the assessment statuses mean?", answer: "Draft — assessment created but not yet sent. Awaiting Response — sent to vendor, waiting for their answers. Submitted — vendor has submitted responses. In Progress — assessor is reviewing. Returned — sent back to vendor for additional information. Reviewed — assessor has completed review. Approved — approver has approved. Completed — assessment fully done with risk rating calculated." },
  { category: "Assessments", question: "What is the Assessment Factory?", answer: "The Assessment Factory allows bulk AI-powered assessments without the full end-to-end workflow. A Factory Assessor uploads an Excel template with questionnaire data plus artifact files (evidence documents). The AI backend analyzes the documents and generates assessment responses with confidence scores. This is useful for processing multiple vendor assessments quickly." },

  // Issue Management
  { category: "Issue Management", question: "How does issue remediation work?", answer: "After an assessment is completed, the Approver generates a report listing identified issues. These issues appear in your Issue Management section. The RM assigns issues to you for decision. You can choose to: Accept Risk (closes the issue), Send to Vendor (for further action), or Send to Assessor (for recalibration)." },
  { category: "Issue Management", question: "What are the issue severity levels?", answer: "Issues are classified as High, Medium, or Low severity. High severity issues require urgent remediation within the shortest timeframe. The remediation deadline is automatically calculated based on the vendor's VRR and the severity level, as configured in the Control Center." },
  { category: "Issue Management", question: "Can I terminate a vendor based on issues?", answer: "Yes. When the RM assigns an issue to you for vendor termination decision, you can choose to: Accept Risk, Avoid Risk (Vendor termination), or Send to Assessor for recalibration. Choosing to terminate the vendor will initiate an Offboard Assessment to the vendor." },

  // Contracts
  { category: "Contracts", question: "When should I add a contract?", answer: "Contracts should be added only after the assessment is completed and approved. You will receive a notification when the assessment is done. Go to Vendor Inventory, select the vendor engagement, and click 'Add Contract' to upload the signed contract. VerifAI can optionally extract security obligations from the contract." },
  { category: "Contracts", question: "How do I manage expiring contracts?", answer: "Contracts with less than 30 days to expiry are flagged in the 'Expiring Contracts' section and you receive a notification. You have two options: (1) Renew Contract — if no scope changes, extend by adding a new date; if scope changes, a new engagement is created for due diligence. (2) Start Offboarding — initiates an offboard assessment to the vendor. Contracts are automatically terminated if no action is taken before expiry." },
  { category: "Contracts", question: "Can I delete a vendor contract?", answer: "Contract deletion requires a formal request process for audit trail purposes. You can submit a contract deletion request, which will be reviewed and approved by the administrator before the contract document is removed." },

  // Offboarding
  { category: "Offboarding", question: "How do I offboard a vendor?", answer: "Vendor offboarding is done through an Offboarding Assessment. It can be initiated by the RM during the due diligence stage or by you during the contract expiry stage. The vendor responds to the offboard questionnaire, the Assessor reviews it, then the RM approves, and finally you give final BO approval. Once completed, the vendor status is marked as 'Offboarded'." },
  { category: "Offboarding", question: "What is the offboarding approval chain?", answer: "Offboarding follows a multi-step approval process: (1) Account Manager fills the offboard questionnaire, (2) Assessor reviews the responses, (3) Relationship Manager approves, (4) Business Owner gives final approval. The vendor is only marked as Offboarded after all steps are complete." },

  // Monitoring
  { category: "Monitoring", question: "What is Continuous Monitoring?", answer: "Continuous Monitoring provides ongoing security assessment of your vendors between formal assessments. It tracks KPI metrics including Network Security, DNS Health, Patching, IP Reputation, Email Security, SSL/TLS, Privacy, and Breach Information. The system generates an overall security posture score and automatically creates issues from high-risk findings." },
  { category: "Monitoring", question: "How often are monitoring scans performed?", answer: "Monitoring scan frequency can be configured by the administrator. Scans can also be triggered manually from the Monitoring page. Results show the vendor's security posture, threat exposure, and any vulnerabilities detected." },

  // Reports & General
  { category: "Reports & General", question: "What reports are available for BO?", answer: "The BO Reports section provides assessment reports for completed assessments, vendor risk summaries, issue remediation status, and trend analysis. Reports can be viewed on-screen or downloaded for offline review." },
  { category: "Reports & General", question: "How do I search for a specific vendor?", answer: "Use the search bar at the top of the Vendor Inventory page to search by vendor name, vendor code, or service category. You can also filter vendors by status (Onboarding, Onboarded, Offboarding, Offboarded) and by VRR level." },
];

interface SubItem { id: string; title: string; }
interface NavSection { id: string; title: string; items: SubItem[]; }

const NAV_HELP_SECTIONS: NavSection[] = [
  {
    id: "process-flows",
    title: "Process Flows",
    items: [
      { id: "pf-creating-rm", title: "Creating Relationship Managers(RM)" },
      { id: "pf-onboarding", title: "Onboarding Vendors" },
      { id: "pf-assessments", title: "Initiating Assessments" },
      { id: "pf-issues", title: "Remediating Issues" },
      { id: "pf-contracts", title: "Managing Contracts" },
      { id: "pf-offboarding", title: "Offboarding Vendors" },
      { id: "pf-factory", title: "Using Assessment Factory" },
    ],
  },
  {
    id: "menus",
    title: "Menus",
    items: [
      { id: "m-dashboard", title: "Dashboard" },
      { id: "m-rm-management", title: "RM Management" },
      { id: "m-inventory", title: "Vendor Inventory" },
      { id: "m-assessments", title: "Assessments" },
      { id: "m-issues", title: "Issue Management" },
      { id: "m-contracts", title: "Contracts" },
      { id: "m-factory", title: "Assessments Factory" },
    ],
  },
];

/* ── Right-panel content components ── */

function ProcessFlowsContent({ t }: { t: (s: string) => string }) {
  return (<><h2 className="text-2xl font-light text-slate-500 mb-3">{t("Process Flows")}</h2><p className="text-sm text-muted-foreground">{t("This section outlines the various process flows that are applicable to the role of a Business Owner (BO).")}</p></>);
}
function MenusContent({ t }: { t: (s: string) => string }) {
  return (<><h2 className="text-2xl font-light text-slate-500 mb-3">{t("Menus")}</h2><p className="text-sm text-muted-foreground">{t("This section outlines the purpose of each menu along with their elements.")}</p></>);
}

function CreatingRMContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Creating Relationship Managers(RM)")}</h2>
      <ol className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("To create an RM, go to the RM Management menu")}</li>
        <li>{t('Click on "Onboard New Relationship Manager" to open the "New Account" pop-up menu')}</li>
        <li>{t("Fill in the details of Full Name, Username, Email (The Department Field is based on BO's department)")}</li>
        <li>{t('Add "Profile Image" and mark the user as "Active" using checkbox')}</li>
        <li>{t('Click on "Save" to add the RM')}</li>
      </ol>
      <p className="text-sm text-muted-foreground italic">{t("A Business Owner typically creates an RM to delegate the process of Onboarding Vendors")}</p>
    </>
  );
}

function OnboardingVendorsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Onboarding Vendors")}</h2>
      <h3 className="text-base font-semibold mb-2">{t("Adding Vendors to the Inventory")}</h3>
      <ol className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t("To onboard a Vendor, go to the")} <strong>{t("Vendor Inventory")}</strong> {t("menu")}</li>
        <li>{t('Click on "Onboard New Vendor" to open Vendor Onboarding screen')}</li>
        <li>{t("Fill in the details of Vendor Name, Engagements, Service Description, Contact Number")}</li>
        <li>{t("Select Account Manager (AM) if Vendor name has an AM associated with it")}</li>
        <li>{t("If AM is not listed, fill in the details of AM name & E-mail ID")}</li>
        <li>{t("Choose the Service category")} <em>({t("based on Admin Configuration")})</em></li>
        <li>{t("Fill in additional details")} <em>({t("if applicable based on Admin Configuration of Vendor Profile Fields")})</em></li>
      </ol>
      <h3 className="text-base font-semibold mt-5 mb-2">{t("Evaluating Vendor Risk Rating")}</h3>
      <ol start={8} className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t("Respond to the Onboarding Questions")} <em>({t("based on Admin Configuration")})</em></li>
        <li>{t('Click "Next" to Check Risk Rating and')}<p className="italic mt-1">{t("Depending on the response provided for the Onboarding questions, the VRR will be calculated and the Questionnaires that were assigned will be recommended for the assessment process.")}</p></li>
        <li>{t('Clicking on "Initiate Assessment" button will start the Due Diligence assessment process and adds the Vendor to the Inventory')}</li>
      </ol>
    </>
  );
}

function InitiatingAssessmentsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Initiating Assessments")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("There are four types of Assessments available in VerifAI TPRM")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1 text-sm text-muted-foreground mb-4">
        <li>{t("Onboarding Assessment/Due Diligence Assessment")}</li>
        <li>{t("On-Demand Assessments")}</li>
        <li>{t("Periodic Assessments")}</li>
        <li>{t("Offboard Assessments")}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Onboarding Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t('Onboarding Assessments are initiated at the end of the "Onboard New Vendor" process')}</li>
        <li>{t("The BO selects the Questionnaires that should be included for the assessment")}</li>
        <li>{t('Clicking on "Initiate Assessment" button submits the Assessment to the Vendor')}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("On-Demand Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("On-Demand Assessments can be initiated any time for existing Vendors with Active Contract")}</li>
        <li>{t("To initiate the Assessment, go to the Vendor Inventory and select the Existing Vendor")}</li>
        <li>{t('Clicking on "Initiate Assessment" button submits the Assessment Request to the Assessor for further actions')}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Periodic Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("Periodic Assessments are initiated automatically by VerifAI")}</li>
        <li>{t("The period is scheduled based on the Cadence configuration of VRR done by the administrator")}</li>
        <li><em>{t("Note: If an On-Demand assessment takes place before the scheduled Periodic Assessment, the next periodic assessment will be rescheduled based on the completion date of the On-Demand assessment and cadence configuration")}</em></li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Offboard Assessments")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t("Offboarding Assessments can be initiated during the Remediation process or 30 days before the Contract Expiry")}</li>
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
        <li>{t("After the Assessment is completed, the Approver generates a report with the list of identified issues")}</li>
        <li>{t("The report updates the Issue Register and Issue Remediation sections for all the stakeholders who were involved in the Onboarding process")}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Risk Acceptance")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("The RM shall assign an issue to the BO for decision on Risk Acceptance")}</li>
        <li>{t("The BO can choose between 3 options, adding comments accordingly")}</li>
        <li className="ltr:ml-4 rtl:mr-4">{t("Accept Risk")}</li>
        <li className="ltr:ml-4 rtl:mr-4">{t("Send to Vendor (for further action)")}</li>
        <li className="ltr:ml-4 rtl:mr-4">{t("Send to Assessor (for recalibration)")}</li>
        <li>{t("Accepting the Risk will resolve the issue, and the status will be updated as closed")}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Terminate Vendor")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t("The RM shall assign an issue to the BO for decision on Vendor Termination")}</li>
        <li>{t("The BO can choose between 3 options, adding comments accordingly")}</li>
        <li className="ltr:ml-4 rtl:mr-4">{t("Accept Risk")}</li>
        <li className="ltr:ml-4 rtl:mr-4">{t("Vendor (Avoid Risk)")}</li>
        <li className="ltr:ml-4 rtl:mr-4">{t("Send to Assessor (for recalibration)")}</li>
        <li>{t("Choosing to terminate the Vendor will initiate the Offboard assessment to the Vendor")}</li>
      </ul>
    </>
  );
}

function ManagingContractsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Managing Contracts")}</h2>
      <p className="text-sm text-muted-foreground mb-2">{t("The Contracts menu allows the BO to view and manage contracts.")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t('"All Vendor Contracts" section keeps track of all the Active Contracts')}</li>
        <li>{t("Expiring Contracts section lists the Contract that have less than 30 days to expire")}</li>
      </ul>
      <h3 className="text-base font-semibold mb-2">{t("Adding Contracts")}</h3>
      <p className="text-sm text-muted-foreground italic mb-2">{t("Once the Assessment is completed and approved, a notification will be received by the BO to add the Contract (Contracts should be added only after the completion of the assessment).")}</p>
      <ol className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-4">
        <li>{t("To add contract, go to the Vendor Inventory")}</li>
        <li>{t("Select the Vendor engagement for whom the assessment is completed")}</li>
        <li>{t('Click on the "Add contract" button and upload the signed contract')}</li>
        <li>{t("Once contract is added, if required VerifAI can be used to extract the security obligations mentioned in the contract.")}</li>
      </ol>
      <h3 className="text-base font-semibold mb-2">{t("Managing Expiring Contracts")}</h3>
      <p className="text-sm text-muted-foreground mb-2">{t('Contracts that have less than 30 days to expire will be notified to the BO and moved to the "Expiring Contracts" section. The BO now has two options to choose from')}</p>
      <p className="text-sm font-medium mt-3 mb-1">{t("Renew Contract")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-3">
        <li>{t('After clicking on "Renew Contract", a check on Change of Scope will be done')}</li>
        <li>{t("If there are no changes to scope, the contract can be extended by adding the new extended date")}</li>
        <li>{t("If there are changes to scope, a new engagement will be created to initiate the Due Diligence process")}</li>
      </ul>
      <p className="text-sm font-medium mb-1">{t("Start Offboarding")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-3">
        <li>{t('Clicking on "Start Offboarding", will initiate the Offboard assessment to the Vendor')}</li>
      </ul>
      <p className="text-sm text-muted-foreground italic">{t("Note: Contracts will be automatically terminated if no action is taken before the date of expiry")}</p>
    </>
  );
}

function OffboardingVendorsContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Offboarding Vendors")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("Vendors are offboarded by conducting Offboarding Assessment.")}</p>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t("Offboarding Assessments are initiated either by RM during Due Diligence stage or by BO during Contract Expiring stage")}</li>
        <li>{t("Once the Offboarding assessment is initiated, the request will be submitted to the Vendor")}</li>
        <li>{t("The Vendor responds to the assessment and submits it to the Assessor")}</li>
        <li>{t("Once the assessment is completed and approved by Assessor, the Vendor status will be marked as Terminated in the Vendor Inventory")}</li>
      </ul>
    </>
  );
}

function UsingAssessmentFactoryContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Using Assessment Factory")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Assessment Factory is used exclusively for conducting Assessment without undergoing the end-to-end workflow required for Due Diligence process")}</p>
      <ol className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t('To perform assessment, download the template by clicking on "Download template" icon')}</li>
        <li>{t("Fill in all the details of the questionnaire as required by the template format")}</li>
        <li>{t('Once completed, upload the completed template by clicking on "Upload Template" icon and locating the file using "Browse" button.')}</li>
        <li>{t("After uploading the template, upload all the Artifacts that need to be analyzed against the responses provided by the Vendor for each question")}</li>
        <li>{t('Click on "Generate Report" button to obtain the Factory Assessment Report.')}</li>
      </ol>
    </>
  );
}

function DashboardContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Dashboard")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Dashboard provides a visually engaging representation of data through charts, enhancing the user experience and facilitating richer data consumption.")}</p>
      <p className="text-sm text-muted-foreground mb-3">{t("There are two standard Dashboards available for BO")}</p>
      <div className="space-y-3">
        <div><h3 className="text-sm font-semibold">{t("Vendor Criticality")}</h3><p className="text-sm text-muted-foreground">{t("Distribution of Vendors across various Vendor Risk Rating")}</p></div>
        <div><h3 className="text-sm font-semibold">{t("Assessment Status")}</h3><p className="text-sm text-muted-foreground">{t("Tracks the status of Ongoing Assessments")}</p></div>
      </div>
    </>
  );
}

function RMManagementContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("RM Management")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The RM Management facilitates BO for creating and managing Relationship Managers (RM). It shows a list of all the RMs that were onboarded by the BO.")}</p>
      <h3 className="text-base font-semibold mb-2">{t("Managing RM Users")}</h3>
      <ul className="list-disc ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground mb-3">
        <li>{t('To Add* an RM, click on the "Onboard New Relationship Manager" button')}</li>
        <li>{t('To Edit an RM, click on the "Pencil" icon for that RM')}</li>
        <li>{t('To Delete an RM, click on the "Bin" icon for that RM')}</li>
      </ul>
      <p className="text-xs text-muted-foreground italic">{t("*Refer Creating RM under Process Flow section for detailed process")}</p>
    </>
  );
}

function VendorInventoryContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Vendor Inventory")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Vendor Inventory menu is the storehouse of all the vendors that have been onboarded by either BO and is used for managing the lifecycle of vendors from Onboarding* to Offboarding**.")}</p>
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
      <p className="text-sm text-muted-foreground mb-3">{t("The Assessments menu keeps track of all the assessments that were initiated by the RM.")}</p>
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
      <p className="text-sm text-muted-foreground mb-3">{t("The Contracts menu is used for managing* Vendor contracts which involves renewing expiring contracts starting the offboarding process.")}</p>
      <p className="text-xs text-muted-foreground italic">{t("*Refer Managing Contracts under Process Flow section for detailed process.")}</p>
    </>
  );
}

function AssessmentFactoryContent({ t }: { t: (s: string) => string }) {
  return (
    <>
      <h2 className="text-2xl font-light text-slate-500 mb-4">{t("Assessment Factory")}</h2>
      <p className="text-sm text-muted-foreground mb-3">{t("The Assessment Factory is used exclusively for conducting assessments without undergoing the end-to-end workflow required for the Due Diligence process.")}</p>
      <ol className="list-decimal ltr:ml-6 rtl:mr-6 space-y-1.5 text-sm text-muted-foreground">
        <li>{t('To perform an assessment, download the template by clicking on the "Download template" icon.')}</li>
        <li>{t("Fill in all the details of the questionnaire as required by the template format.")}</li>
        <li>{t('Once completed, upload the completed template by clicking on the "Upload Template" icon and locating the file using the "Browse" button.')}</li>
        <li>{t("After uploading the template, upload all the artifacts that need to be analyzed against the responses provided by the Vendor for each question.")}</li>
        <li>{t('Click on the "Generate Report" button to obtain the Factory Assessment Report.')}</li>
      </ol>
    </>
  );
}

export default function BOSupportPage() {
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
    ? BO_FAQS.filter(f => f.question.toLowerCase().includes(faqSearch.toLowerCase()) || f.answer.toLowerCase().includes(faqSearch.toLowerCase()) || f.category.toLowerCase().includes(faqSearch.toLowerCase()))
    : BO_FAQS;

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
      case "pf-creating-rm": return <CreatingRMContent t={t} />;
      case "pf-onboarding": return <OnboardingVendorsContent t={t} />;
      case "pf-assessments": return <InitiatingAssessmentsContent t={t} />;
      case "pf-issues": return <RemediatingIssuesContent t={t} />;
      case "pf-contracts": return <ManagingContractsContent t={t} />;
      case "pf-offboarding": return <OffboardingVendorsContent t={t} />;
      case "pf-factory": return <UsingAssessmentFactoryContent t={t} />;
      case "m-dashboard": return <DashboardContent t={t} />;
      case "m-rm-management": return <RMManagementContent t={t} />;
      case "m-inventory": return <VendorInventoryContent t={t} />;
      case "m-assessments": return <AssessmentsContent t={t} />;
      case "m-issues": return <IssueManagementContent t={t} />;
      case "m-contracts": return <ContractsContent t={t} />;
      case "m-factory": return <AssessmentFactoryContent t={t} />;
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
                        const globalIndex = BO_FAQS.indexOf(faq);
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
