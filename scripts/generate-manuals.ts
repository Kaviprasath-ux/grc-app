/**
 * Generate Word (.docx) User Manuals for GRC and TPRM modules.
 *
 * Usage:  npx tsx scripts/generate-manuals.ts
 * Output: manuals/ directory with all .docx files
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, BorderStyle, WidthType,
  AlignmentType, PageBreak, Header, Footer,
  ShadingType, ImageRun,
} from "docx";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "manuals", "screenshots");
const COMPANY_NAME = "Glimmora International";

// ─── Colour palette ─────────────────────────────────────────────
const BRAND = {
  primary: "1e40af",
  accent:  "2563eb",
  dark:    "1e293b",
  gray:    "64748b",
  light:   "f1f5f9",
  white:   "ffffff",
};

// ─── Helper builders ────────────────────────────────────────────

function title(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 56, color: BRAND.primary, font: "Calibri" })],
    spacing: { after: 400 },
    alignment: AlignmentType.CENTER,
  });
}

function subtitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 28, color: BRAND.gray, font: "Calibri" })],
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
  });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 36, color: BRAND.primary, font: "Calibri" })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND.primary, space: 4 } },
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: BRAND.dark, font: "Calibri" })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: BRAND.accent, font: "Calibri" })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

function para(text: string, opts?: { bold?: boolean; italic?: boolean }): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri", bold: opts?.bold, italics: opts?.italic, color: BRAND.dark })],
    spacing: { after: 120 },
  });
}

function bullet(text: string, level = 0): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri", color: BRAND.dark })],
    bullet: { level },
    spacing: { after: 60 },
  });
}

function note(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: "Note: ", bold: true, size: 22, font: "Calibri", color: BRAND.accent }),
      new TextRun({ text, size: 22, font: "Calibri", italics: true, color: BRAND.gray }),
    ],
    spacing: { after: 120 },
    indent: { left: 360 },
  });
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, font: "Calibri", color: BRAND.white })],
      alignment: AlignmentType.CENTER,
    })],
    shading: { type: ShadingType.SOLID, color: BRAND.primary },
    width: { size: 0, type: WidthType.AUTO },
  });
}

function cell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, font: "Calibri", color: BRAND.dark })],
    })],
    width: { size: 0, type: WidthType.AUTO },
  });
}

function simpleTable(headers: string[], rows: string[][]): Table {
  return new Table({
    rows: [
      new TableRow({ children: headers.map(h => headerCell(h)) }),
      ...rows.map(r => new TableRow({ children: r.map(c => cell(c)) })),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function pb(): Paragraph { return new Paragraph({ children: [new PageBreak()] }); }
function spacer(): Paragraph { return new Paragraph({ spacing: { after: 200 }, children: [] }); }

// Screenshot filename mapping for each page
const SCREENSHOT_MAP: Record<string, string> = {
  // GRC pages
  "Organization Profile": "grc/org_profile.png",
  "Organization Context": "grc/org_context.png",
  "Users": "grc/org_users.png",
  "Business Processes": "grc/org_process.png",
  "Organization Settings": "grc/org_settings.png",
  "Framework Selection": "grc/compliance_frameworks.png",
  "Control Assessment": "grc/compliance_controls.png",
  "Governance Documents": "grc/compliance_governance.png",
  "Evidence Management": "grc/compliance_evidence.png",
  "Exceptions": "grc/compliance_exceptions.png",
  "KPIs": "grc/compliance_kpis.png",
  "Risk Matrix": "grc/compliance_risk_matrix.png",
  "Risk Dashboard": "grc/risk_dashboard.png",
  "Risk Register": "grc/risk_register.png",
  "Risk Assessment": "grc/risk_assessment.png",
  "Risk Response": "grc/risk_response.png",
  "Risk Control Matrix": "grc/risk_control_matrix.png",
  "Asset Inventory": "grc/asset_inventory.png",
  "Asset Classification": "grc/asset_classification.png",
  "Audit Dashboard": "grc/audit_dashboard.png",
  "Audit Universe": "grc/audit_universe.png",
  "Audit Planning": "grc/audit_planning.png",
  "Fieldwork": "grc/audit_fieldwork.png",
  "CAPA Tracking": "grc/audit_capa.png",
  "Audit Reports": "grc/audit_report.png",
  "Customer Accounts": "grc/grc_customer_accounts.png",
  "GRC Dashboard": "grc/grc_dashboard.png",
  "Email Settings": "grc/grc_email_settings.png",
  // TPRM pages
  "RM Dashboard": "tprm/rm_dashboard.png",
  "BO Dashboard": "tprm/bo_dashboard.png",
  "Assessor Dashboard": "tprm/asr_dashboard.png",
  "Program Monitor": "tprm/program_monitor.png",
  "Control Center": "tprm/control_center.png",
  "Vendor Management (Admin)": "tprm/vendor_management.png",
  "RM Vendor Inventory": "tprm/rm_inventory.png",
  "BO Vendor Inventory": "tprm/bo_inventory.png",
  "Assessor Vendor Inventory": "tprm/asr_inventory.png",
  "RM Assessments": "tprm/rm_assessments.png",
  "BO Assessments": "tprm/bo_assessments.png",
  "AM Assessments": "tprm/am_assessments.png",
  "Assessor Assessments": "tprm/asr_assessments.png",
  "Approver Assessments": "tprm/approver_assessments.png",
  "CAIQ Questions": "tprm/caiq_questions.png",
  "Vendor Monitoring": "tprm/monitoring.png",
  "Assessor Issue Register": "tprm/asr_issue_register.png",
  "RM Issue Register": "tprm/rm_issues.png",
  "BO Issues": "tprm/bo_issues.png",
  "BO Contracts": "tprm/bo_contracts.png",
  "RM Contracts": "tprm/rm_contracts.png",
  "TPRM Reports": "tprm/reports.png",
  "TPRM User Management": "tprm/user_management.png",
  "Configurations": "tprm/configurations.png",
};

function screenshotParagraph(pageName: string): Paragraph | null {
  const filename = SCREENSHOT_MAP[pageName];
  if (!filename) return null;
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    const imageData = fs.readFileSync(filePath);
    return new Paragraph({
      children: [
        new ImageRun({
          data: imageData,
          transformation: { width: 580, height: 340 },
          type: "png",
        }),
      ],
      spacing: { before: 200, after: 200 },
      alignment: AlignmentType.CENTER,
    });
  } catch {
    return null;
  }
}

function loginScreenshot(): Paragraph | null {
  const filePath = path.join(SCREENSHOTS_DIR, "login.png");
  if (!fs.existsSync(filePath)) return null;
  try {
    const imageData = fs.readFileSync(filePath);
    return new Paragraph({
      children: [
        new ImageRun({
          data: imageData,
          transformation: { width: 500, height: 300 },
          type: "png",
        }),
      ],
      spacing: { before: 200, after: 200 },
      alignment: AlignmentType.CENTER,
    });
  } catch {
    return null;
  }
}

function makeHeader(text: string): Header {
  return new Header({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 16, font: "Calibri", color: BRAND.gray, italics: true })],
      alignment: AlignmentType.RIGHT,
    })],
  });
}

function makeFooter(): Footer {
  return new Footer({
    children: [new Paragraph({
      children: [new TextRun({ text: `Confidential — ${COMPANY_NAME}`, size: 16, font: "Calibri", color: BRAND.gray })],
      alignment: AlignmentType.CENTER,
    })],
  });
}

// ─── Content Data Structures ────────────────────────────────────

interface PageInfo {
  name: string;
  description: string;
  features: string[];
  navPath: string;
}

interface ModuleSection {
  name: string;
  description: string;
  pages: PageInfo[];
}

interface RoleInfo {
  name: string;
  displayName: string;
  description: string;
  accessibleModules: string[];
  keyCapabilities: string[];
  moduleKeys: string[];  // keys into module map for role-specific manuals
}

// ======================== GRC MODULE DATA ========================

const GRC_MODULES: ModuleSection[] = [
  {
    name: "Organization",
    description: "Manage your organization's profile, context, stakeholders, business processes, users, and business impact analysis. This module establishes the foundational information that other GRC modules reference.",
    pages: [
      {
        name: "Organization Profile",
        description: "View and manage the organization's identity record including name, email, phone, logo, established date, employee count, branch count, head office location, website, vision, mission, values, CEO message, social media links, and brochure.",
        features: [
          "View organization details (name, industry, size, location, contact)",
          "Edit organization profile information",
          "Upload organization logo and brochure",
          "Set regulatory jurisdiction and compliance requirements",
          "Manage branches (location, address per branch)",
          "Manage data centers (location type, address, vendor)",
          "Manage cloud providers (name, service type)",
          "Social media links (Facebook, YouTube, Twitter, LinkedIn)",
        ],
        navPath: "Sidebar → Organization → Profile",
      },
      {
        name: "Organization Context",
        description: "Define internal and external context factors that affect the organization's risk and compliance posture. Manage stakeholders, interested parties, and context issues with preventive/corrective actions.",
        features: [
          "Define internal context factors (culture, governance, capabilities)",
          "Define external context factors (regulatory, market, technology)",
          "Manage stakeholders (add, edit, delete) with type and status",
          "Assign departments to stakeholders",
          "Email and contact management per stakeholder",
          "Document and file attachments for context records",
          "Issue actions tracking (preventive and corrective actions)",
          "Search and download context data",
        ],
        navPath: "Sidebar → Organization → Context",
      },
      {
        name: "Users",
        description: "Manage user accounts within your organization. Create users, assign roles, set departments, configure language preferences, and track login activity.",
        features: [
          "List all users with role, department, and status",
          "Create new users (username, email, first name, last name, designation, function)",
          "Assign roles by function (Business, Security, Audit)",
          "Department assignment and reporting manager",
          "Language preferences and timezone configuration",
          "Last login tracking",
          "User activation and blocking",
          "Bulk import/export of user lists",
          "Search and filter users",
        ],
        navPath: "Sidebar → Organization → Users",
      },
      {
        name: "Business Processes",
        description: "Document and manage business processes. Processes can be linked to risks, controls, and assets for comprehensive traceability. Each process supports KPI tracking and BIA assessment.",
        features: [
          "List all business processes with filtering and search",
          "Create new processes (name, code, owner, department, description)",
          "Edit existing process information",
          "Delete processes",
          "Process KPI tracking per process",
          "BIA (Business Impact Analysis) per process",
          "Link processes to risks and controls",
          "Classify process criticality",
          "Process hierarchy support",
          "Export process data",
        ],
        navPath: "Sidebar → Organization → Process",
      },
      {
        name: "Business Impact Analysis (BIA)",
        description: "Conduct business impact analysis to identify critical processes, determine recovery priorities, and establish RTO/RPO targets. Configure BIA categories and methodology.",
        features: [
          "List BIA records with impact ratings",
          "Create BIA entries for business processes",
          "Define RTO (Recovery Time Objective) and RPO (Recovery Point Objective)",
          "Set impact ratings (financial, operational, reputational, legal)",
          "Determine process criticality based on impact analysis",
          "Configure BIA categories with sort order and active status",
          "Configure BIA methodology and approach",
          "Business Continuity Planning (BCP) labels configuration",
          "Edit and delete BIA records",
        ],
        navPath: "Sidebar → Organization → Settings → BIA",
      },
      {
        name: "Organization Settings",
        description: "Configure organization-level settings including BIA categories, BIA methodology, BCP labels, and translations.",
        features: [
          "BIA Categories — define assessment categories with sort order and active status",
          "BIA Methodology — configure BIA assessment approach",
          "BCP Labels — business continuity planning labels",
          "Translations — manage organization-level translations",
        ],
        navPath: "Sidebar → Organization → Settings",
      },
    ],
  },
  {
    name: "Compliance",
    description: "Manage compliance frameworks, controls, governance documents, evidence collection, exceptions, KPIs, risk matrices, and reporting. This module provides comprehensive compliance lifecycle management aligned with industry standards like ISO 27001, NIST, SOC 2, and GDPR.",
    pages: [
      {
        name: "Framework Selection",
        description: "Browse and adopt compliance frameworks (ISO 27001, NIST, SOC 2, GDPR, etc.). Selected frameworks populate controls and requirements. Track compliance percentage, policy percentage, and evidence percentage per framework.",
        features: [
          "Browse available compliance frameworks (cards/grid view)",
          "View framework details (code, name, description, type, status, country, industry)",
          "Select/adopt frameworks for your organization",
          "Track compliance percentage, policy percentage, evidence percentage",
          "Custom vs. standard framework differentiation",
          "Import framework templates from Excel",
          "Export framework data",
          "Download framework template",
          "Framework subscription/access management",
          "Pagination support",
        ],
        navPath: "Sidebar → Compliance → Frameworks",
      },
      {
        name: "Control Assessment",
        description: "Manage and assess compliance controls derived from adopted frameworks. Each control maps to framework requirements and can be linked to evidence and risks.",
        features: [
          "List all controls with status indicators (Compliant, Partially Compliant, Non-Compliant, Not Assessed)",
          "View control details (code, name, description, domain, category, status)",
          "Assess control effectiveness",
          "Link controls to evidence items",
          "Map controls to risks",
          "Multi-select column filtering",
          "Filter by framework, domain, status",
          "Bulk assessment capabilities",
          "Create, edit, delete controls",
          "Pagination support",
        ],
        navPath: "Sidebar → Compliance → Controls",
      },
      {
        name: "Governance Documents",
        description: "Manage policies, procedures, standards, and guidelines. Track document lifecycle including creation, review, approval, and version history. Documents link to frameworks and controls.",
        features: [
          "List all governance documents with version and status",
          "Create new documents (policy, procedure, standard, guideline)",
          "Document properties: code, name, version, document type",
          "Edit document content and metadata",
          "Document review and approval workflow",
          "Version history tracking",
          "Set review schedules and due dates (policy recurrence)",
          "Assign document owners and reviewers",
          "Upload supporting files/attachments",
          "Link documents to frameworks and controls",
          "Evidence attachment support",
          "Delete documents",
          "Download documents",
        ],
        navPath: "Sidebar → Compliance → Governance",
      },
      {
        name: "Evidence Management",
        description: "Collect, manage, and track evidence demonstrating compliance with controls. Evidence items can be linked to specific controls, uploaded as files, and go through review workflows.",
        features: [
          "List evidence items with status and due dates",
          "Create evidence requests and assign to contributors",
          "Upload evidence files (documents, screenshots, exports)",
          "Link evidence to specific controls and frameworks",
          "Track status (Pending, Submitted, Approved, Rejected)",
          "Set evidence collection due dates",
          "Review and approve/reject submitted evidence",
          "AI-powered evidence suggestions",
          "Evidence versioning",
          "Filter by status, assignee, control",
          "Delete evidence records",
        ],
        navPath: "Sidebar → Compliance → Evidence",
      },
      {
        name: "Exceptions",
        description: "Document and track compliance exceptions — situations where a control cannot be fully implemented and a risk acceptance or compensating control is applied.",
        features: [
          "List all compliance exceptions with status indicators",
          "Create exception requests with justification",
          "Exception properties: code, description, severity, status",
          "Specify compensating controls",
          "Set exception expiry/target remediation dates",
          "Department and owner assignment",
          "Track exception approval status (open, in-progress, closed)",
          "Visual status indicators (pie chart, status timeline)",
          "Edit and delete exceptions",
          "Link exceptions to controls",
          "Pagination support",
        ],
        navPath: "Sidebar → Compliance → Exceptions",
      },
      {
        name: "KPIs",
        description: "Define and track Key Performance Indicators for compliance programs. Monitor compliance health through measurable metrics with targets and thresholds.",
        features: [
          "List compliance KPIs with current values and targets",
          "KPI properties: code, objective, description, expected score, actual score",
          "Department association for each KPI",
          "Evidence linkage to KPIs",
          "Review date tracking",
          "Status tracking: Scheduled, Missed, Overdue, Achieved",
          "Visual indicators for KPI health",
          "Filter by status and department",
          "Search KPIs",
        ],
        navPath: "Sidebar → Compliance → KPIs",
      },
      {
        name: "Risk Matrix",
        description: "Map relationships between risks and controls. Visualize which controls mitigate which risks and identify gaps in coverage.",
        features: [
          "Matrix view of risks vs controls",
          "Link/unlink controls to risks",
          "Identify unmitigated risks (gaps)",
          "View control effectiveness per risk",
          "Status indicators (compliant, non-compliant, partial compliant, not applicable)",
          "Collapsible risk groups",
          "Residual risk assessment view",
          "Search and filter",
        ],
        navPath: "Sidebar → Compliance → Risk Matrix",
      },
      {
        name: "Compliance Reports",
        description: "Generate compliance reports and analytics. View compliance dashboard with framework coverage metrics.",
        features: [
          "Compliance reporting and analytics",
          "Compliance dashboard view",
          "Framework coverage metrics",
          "Export and download capabilities",
        ],
        navPath: "Sidebar → Compliance → Reports",
      },
      {
        name: "Compliance Master Data",
        description: "Centralized configuration for compliance definitions including framework definitions, control templates, domain/category definitions, evidence templates, and governance templates.",
        features: [
          "Framework definitions and templates",
          "Control templates",
          "Domain and category definitions",
          "Evidence templates",
          "Governance document templates",
        ],
        navPath: "Sidebar → Compliance → Master Data",
      },
    ],
  },
  {
    name: "Risk Management",
    description: "Identify, assess, respond to, and monitor risks across the organization. This module supports the complete risk management lifecycle from identification through treatment, monitoring, and reporting.",
    pages: [
      {
        name: "Risk Dashboard",
        description: "Summary dashboard with risk statistics and analytics. View total risks, status breakdown, risk by strategy, risk by rating, and risk by category through interactive charts.",
        features: [
          "Summary metrics: total risks, status breakdown",
          "Risk by status chart",
          "Risk by strategy chart (Mitigate, Accept, Transfer, Avoid)",
          "Risk by rating chart",
          "Risk by category chart",
          "Real-time statistics",
          "Translated category names",
        ],
        navPath: "Sidebar → Risk Management → Dashboard",
      },
      {
        name: "Risk Register",
        description: "Central repository of all identified risks. Create, manage, and track risks with their inherent and residual ratings, owners, treatment status, and linkages to controls and processes.",
        features: [
          "List all risks with severity indicators and status",
          "Create new risks (name, description, risk sources, category, type)",
          "Risk scoring: likelihood (1-5) × impact (1-5) = risk score",
          "Set inherent risk rating and residual risk rating",
          "Assign risk owners with contact info and department",
          "Categorize: Strategic, Operational, Financial, Compliance, Technology",
          "Status tracking: open, in-progress, completed, mitigate, accept, transfer, avoid",
          "Rating badges with color coding",
          "Bulk import/export (Excel)",
          "AI-powered risk suggestions",
          "Link risks to controls and processes",
          "View risk details with full history",
          "Search, filter, pagination",
          "Delete risks",
        ],
        navPath: "Sidebar → Risk Management → Risk Register",
      },
      {
        name: "Risk Assessment",
        description: "Perform detailed risk assessments using likelihood and impact matrices. Evaluate risks quantitatively and qualitatively with structured assessment workflows.",
        features: [
          "Risk assessment matrix (5×5 likelihood vs impact)",
          "Define assessment criteria and scales",
          "Perform inherent risk assessment",
          "Perform residual risk assessment (after controls)",
          "Document assessment rationale",
          "Compare inherent vs residual risk levels",
          "Risk heatmap visualization",
          "Assessment status tracking (draft, submitted, approved, rejected, in-progress)",
          "Threat and vulnerability mapping",
          "Assessment wizard for structured input",
          "Department-scoped assessment",
        ],
        navPath: "Sidebar → Risk Management → Risk Assessment",
      },
      {
        name: "Risk Response",
        description: "Plan and track risk treatment actions. Define mitigation strategies, assign responsibilities, and monitor implementation.",
        features: [
          "View risks requiring response/treatment",
          "Define response strategy (Mitigate, Accept, Transfer, Avoid)",
          "Create treatment action plans with due dates",
          "Assign action owners and due dates",
          "Track action implementation status (open, in-progress, completed)",
          "Response progress tracking",
          "Document response effectiveness",
          "Department-scoped access",
        ],
        navPath: "Sidebar → Risk Management → Risk Response",
      },
      {
        name: "Risk Control Matrix",
        description: "Map relationships between risks and controls. Visualize which controls mitigate which risks and identify coverage gaps.",
        features: [
          "Matrix view of risks vs controls",
          "Link/unlink controls to risks",
          "Identify unmitigated risks (gaps)",
          "View control effectiveness per risk",
          "Residual risk calculation",
          "Status indicators for each control-risk link",
          "Collapsible risk groups",
          "Search and filter",
        ],
        navPath: "Sidebar → Risk Management → Risk Control Matrix",
      },
      {
        name: "Risk Settings",
        description: "Configure risk categories, types, thresholds, and rating matrix.",
        features: [
          "Risk category management",
          "Risk type definitions",
          "Risk rating matrix customization",
          "Threshold configuration",
        ],
        navPath: "Sidebar → Risk Management → Settings",
      },
      {
        name: "Risk Reports",
        description: "Generate risk reporting and analytics for management review.",
        features: [
          "Risk metrics and trends",
          "Risk summary reports",
          "Export capabilities",
        ],
        navPath: "Sidebar → Risk Management → Reports",
      },
    ],
  },
  {
    name: "Asset Management",
    description: "Maintain an inventory of organizational assets and classify them according to their criticality and sensitivity (CIA). Assets can be linked to risks, controls, and processes.",
    pages: [
      {
        name: "Asset Inventory",
        description: "Comprehensive inventory of all organizational assets including hardware, software, data, networks, personnel, and facilities.",
        features: [
          "List all assets with type, owner, classification, and status",
          "Create new assets (name, type, category, sub-category, group, owner, location)",
          "Asset types: Package, Server, Monitor, Database, Users, Building, Wrench",
          "Department and owner assignment",
          "Acquisition date tracking",
          "Status management",
          "Edit and delete assets",
          "Bulk import/export (Excel)",
          "Search, filter, pagination",
          "Link assets to risks and processes",
        ],
        navPath: "Sidebar → Asset Management → Inventory",
      },
      {
        name: "Asset Classification",
        description: "Classify assets based on confidentiality, integrity, and availability (CIA) requirements using a hierarchical classification system.",
        features: [
          "Classification hierarchy: Category → Sub-Category → Group",
          "Define classification levels (Public, Internal, Confidential, Restricted)",
          "Classify assets by CIA impact (Confidentiality, Integrity, Availability)",
          "Set handling and protection requirements per classification",
          "Asset grouping and organization",
          "Create, edit, delete classifications",
          "View hierarchy",
        ],
        navPath: "Sidebar → Asset Management → Classification",
      },
      {
        name: "Asset Settings",
        description: "Configure asset types, classifications, and master data setup.",
        features: [
          "Asset type configuration",
          "Classification level definitions",
          "Master data setup",
        ],
        navPath: "Sidebar → Asset Management → Settings",
      },
      {
        name: "Asset Reports",
        description: "Asset analytics and reporting including distribution by type and classification.",
        features: [
          "Asset distribution by type/classification",
          "Asset analytics and reporting",
          "Export capabilities",
        ],
        navPath: "Sidebar → Asset Management → Reports",
      },
    ],
  },
  {
    name: "Internal Audit",
    description: "Plan, execute, and report on internal audits. Manage the complete audit lifecycle from universe definition through risk identification, audit planning, fieldwork, findings, corrective actions, and final reporting.",
    pages: [
      {
        name: "Audit Dashboard",
        description: "Overview of audit function with risk statistics, audit statistics, CAPA status by department, annual audit plan calendar, and auditor schedule visualization.",
        features: [
          "Risk statistics: total, extreme, high, medium, low",
          "Audit statistics: ongoing, completed, planned",
          "CAPA status by department (open/closed breakdown)",
          "Annual audit plan calendar",
          "Auditor schedule visualization",
          "Department-wise audit metrics",
        ],
        navPath: "Sidebar → Internal Audit → Dashboard",
      },
      {
        name: "Audit Universe",
        description: "Define the complete set of auditable entities, processes, and functions. This forms the basis for risk-based audit planning.",
        features: [
          "Department-based audit scope view",
          "Display departments with associated audits",
          "Audit metrics: planned hours vs actual hours",
          "Status tracking per audit",
          "Timeline view (start/end dates)",
          "Search and navigate to audit details",
        ],
        navPath: "Sidebar → Internal Audit → Audit Universe",
      },
      {
        name: "Risk Identification",
        description: "Identify and document risks for audit planning purposes using structured risk entry and assessment methodology.",
        features: [
          "Structured risk entry forms",
          "Assessment methodology configuration",
          "Create, edit, view risk entries",
          "Link risks to audit planning",
        ],
        navPath: "Sidebar → Internal Audit → Risk Identification",
      },
      {
        name: "Audit Risk Register",
        description: "Risk inventory specific to the audit function. Create risks manually or use AI-recommended risks feature.",
        features: [
          "List audit risks with risk ID, name, likelihood, impact",
          "Create risks manually or via AI recommendations",
          "Probability and impact assessment",
          "Audit category and type assignment",
          "Edit and delete risks",
          "Search and pagination",
        ],
        navPath: "Sidebar → Internal Audit → Risk Register",
      },
      {
        name: "Audit Planning",
        description: "Create and manage audit engagements. Define scope, objectives, timeline, assign audit team members, and link risks to audit plans.",
        features: [
          "Annual audit plan creation and management",
          "Create audit engagements (title, department, start/end dates)",
          "Assign auditors (single or multiple)",
          "Risk linkage to audit plan",
          "Planned hours tracking",
          "Track engagement status (Planned, In Progress, Completed, Cancelled)",
          "Edit and delete engagements",
          "Download and upload engagement documents",
          "Search and pagination",
        ],
        navPath: "Sidebar → Internal Audit → Audit Planning",
      },
      {
        name: "Fieldwork",
        description: "Execute audit fieldwork — conduct testing, gather evidence, document observations, and link findings to engagements.",
        features: [
          "List engagements with title, department, status, dates, auditor",
          "View assigned fieldwork tasks",
          "Create work papers and document observations",
          "Upload audit evidence and supporting files",
          "Record interview notes",
          "Track fieldwork completion status",
          "Add findings from fieldwork",
          "Filter by department, status, auditor",
          "Pagination support",
        ],
        navPath: "Sidebar → Internal Audit → Fieldwork",
      },
      {
        name: "Findings",
        description: "Document and manage audit findings identified during fieldwork. Classify by severity, assign owners, and track remediation progress.",
        features: [
          "List all audit findings with severity and status",
          "Create findings (finding ID, title, description, severity, recommendation)",
          "Classify severity: Critical, High, Medium, Low, Informational",
          "Assign finding owners for remediation",
          "Set remediation due dates",
          "Track status: Open, In Progress, Closed, Overdue",
          "Link findings to controls and risks",
          "Edit and delete findings",
        ],
        navPath: "Sidebar → Internal Audit → Findings (via Fieldwork)",
      },
      {
        name: "CAPA Tracking",
        description: "Track Corrective and Preventive Actions (CAPA) arising from audit findings. Monitor implementation, verify effectiveness, and manage escalations.",
        features: [
          "List all CAPA items with status, severity, and due dates",
          "Create CAPA entries linked to findings",
          "Define corrective and preventive actions",
          "Action tracking: type, description, completion percentage, status",
          "Assign responsible persons and target completion dates",
          "Track implementation progress",
          "Comments and discussion support",
          "File attachments for evidence",
          "Verify action effectiveness",
          "Escalate overdue CAPAs",
          "Filter by status",
          "Search and pagination",
        ],
        navPath: "Sidebar → Internal Audit → CAPA Tracking",
      },
      {
        name: "Audit Reports",
        description: "Generate and manage audit reports. Compile findings, recommendations, management responses, and conclusions into formal audit reports.",
        features: [
          "List all audit reports with status",
          "Generate reports from engagement data",
          "Report properties: report code, title, executive summary, scope, objectives, methodology",
          "Include observations, recommendations, management response",
          "Conclusion and overall result",
          "Auditee comments and response",
          "Status: Draft, Submitted, Approved",
          "Report preview and PDF generation",
          "Download reports",
          "Search and pagination",
        ],
        navPath: "Sidebar → Internal Audit → Report",
      },
      {
        name: "Document Library",
        description: "Centralized audit document repository for uploading, organizing, and managing audit-related documents.",
        features: [
          "Document upload and organization",
          "File management",
          "Centralized document repository",
        ],
        navPath: "Sidebar → Internal Audit → Document Library",
      },
      {
        name: "Audit Settings",
        description: "Configure the audit function including audit types, departments, periodicity, processes, risk assessment matrices, categories, control nature, user management, and escalation policies.",
        features: [
          "Audit Types — define types (internal, external, compliance, operational)",
          "Departments — department management",
          "Periodicity — audit frequency/cycle configuration",
          "Process — process and sub-process definitions for audit scope",
          "Risk Assessment — probability and impact matrices",
          "Categories — audit categories",
          "Nature of Controls — control types and characteristics",
          "User Management — audit team member assignment and roles",
          "Escalation — escalation policies for audit findings",
        ],
        navPath: "Sidebar → Internal Audit → Settings",
      },
    ],
  },
  {
    name: "GRC Administration",
    description: "System-level administration for managing customer accounts, compliance master data, email settings, and system configuration. This module is only accessible to GRC Administrators.",
    pages: [
      {
        name: "Customer Accounts",
        description: "Multi-tenant customer account management. Create, edit, and manage customer organizations with subscription module flags and configuration.",
        features: [
          "List all customer accounts",
          "Create new customer accounts",
          "Edit customer details",
          "Delete customer accounts",
          "Account activation/blocking",
          "Subscription module flags (isGrcAdded, isTprmAdded, isQpostComplianceEnabled)",
          "Email and contact assignment",
          "Logo upload and management",
          "Language and timezone configuration",
        ],
        navPath: "Sidebar → GRC → Customer Accounts",
      },
      {
        name: "Compliance Master Data",
        description: "System-wide compliance definitions including frameworks, controls, governance templates, evidence templates, and domain/category definitions.",
        features: [
          "System-wide framework management",
          "Control definitions",
          "Governance document templates",
          "Evidence templates",
          "Domain and category definitions",
        ],
        navPath: "Sidebar → GRC → Compliance Master Data",
      },
      {
        name: "Email Settings",
        description: "Configure system email settings for notifications and alerts.",
        features: [
          "SMTP settings configuration",
          "Email template management",
          "Notification email configuration",
        ],
        navPath: "Sidebar → GRC → Email Settings",
      },
      {
        name: "System Configuration",
        description: "System-wide configuration settings including SSO, Excel import/export, PDF report settings, and system reflection.",
        features: [
          "Reflection — system reflection/analysis settings",
          "Excel Import — import configuration",
          "Excel Export — export templates",
          "PDF Report — report generation settings",
          "SSO — Single Sign-On configuration",
        ],
        navPath: "Sidebar → GRC → Configuration",
      },
    ],
  },
];

// GRC Roles
const GRC_ROLES: RoleInfo[] = [
  {
    name: "GRCAdministrator",
    displayName: "GRC Administrator",
    description: "System-level administrator with full access to all GRC modules and system configuration. Manages customer accounts, system settings, and has unrestricted access to all functionality across all tenants.",
    accessibleModules: ["GRC Administration", "Organization", "Compliance", "Risk Management", "Asset Management", "Internal Audit"],
    keyCapabilities: [
      "Full CRUD access to all modules across all tenants",
      "Manage customer accounts (create, edit, delete, activate, block)",
      "Configure system-wide settings (SSO, email, imports/exports)",
      "Manage compliance master data (frameworks, controls, governance templates)",
      "Access all dashboards and reports system-wide",
      "Framework management (add/remove compliance frameworks)",
      "System-wide data visibility across all departments and tenants",
      "Email settings and notification configuration",
    ],
    moduleKeys: ["GRC Administration", "Organization", "Compliance", "Risk Management", "Asset Management", "Internal Audit"],
  },
  {
    name: "CustomerAdministrator",
    displayName: "Customer Administrator",
    description: "Organization-level administrator who manages users, settings, and has full access to all GRC modules within their customer account (tenant). Cannot access GRC Administration or other tenants.",
    accessibleModules: ["Organization", "Compliance", "Risk Management", "Asset Management", "Internal Audit"],
    keyCapabilities: [
      "Full CRUD access to all modules within their tenant",
      "Manage users and assign roles within the organization",
      "Configure organization settings (profile, context, BIA)",
      "View all dashboards and reports within tenant",
      "Full access to all department data within tenant",
      "Manage compliance frameworks for the organization",
      "Organization profile and branding configuration",
    ],
    moduleKeys: ["Organization", "Compliance", "Risk Management", "Asset Management", "Internal Audit"],
  },
  {
    name: "AuditHead",
    displayName: "Audit Head",
    description: "Head of the internal audit function with full access to all audit activities. Oversees audit planning, execution, reporting, and CAPA management. Has read access to Risk and Compliance for audit planning context.",
    accessibleModules: ["Internal Audit (full access)", "Risk Management (view)", "Compliance (view)", "Organization (view)"],
    keyCapabilities: [
      "Full CRUD on all Internal Audit pages (Universe, Planning, Fieldwork, Findings, CAPA, Reports)",
      "Approve and finalize audit reports",
      "Oversee audit team assignments and schedules",
      "Configure all audit settings (types, periodicity, escalation, etc.)",
      "View risk register and compliance status for audit planning context",
      "Dashboard access for audit metrics and analytics",
      "Manage audit document library",
      "Risk identification and audit risk register management",
    ],
    moduleKeys: ["Internal Audit", "Risk Management", "Compliance", "Organization"],
  },
  {
    name: "AuditManager",
    displayName: "Audit Manager",
    description: "Manages audit engagements, assigns work to auditors, reviews fieldwork, oversees finding resolution, and generates audit reports.",
    accessibleModules: ["Internal Audit (planning, fieldwork, findings, CAPA, reports)", "Risk Management (view)", "Compliance (view)"],
    keyCapabilities: [
      "Create and manage audit engagements",
      "Assign fieldwork to auditors",
      "Review and approve work papers",
      "Create and manage findings",
      "Track CAPA progress and escalate overdue items",
      "Generate and review audit reports",
      "View risk and compliance data for audit context",
      "Manage auditor schedules",
    ],
    moduleKeys: ["Internal Audit", "Risk Management", "Compliance"],
  },
  {
    name: "Auditor",
    displayName: "Auditor",
    description: "Performs audit fieldwork, documents observations, creates findings, and gathers evidence during audit engagements.",
    accessibleModules: ["Internal Audit (fieldwork, findings)", "Compliance (view controls/evidence)"],
    keyCapabilities: [
      "Conduct assigned fieldwork tasks",
      "Create work papers and document observations",
      "Upload audit evidence and supporting files",
      "Create draft findings from fieldwork",
      "Record interview notes",
      "View compliance controls and evidence for testing",
      "View audit planning information for assigned engagements",
    ],
    moduleKeys: ["Internal Audit", "Compliance"],
  },
  {
    name: "Auditee",
    displayName: "Auditee",
    description: "Subject of an audit who provides information, responds to findings, and implements corrective actions. Has limited access to view findings and update CAPA items assigned to them.",
    accessibleModules: ["Internal Audit (view own findings, CAPA response)"],
    keyCapabilities: [
      "View audit findings assigned to them",
      "Provide management responses to findings",
      "View and update CAPA items assigned to them",
      "Upload corrective action evidence",
      "View audit engagement details relevant to them",
      "Add comments to CAPA discussions",
    ],
    moduleKeys: ["Internal Audit"],
  },
  {
    name: "Reviewer",
    displayName: "Reviewer",
    description: "Cross-module reviewer who can view and review content across all GRC modules organization-wide. Limited editing — primarily view and approval capabilities.",
    accessibleModules: ["Organization (view)", "Compliance (view/review)", "Risk Management (view)", "Asset Management (view)", "Internal Audit (view)"],
    keyCapabilities: [
      "View all module data across the organization",
      "Review and comment on risks, controls, and findings",
      "Approve/reject evidence submissions",
      "Review governance documents for approval",
      "Access all dashboards and reports",
      "Cross-department visibility",
    ],
    moduleKeys: ["Organization", "Compliance", "Risk Management", "Asset Management", "Internal Audit"],
  },
  {
    name: "DepartmentReviewer",
    displayName: "Department Reviewer",
    description: "Reviewer scoped to their assigned department. Can view and review data only within their department's scope.",
    accessibleModules: ["Organization (dept view)", "Compliance (dept view)", "Risk Management (dept view)", "Asset Management (dept view)"],
    keyCapabilities: [
      "View module data scoped to their department",
      "Review risks and controls within department",
      "Review evidence for department-owned controls",
      "Access department-level dashboards",
      "Approve/reject department-scoped items",
    ],
    moduleKeys: ["Organization", "Compliance", "Risk Management", "Asset Management"],
  },
  {
    name: "DepartmentContributor",
    displayName: "Department Contributor",
    description: "Contributor scoped to their assigned department. Can create and edit certain records within their department's scope.",
    accessibleModules: ["Compliance (dept contribute)", "Risk Management (dept contribute)", "Asset Management (dept contribute)"],
    keyCapabilities: [
      "Create and edit risks within their department",
      "Submit evidence for department controls",
      "Update asset information for department assets",
      "View department-scoped data",
      "Create compliance exception requests",
    ],
    moduleKeys: ["Compliance", "Risk Management", "Asset Management"],
  },
];

// ======================== TPRM MODULE DATA ========================

const TPRM_MODULES: ModuleSection[] = [
  {
    name: "Dashboard",
    description: "Role-specific dashboards providing at-a-glance views of vendor risk posture, assessment progress, and issue status through interactive charts and analytics.",
    pages: [
      {
        name: "RM Dashboard",
        description: "Relationship Manager dashboard showing vendor criticality distribution and assessment status across all managed vendors.",
        features: [
          "Vendor Criticality bar chart (Nominal, Low, Moderate, High, Critical) with color coding",
          "Assessment Status bar chart (Initiated, In Progress, Completed)",
          "Interactive tooltips with vendor/assessment counts",
          "Auto-refresh on page load",
          "\"No Data to Display\" message when no vendors exist",
        ],
        navPath: "Sidebar → TPRM → RM → Dashboard",
      },
      {
        name: "BO Dashboard",
        description: "Business Owner dashboard showing vendor criticality and assessment status for vendors in the business unit.",
        features: [
          "Vendor Criticality bar chart (Nominal, Low, Moderate, High, Critical) with color coding",
          "Assessment Status bar chart (Initiated, In Progress, Completed)",
          "Interactive tooltips with counts",
          "Auto-refresh on page load",
        ],
        navPath: "Sidebar → TPRM → BO → Dashboard",
      },
      {
        name: "Assessor Dashboard",
        description: "Comprehensive assessor dashboard with 6 analytical charts covering issues, assessments, risks, results, top vendors, and domain distribution.",
        features: [
          "Issue Status bar chart (Open, Overdue, Closed) — maps DB statuses to 3 buckets",
          "Assessment Progress bar chart (Initiated, In Progress, Completed)",
          "Inherent Risk pie chart (High, Medium, Low) — mapped from VRR levels",
          "Assessment Result pie chart (Satisfactory, Unsatisfactory, Deficient)",
          "Top 5 Vendors stacked bar chart by severity (High, Medium, Low)",
          "Domain distribution horizontal bar chart (top 10 domains by issue count, strips CUST. prefix)",
          "Empty state handling for each chart",
        ],
        navPath: "Sidebar → TPRM → Assessor → Dashboard",
      },
    ],
  },
  {
    name: "Program Monitor",
    description: "High-level program overview showing assessment and vendor quotas with visual progress indicators.",
    pages: [
      {
        name: "Program Monitor",
        description: "Executive summary view with circular progress rings showing assessment and vendor totals with detailed breakdowns by type.",
        features: [
          "Total Assessments summary with circular progress ring",
          "Assessment breakdown: Assessment Factory, Onboarding, Periodic, On-Demand",
          "Total Vendors summary with circular progress ring",
          "Vendor breakdown: Onboarding, Onboarded, Offboarding, Offboarded",
          "Usage percentage with color coding (green <70%, amber 70-90%, red >90%)",
          "2×2 breakdown grid with icons",
        ],
        navPath: "Sidebar → TPRM → Program Monitor",
      },
    ],
  },
  {
    name: "Control Center",
    description: "Configuration hub for TPRM risk parameters including due diligence settings and scorecard thresholds.",
    pages: [
      {
        name: "Control Center",
        description: "Configure Due Diligence and Scorecard settings through editable matrix tables. Changes auto-save with debounced updates.",
        features: [
          "Due Diligence tab: VRR levels (Critical/High/Moderate/Low/Nominal) × parameters (VRR, Cadence, Remediation, Reminder, Due Date)",
          "Scorecard tab: Score categories (Excellent/Good/Moderate/Low/Nominal) × Security Score thresholds",
          "Auto-save with 800ms debounce and save status indicator",
          "Colored category headers for visual differentiation",
          "In-line editing of all matrix cells",
        ],
        navPath: "Sidebar → TPRM → Control Center",
      },
    ],
  },
  {
    name: "Vendor Management",
    description: "Core vendor lifecycle management including creation, inventory management, risk profiling, contract management, and vendor offboarding across different role perspectives.",
    pages: [
      {
        name: "Vendor Management (Admin)",
        description: "Full vendor management with accordion-based UI showing vendor details, risk profiles, security monitoring scores, and contract information.",
        features: [
          "Accordion vendor list with expandable details",
          "Create vendor form with 6 sections and 25+ fields",
          "Vendor sections: Info, Contact, Service Category, Department, Risk Profile, Contract Dates, Certifications",
          "Vendor Risk Profile toggles: Access to Network, Cloud, Access to Data, PII",
          "Security Monitoring display: Overall Score, Security Posture, Threat Exposure",
          "Export individual vendor or bulk CSV export",
          "Edit and delete vendors",
          "Option to trigger monitoring scan on vendor creation",
          "Dynamic translation support",
        ],
        navPath: "Sidebar → TPRM → Vendor Management",
      },
      {
        name: "RM Vendor Inventory",
        description: "Relationship Manager's view of all vendors with risk ratings, status, and assessment information. Create, edit, and manage vendor records.",
        features: [
          "List all vendors with risk rating (VRR), status, and assessment info",
          "Create new vendor (name, domain, vendor code, description)",
          "Edit vendor details",
          "Delete vendors",
          "View vendor risk rating: Nominal, Low, Moderate, High, Critical",
          "Initiate vendor assessments",
          "View assessment history per vendor",
          "Filter and search vendors",
        ],
        navPath: "Sidebar → TPRM → RM → Vendor Inventory",
      },
      {
        name: "BO Vendor Inventory",
        description: "Business Owner's view of vendors within their business unit. Complex UI with nested accordion, create/edit forms, and contract management.",
        features: [
          "Nested accordion with vendor details",
          "Create/edit dialog with multi-section form",
          "Contract management: download/upload documents",
          "CSV bulk export capability",
          "Vendor Risk Profile toggles",
          "View vendor details and risk ratings",
          "View assessment status and history",
          "Filter and search",
        ],
        navPath: "Sidebar → TPRM → BO → Vendor Inventory",
      },
      {
        name: "Assessor Vendor Inventory",
        description: "Assessor's read-only view of vendors assigned for assessment, focusing on assessment workload and status.",
        features: [
          "List vendors assigned for assessment",
          "View vendor details and current risk rating",
          "Access assessment forms for assigned vendors",
          "Track assessment completion status",
        ],
        navPath: "Sidebar → TPRM → Assessor → Inventory",
      },
    ],
  },
  {
    name: "Contract Management",
    description: "Manage vendor contracts, track expiration dates, initiate renewals, and handle offboarding workflows.",
    pages: [
      {
        name: "BO Contracts",
        description: "Business Owner contract management with tabs for expiring contracts and all vendor contracts. Supports offboarding initiation and contract renewal.",
        features: [
          "Expiring Contracts tab with action buttons",
          "All Vendor Contracts tab",
          "Start Offboarding action (conditional on assessment status)",
          "Renew Contract dialog with new start/end date inputs",
          "Contract file upload (PDF/Word/Excel)",
          "Status badges: \"Offboard Request Submitted\" for offboarding vendors",
          "Date highlighting: red for expired, amber for expiring soon",
          "Download contract documents",
        ],
        navPath: "Sidebar → TPRM → BO → Contracts",
      },
      {
        name: "RM Contracts",
        description: "Relationship Manager contract management view for tracking and managing vendor contracts.",
        features: [
          "Contract listing and management",
          "Contract renewal tracking",
          "Expiration date monitoring",
          "Download contract documents",
        ],
        navPath: "Sidebar → TPRM → RM → Contracts",
      },
    ],
  },
  {
    name: "Assessment Management",
    description: "Create, conduct, and manage vendor risk assessments using questionnaire-based approaches (CAIQ). Supports assessment lifecycle from creation through completion and approval.",
    pages: [
      {
        name: "RM Assessments",
        description: "Relationship Manager assessment management. Create assessments, assign assessors, and track the full assessment lifecycle.",
        features: [
          "List all assessments with status and assignee",
          "Create new assessment (select vendor, type, assign assessor)",
          "View assessment details and results",
          "Track status: Draft → In Progress → Submitted → Under Review → Approved/Completed",
          "Filter by status, vendor, assessor",
        ],
        navPath: "Sidebar → TPRM → RM → Assessments",
      },
      {
        name: "BO Assessments",
        description: "Business Owner assessment view with tabbed interface for Ongoing, Completed, and Offboard assessments with sub-tab navigation.",
        features: [
          "Top tabs: Ongoing Assessments, Completed Assessments, Offboard Assessments",
          "Ongoing sub-tabs: Awaiting Response, Pending with Assessor",
          "Offboard sub-tabs: Offboard Approval, Terminated Vendors",
          "Table columns: Assessment ID, Vendor, Type, Status, Initiated, Due Date, Action",
          "Status color coding: Initiated (outline), In-Progress (secondary), Completed (default)",
          "Route to offboard review page for offboarding assessments",
        ],
        navPath: "Sidebar → TPRM → BO → Assessments",
      },
      {
        name: "AM Assessments",
        description: "Account Manager assessment view with tabs for Active, Submitted, Past, and Offboard assessments. Start or resume assessments from this page.",
        features: [
          "Tabs: Active, Submitted, Past, Offboard assessments",
          "Search: filter by assessment code/vendor",
          "Start (Draft) or Resume assessments",
          "Offboard routing to dedicated offboard questionnaire page",
          "Status color coding: Gray (Draft), Blue (In Progress), Orange (Returned), Purple (Submitted), Indigo (Under Review), Green (Completed)",
        ],
        navPath: "Sidebar → TPRM → AM → Assessments",
      },
      {
        name: "Assessor Assessments",
        description: "Assessor's workqueue of assigned assessments. Conduct assessments by answering CAIQ questionnaire questions with AI assistance.",
        features: [
          "List assessments assigned for completion",
          "Open assessment questionnaire (CAIQ questions by domain)",
          "Answer questions with compliance ratings",
          "Add evidence and notes to individual questions",
          "Submit completed assessments for review",
          "Save draft progress at any time",
          "AI-assisted question answering (Enable AI button)",
          "View vendor details within assessment context",
        ],
        navPath: "Sidebar → TPRM → Assessor → Assessments",
      },
      {
        name: "Approver Assessments",
        description: "Approver's view of submitted assessments awaiting review. Review responses, approve or reject with comments.",
        features: [
          "List assessments submitted for approval",
          "Review assessment responses and evidence per question",
          "Approve or reject assessments with review comments",
          "View assessment result summary and overall score",
        ],
        navPath: "Sidebar → TPRM → Approver → Assessments",
      },
      {
        name: "CAIQ Questions",
        description: "View the CAIQ questionnaire library organized by domains. Search and filter assessment questions.",
        features: [
          "List all CAIQ questions organized by domain",
          "View question details (ID, question text, domain)",
          "Search questions by keyword",
          "Filter by domain",
        ],
        navPath: "Sidebar → TPRM → Assessor → CAIQ Questions",
      },
      {
        name: "Assessment Factory",
        description: "Batch create and schedule assessments for multiple vendors. Generate assessments at scale.",
        features: [
          "Batch assessment generation",
          "Scheduled assessment creation",
          "Multi-vendor assessment initiation",
          "Template-based assessment creation",
        ],
        navPath: "Sidebar → TPRM → Assessor → Assessment Factory",
      },
      {
        name: "Assessment Templates",
        description: "Manage assessment templates that define the structure and questions for vendor assessments.",
        features: [
          "Template creation and management",
          "Define assessment structure and questions",
          "Assign templates to assessment types",
        ],
        navPath: "Sidebar → TPRM → Assessor → Template",
      },
    ],
  },
  {
    name: "Issue & Remediation",
    description: "Track and manage issues identified during assessments, assign remediation actions, monitor resolution progress, and manage issue comments.",
    pages: [
      {
        name: "Assessor Issue Register",
        description: "Assessor's view of the issue register. View issues grouped by vendor with severity breakdowns (High/Medium/Low). Drill into vendor-specific issues for detailed information.",
        features: [
          "Issue register tab: vendors grouped with High/Medium/Low severity counts and totals",
          "Click vendor to see detailed issues list",
          "Issue details: domain, severity, issue description, risk, recommendation",
          "Issue codes and status tracking (Open, Overdue, Closed)",
          "Assessment code linkage",
          "Due date tracking",
          "Question number reference",
          "Remediation comments support",
        ],
        navPath: "Sidebar → TPRM → Assessor → Issue Register",
      },
      {
        name: "RM Issue Register",
        description: "Relationship Manager's issue register with full remediation tracking capabilities.",
        features: [
          "List issues with severity, status, and due dates",
          "View issue details and remediation plans",
          "Assign remediation owners",
          "Set due dates for remediation",
          "Track remediation status",
          "Add comments to issues",
          "Export issue register",
        ],
        navPath: "Sidebar → TPRM → RM → Issue Management",
      },
      {
        name: "BO Issues",
        description: "Business Owner's issue management view.",
        features: [
          "View issues related to business unit vendors",
          "Track issue severity and status",
          "Monitor remediation progress",
        ],
        navPath: "Sidebar → TPRM → BO → Issue Management",
      },
      {
        name: "IT Issues",
        description: "Internal IT Team's issue management for IT-related vendor issues.",
        features: [
          "View IT-related vendor issues",
          "Technical issue tracking and management",
          "IT remediation workflows",
        ],
        navPath: "Sidebar → TPRM → Internal IT → Issue Management",
      },
    ],
  },
  {
    name: "Monitoring & Scanning",
    description: "Continuous vendor monitoring through automated security scanning, web intelligence gathering, and ongoing risk assessment with a 14-KPI scorecard.",
    pages: [
      {
        name: "Vendor Monitoring",
        description: "Automated vendor security scanning and continuous monitoring dashboard. Trigger on-demand scans that analyze vendor security posture using AI-powered web intelligence gathering with 17+ targeted searches per vendor.",
        features: [
          "Stat cards: Vendors Monitored, Avg Security Score, High Risk Vendors, Active Scans",
          "Vendor Scorecard table with sticky vendor name column",
          "14 KPI columns: Network Security, DNS Health, Patching Cadence, Endpoint Security, IP Reputation, Application Security, Cubit Score, Email Security, SSL/TLS Config, Privacy, Known Breach, Hacker Chatter, Information Leak, Social Engineering",
          "Security Score badge per vendor with color coding",
          "KPI cell colors: Green (≥80), Emerald (≥65), Yellow (≥50), Red (<50)",
          "Trigger new vendor scan dialog (enter vendor name and domain URL)",
          "Two-phase intelligence: HTTP header scan + 17 web searches + GPT-4o assessment",
          "Domain scores breakdown: Data Breaches, Vulnerabilities, Security Posture, Certifications, DNS/Email, SSL/TLS, IP Reputation, Privacy, Dark Web, News",
          "Queued/Processing scan status indicators with background polling (10s interval)",
          "Automatic stale scan cleanup (10 min timeout)",
          "View scan history per vendor",
          "Delete vendor monitoring records",
          "Only completed assessments shown in scorecard",
        ],
        navPath: "Sidebar → TPRM → Monitoring",
      },
      {
        name: "Monitoring Detail",
        description: "Detailed KPI analysis for a specific vendor's monitoring scan results.",
        features: [
          "Full KPI breakdown for individual vendor",
          "Historical scan comparison",
          "Detailed security score analysis",
        ],
        navPath: "Click vendor in Monitoring → Detail View",
      },
    ],
  },
  {
    name: "Follow-ups",
    description: "Track and manage follow-up actions arising from assessments and reviews.",
    pages: [
      {
        name: "AM Follow-ups",
        description: "Account Manager follow-up tracking for assessment-related actions.",
        features: [
          "List follow-up items with status and due dates",
          "Track follow-up completion",
          "Link follow-ups to assessments",
        ],
        navPath: "Sidebar → TPRM → AM → Follow-Ups",
      },
      {
        name: "Assessor Follow-ups",
        description: "Assessor follow-up tracking for assessment actions.",
        features: [
          "List follow-up items assigned",
          "Track completion status",
          "Link to assessment context",
        ],
        navPath: "Sidebar → TPRM → Assessor → Follow-ups",
      },
    ],
  },
  {
    name: "User Management",
    description: "Role-specific user administration for TPRM teams.",
    pages: [
      {
        name: "TPRM User Management",
        description: "Manage TPRM users and role assignments within the organization.",
        features: [
          "Create, edit, delete TPRM users",
          "Assign TPRM roles",
          "Department assignment",
          "User activation and deactivation",
        ],
        navPath: "Sidebar → TPRM → User Management",
      },
      {
        name: "BO User Management",
        description: "Business Owner user management for their team.",
        features: [
          "Manage team users within business unit",
          "Role assignment",
        ],
        navPath: "Sidebar → TPRM → BO → User Management",
      },
      {
        name: "Factory User Management",
        description: "Factory Administrator user management for factory teams.",
        features: [
          "Manage factory team users",
          "Assign FactoryAdmin/FactoryAssessor roles",
        ],
        navPath: "Sidebar → TPRM → Factory → User Management",
      },
    ],
  },
  {
    name: "SME Management",
    description: "Manage Subject Matter Experts assigned to provide domain expertise during vendor assessments.",
    pages: [
      {
        name: "AM SME Management",
        description: "Account Manager's view for managing Subject Matter Experts.",
        features: [
          "List and manage SMEs",
          "Assign SMEs to assessment domains",
          "Track SME availability and expertise areas",
        ],
        navPath: "Sidebar → TPRM → AM → SME Management",
      },
    ],
  },
  {
    name: "Reports",
    description: "Generate comprehensive TPRM reports for management review, audit purposes, and regulatory compliance.",
    pages: [
      {
        name: "TPRM Reports",
        description: "Generate and view TPRM reports including vendor risk summaries, assessment completion reports, issue resolution tracking, and historical trends.",
        features: [
          "Vendor risk assessment reports",
          "Assessment completion summary reports",
          "Issue and remediation status reports",
          "Export reports for stakeholder distribution",
          "Historical trend analysis",
        ],
        navPath: "Sidebar → TPRM → Reports",
      },
      {
        name: "Assessment Factory Reports",
        description: "Reports on assessment factory history and batch assessment results.",
        features: [
          "Assessment factory batch history",
          "Batch assessment completion status",
          "Factory assessment analytics",
        ],
        navPath: "Sidebar → TPRM → Assessor → Assessment History",
      },
    ],
  },
  {
    name: "Offboarding",
    description: "Manage the vendor offboarding process with multi-step approval workflows.",
    pages: [
      {
        name: "Offboard Review",
        description: "Dedicated review page for vendor offboarding requests. Multi-step approval process across roles (Assessor → RM → BO).",
        features: [
          "Offboard review questionnaire",
          "Multi-step approval workflow",
          "Role-based review (Assessor, RM, BO perspectives)",
          "Offboard reason documentation",
          "Final approval/rejection",
        ],
        navPath: "Via Offboard tab in Assessments → Review",
      },
    ],
  },
  {
    name: "Notifications & Support",
    description: "Role-specific notifications and support resources for all TPRM users.",
    pages: [
      {
        name: "Notifications",
        description: "Role-specific notification center showing relevant alerts and updates for TPRM activities. Each role has its own notification page.",
        features: [
          "View unread notifications with badge count in header",
          "Assessment assignment notifications",
          "Status change alerts (assessment status, vendor status)",
          "Due date reminders for assessments and remediations",
          "Mark notifications as read",
          "Notification dropdown in header for quick access",
        ],
        navPath: "Header notification bell or Sidebar → TPRM → [Role] → Notifications",
      },
      {
        name: "Contact Us / Support",
        description: "Submit support requests and access help resources. Each role has its own support page.",
        features: [
          "Submit support/contact form",
          "View support team contact details",
          "FAQ and help resources",
        ],
        navPath: "Sidebar → TPRM → [Role] → Support",
      },
    ],
  },
  {
    name: "Configuration",
    description: "System configuration and master data setup for the TPRM module.",
    pages: [
      {
        name: "Configurations",
        description: "TPRM system configurations including departments and service categories.",
        features: [
          "Department list management",
          "Service category management",
          "System parameter configuration",
        ],
        navPath: "Sidebar → TPRM → Configurations",
      },
      {
        name: "Master Data",
        description: "TPRM master data setup for reference data used across the module.",
        features: [
          "Reference data management",
          "Lookup table configuration",
          "System defaults",
        ],
        navPath: "Sidebar → TPRM → Master Data",
      },
      {
        name: "Settings",
        description: "General TPRM settings and preferences.",
        features: [
          "Module-level settings",
          "Default configuration values",
        ],
        navPath: "Sidebar → TPRM → Settings",
      },
    ],
  },
];

// TPRM Roles
const TPRM_ROLES: RoleInfo[] = [
  {
    name: "CustomerAdministrator",
    displayName: "TPRM Administrator (Customer Admin)",
    description: "Organization-level administrator for TPRM with full access to all TPRM functionality including vendor management, assessments, issues, monitoring, reports, control center, program monitor, user management, and system configuration.",
    accessibleModules: ["All TPRM modules", "User Management", "Control Center", "Program Monitor", "Configuration"],
    keyCapabilities: [
      "Full CRUD on all vendor records",
      "Create and manage all assessments",
      "Assign assessors, approvers, and account managers",
      "Manage issue register and remediations",
      "Access all dashboards (RM, BO, Assessor)",
      "Configure monitoring and run vendor scans",
      "Configure Control Center (Due Diligence and Scorecard settings)",
      "View Program Monitor for executive overview",
      "Generate all reports",
      "Manage TPRM users and roles",
      "Configure departments, service categories, and master data",
    ],
    moduleKeys: ["Dashboard", "Program Monitor", "Control Center", "Vendor Management", "Contract Management", "Assessment Management", "Issue & Remediation", "Monitoring & Scanning", "Follow-ups", "User Management", "SME Management", "Reports", "Offboarding", "Notifications & Support", "Configuration"],
  },
  {
    name: "BusinessOwner",
    displayName: "Business Owner",
    description: "Owns vendor relationships from a business perspective. Manages vendor inventory, monitors assessment progress, handles contracts (including renewals and offboarding), and oversees issue management for their business unit.",
    accessibleModules: ["BO Dashboard", "BO Vendor Inventory", "BO Assessments", "BO Contracts", "BO Issues", "BO User Management", "BO Monitoring", "BO Support"],
    keyCapabilities: [
      "View and manage vendor inventory for their business unit",
      "Create and edit vendor records with full detail forms",
      "Monitor vendor criticality and risk ratings on dashboard",
      "View assessment status, results, and history",
      "Manage contracts: view, upload, renew, initiate offboarding",
      "Track expiring contracts with date highlighting",
      "Manage issues for business unit vendors",
      "Manage team users (BO User Management)",
      "View monitoring scorecard",
      "Receive notifications about vendor status changes",
      "Access Business Owner dashboard with 2 analytical charts",
    ],
    moduleKeys: ["Dashboard", "Vendor Management", "Contract Management", "Assessment Management", "Issue & Remediation", "Monitoring & Scanning", "User Management", "Notifications & Support"],
  },
  {
    name: "RelationshipManager",
    displayName: "Relationship Manager",
    description: "Manages the vendor relationship lifecycle end-to-end. Creates vendors, initiates assessments, assigns assessors, tracks issues, manages contracts, and ensures vendor compliance throughout the engagement.",
    accessibleModules: ["RM Dashboard", "RM Vendor Inventory", "RM Assessments", "RM Issue Register", "RM Contracts", "RM Monitoring", "Reports", "RM Support"],
    keyCapabilities: [
      "Create and manage vendor records in RM Inventory",
      "Initiate vendor assessments and assign assessors",
      "Track assessment progress through full lifecycle (Draft → Completed)",
      "Manage issue register with remediation tracking",
      "Assign remediation owners and set due dates",
      "Manage vendor contracts and monitor expiration",
      "View RM dashboard for portfolio overview (2 charts)",
      "View monitoring scorecard for vendor security posture",
      "Generate TPRM reports",
      "Add comments to issues",
    ],
    moduleKeys: ["Dashboard", "Vendor Management", "Contract Management", "Assessment Management", "Issue & Remediation", "Monitoring & Scanning", "Reports", "Notifications & Support"],
  },
  {
    name: "TPRMAssessor",
    displayName: "TPRM Assessor",
    description: "Conducts vendor risk assessments by answering CAIQ questionnaire questions, gathering evidence, providing risk ratings, and managing assessment follow-ups. Has access to the most comprehensive dashboard with 6 analytical charts.",
    accessibleModules: ["Assessor Dashboard", "Assessor Inventory", "Assessor Assessments", "CAIQ Questions", "Issue Register", "Assessment Factory", "Assessment Templates", "Follow-ups", "Monitoring", "Reports", "Support"],
    keyCapabilities: [
      "View assigned vendor assessments and complete questionnaires",
      "Answer CAIQ questions with compliance ratings per domain",
      "Use AI-assisted question answering (Enable AI button)",
      "Add evidence and notes to individual assessment questions",
      "Submit completed assessments for review",
      "Save draft progress at any time",
      "View comprehensive assessor dashboard with 6 charts",
      "View vendor inventory and details",
      "View and manage issue register with remediation comments",
      "Create batch assessments via Assessment Factory",
      "Manage assessment templates",
      "Track follow-up items",
      "View monitoring scorecard",
    ],
    moduleKeys: ["Dashboard", "Vendor Management", "Assessment Management", "Issue & Remediation", "Monitoring & Scanning", "Follow-ups", "Reports", "Notifications & Support"],
  },
  {
    name: "TPRMApprover",
    displayName: "TPRM Approver",
    description: "Reviews and approves submitted vendor assessments. Ensures assessment quality, accuracy, and completeness before finalization. Can approve or reject with detailed review comments.",
    accessibleModules: ["Approver Dashboard", "Approver Assessments", "Reports", "Notifications"],
    keyCapabilities: [
      "Review submitted assessments — view all responses and evidence",
      "Approve or reject assessments with detailed review comments",
      "View assessment result summary and overall score",
      "Access approver dashboard (same as assessor dashboard)",
      "Generate assessment reports",
      "Receive notifications for assessments awaiting approval",
    ],
    moduleKeys: ["Dashboard", "Assessment Management", "Reports", "Notifications & Support"],
  },
  {
    name: "TPRMAuditor",
    displayName: "TPRM Auditor",
    description: "Audits the TPRM process and vendor assessment quality. Has read-only access to assessments, issues, vendor data, monitoring, and reports for independent audit review.",
    accessibleModules: ["Assessor Dashboard (view)", "Vendor Inventory (view)", "Assessments (view)", "Issue Register (view)", "Monitoring (view)", "Follow-ups (view)", "Factory Reports (view)", "Reports"],
    keyCapabilities: [
      "View all vendor records and assessment details (read-only)",
      "Audit assessment quality and completeness",
      "Review issue register and remediation status",
      "View monitoring scorecard and scan results",
      "View assessment factory history",
      "Generate audit-focused reports",
      "Independent review without edit capabilities",
    ],
    moduleKeys: ["Dashboard", "Vendor Management", "Assessment Management", "Issue & Remediation", "Monitoring & Scanning", "Follow-ups", "Reports"],
  },
  {
    name: "AccountManager",
    displayName: "Account Manager",
    description: "Manages vendor accounts from a commercial perspective. Handles active assessments, follow-ups, and SME assignments. Can start and resume assessments.",
    accessibleModules: ["AM Assessments", "AM Follow-Ups", "AM SME Management", "AM Support"],
    keyCapabilities: [
      "View and manage assessments across tabs: Active, Submitted, Past, Offboard",
      "Start (Draft) or Resume assessments",
      "Handle offboard assessment questionnaires",
      "Track and manage follow-up actions",
      "Manage Subject Matter Experts (SMEs) — assign to domains",
      "Search assessments by code or vendor",
      "Contact support for vendor-related queries",
    ],
    moduleKeys: ["Assessment Management", "Follow-ups", "SME Management", "Notifications & Support"],
  },
  {
    name: "TPRMSME",
    displayName: "TPRM Subject Matter Expert",
    description: "Provides domain expertise during vendor assessments. Reviews specific assessment areas related to their area of specialization.",
    accessibleModules: ["AM Assessments (limited view)", "AM Follow-Ups", "AM Support"],
    keyCapabilities: [
      "Review assessment questions in their domain of expertise",
      "Provide expert input on specific assessment areas",
      "View and track assigned follow-up items",
      "Access support resources",
    ],
    moduleKeys: ["Assessment Management", "Follow-ups", "Notifications & Support"],
  },
  {
    name: "FactoryAdmin",
    displayName: "Factory Administrator",
    description: "Administers TPRM for a specific factory/facility. Manages factory team users, assessment factory operations, and factory assessment reports.",
    accessibleModules: ["Factory User Management", "Assessment Factory", "Factory Reports"],
    keyCapabilities: [
      "Manage factory team users and role assignments",
      "Operate assessment factory for batch assessment creation",
      "View factory assessment reports and history",
      "Assign FactoryAdmin and FactoryAssessor roles",
    ],
    moduleKeys: ["Assessment Management", "User Management", "Reports"],
  },
  {
    name: "FactoryAssessor",
    displayName: "Factory Assessor",
    description: "Conducts vendor assessments specific to factory/facility requirements. Has read-only access to factory assessment reports.",
    accessibleModules: ["Factory Reports (view only)"],
    keyCapabilities: [
      "View factory assessment reports",
      "Complete assigned vendor assessments for facility",
    ],
    moduleKeys: ["Reports"],
  },
  {
    name: "InternalITTeam",
    displayName: "Internal IT Team",
    description: "Provides technical input for vendor assessments, particularly around IT security, infrastructure, and technology risks. Manages IT-related vendor issues.",
    accessibleModules: ["IT Issue Management"],
    keyCapabilities: [
      "View and manage IT-related vendor issues",
      "Technical issue tracking and remediation",
      "IT security input for vendor assessments",
      "Assess IT-related vendor risks",
    ],
    moduleKeys: ["Issue & Remediation"],
  },
];

// ─── Document generation ────────────────────────────────────────

function buildCoverPage(docTitle: string, docSubtitle: string): Paragraph[] {
  return [
    spacer(), spacer(), spacer(), spacer(),
    title(docTitle),
    subtitle(docSubtitle),
    spacer(),
    para(COMPANY_NAME, { bold: true }),
    para(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`),
    para("Version 1.0"),
    spacer(),
    note("This document is auto-generated and confidential. Do not distribute without authorization."),
    pb(),
  ];
}

function buildGettingStarted(moduleName: string): Paragraph[] {
  return [
    h1("Getting Started"),
    h2("Logging In"),
    para("To access the application:"),
    bullet("Open your web browser and navigate to the application URL provided by your administrator."),
    bullet("Enter your username and password on the login page."),
    bullet("Click \"Sign In\" to access the application."),
    bullet("Upon successful login, you will be redirected to your default dashboard."),
    spacer(),
    ...(loginScreenshot() ? [loginScreenshot()!, para("Figure: Login page", { italic: true })] : []),
    spacer(),
    h2("Navigation"),
    para(`The ${moduleName} module uses a sidebar navigation menu on the left side of the screen. Each menu item corresponds to a functional area. Your visible menu items depend on your assigned role and permissions.`),
    para("Key navigation elements:"),
    bullet("Sidebar menu — Primary navigation to all accessible pages"),
    bullet("Breadcrumb trail — Shows your current location within the application"),
    bullet("Header bar — Contains user profile, notifications, and language switcher"),
    bullet("Language selector — Switch between English, Arabic (RTL), and Latvian"),
    spacer(),
    h2("Multi-Language Support"),
    para("The application supports three languages:"),
    bullet("English (default) — Left-to-right layout"),
    bullet("Arabic — Right-to-left (RTL) layout with full UI mirroring"),
    bullet("Latvian — Left-to-right layout"),
    para("To change the language, use the language selector in the header. All labels, buttons, and system text will be translated. User-entered data (vendor names, risk descriptions, etc.) is also translated dynamically when records are created or edited."),
    spacer(),
    h2("Common UI Patterns"),
    para("Throughout the application, you will encounter these common interface patterns:"),
    bullet("Data tables — Sortable, filterable lists with pagination and search"),
    bullet("Dialog forms — Modal forms for creating and editing records"),
    bullet("Accordion views — Expandable/collapsible sections for detailed information"),
    bullet("Status badges — Color-coded labels indicating record status"),
    bullet("Action buttons — Create, Edit, Delete, Export, and role-specific actions"),
    bullet("Toast notifications — Brief success/error messages after actions"),
    bullet("Charts — Bar charts, pie charts, and progress indicators on dashboards"),
    pb(),
  ];
}

function buildModuleSection(mod: ModuleSection): Paragraph[] {
  const items: Paragraph[] = [
    h1(mod.name),
    para(mod.description),
    spacer(),
  ];

  for (const page of mod.pages) {
    items.push(h2(page.name));
    items.push(para(page.description));
    // Insert screenshot if available
    const ss = screenshotParagraph(page.name);
    if (ss) {
      items.push(ss);
      items.push(para("Figure: " + page.name + " page view", { italic: true }));
    }
    items.push(h3("Features & Capabilities"));
    for (const f of page.features) {
      items.push(bullet(f));
    }
    items.push(spacer());
    items.push(h3("Navigation Path"));
    items.push(para(page.navPath));
    items.push(spacer());
  }
  items.push(pb());
  return items;
}

function buildRoleOverview(roles: RoleInfo[]): Paragraph[] {
  const items: Paragraph[] = [
    h1("Roles Overview"),
    para("The following table summarizes all available roles and their primary responsibilities:"),
    spacer(),
    simpleTable(
      ["Role", "Description", "Key Access Areas"],
      roles.map(r => [r.displayName, r.description.length > 100 ? r.description.slice(0, 100) + "..." : r.description, r.accessibleModules.slice(0, 4).join(", ")])
    ),
    spacer(),
  ];
  // Add details for each role
  for (const role of roles) {
    items.push(h2(role.displayName));
    items.push(para(role.description));
    items.push(h3("Accessible Modules"));
    for (const mod of role.accessibleModules) {
      items.push(bullet(mod));
    }
    items.push(h3("Key Capabilities"));
    for (const cap of role.keyCapabilities) {
      items.push(bullet(cap));
    }
    items.push(spacer());
  }
  items.push(pb());
  return items;
}

function buildRoleDetail(role: RoleInfo): Paragraph[] {
  return [
    h1(`Role: ${role.displayName}`),
    para(role.description),
    spacer(),
    h2("Accessible Modules"),
    ...role.accessibleModules.map(mod => bullet(mod)),
    spacer(),
    h2("Key Capabilities"),
    ...role.keyCapabilities.map(cap => bullet(cap)),
    pb(),
  ];
}

function buildRoleSpecificModules(role: RoleInfo, allModules: ModuleSection[]): Paragraph[] {
  const items: Paragraph[] = [];
  for (const mod of allModules) {
    const isAccessible = role.moduleKeys.some(
      mk => mk.toLowerCase() === mod.name.toLowerCase() ||
        mod.name.toLowerCase().includes(mk.toLowerCase()) ||
        mk.toLowerCase().includes(mod.name.toLowerCase())
    );
    if (isAccessible) {
      items.push(...buildModuleSection(mod));
    }
  }
  if (items.length === 0) {
    // Fallback: include all modules
    for (const mod of allModules) {
      items.push(...buildModuleSection(mod));
    }
  }
  return items;
}

function buildPermissionsReference(): Paragraph[] {
  return [
    h1("Permissions Reference"),
    para("Each role has specific permissions that determine what actions they can perform. The permission system uses a resource:action pattern."),
    spacer(),
    h2("Actions"),
    bullet("view — Read-only access to see data"),
    bullet("create — Ability to create new records"),
    bullet("edit — Ability to modify existing records"),
    bullet("delete — Ability to remove records"),
    bullet("approve — Ability to approve/reject submissions"),
    spacer(),
    h2("Permission Scopes"),
    bullet("Global — Access to all records across the organization"),
    bullet("Department — Access limited to records within the user's department"),
    bullet("Own — Access limited to records owned by or assigned to the user"),
    spacer(),
    h2("How Permissions Work"),
    para("When you log in, your assigned role determines which sidebar menu items are visible and which actions you can perform on each page. If a menu item or button is not visible, it means your role does not have the required permission."),
    para("Permissions are enforced at both the UI level (hiding unavailable options) and the API level (blocking unauthorized requests). This ensures data security regardless of how the application is accessed."),
    pb(),
  ];
}

function buildGlossary(isTPRM: boolean): Paragraph[] {
  const items: Paragraph[] = [h1("Glossary")];

  if (isTPRM) {
    const terms: [string, string][] = [
      ["TPRM", "Third Party Risk Management — systematic process of analyzing and managing risks associated with outsourcing to third-party vendors."],
      ["VRR", "Vendor Risk Rating — overall risk classification of a vendor, rated as Nominal, Low, Moderate, High, or Critical."],
      ["CAIQ", "Consensus Assessments Initiative Questionnaire — standardized questionnaire for assessing cloud service provider security, organized by domains."],
      ["Assessment", "Formal evaluation of a vendor's security and compliance posture through structured questionnaire-based review."],
      ["Remediation", "Corrective action taken to address identified issues or vulnerabilities found during vendor assessments."],
      ["Monitoring Scan", "Automated security assessment of a vendor using AI-powered web intelligence gathering across 17+ targeted searches."],
      ["KPI (Monitoring)", "Key Performance Indicator in vendor monitoring — measures like Network Security, DNS Health, SSL/TLS Config, etc., scored 0-100."],
      ["Inherent Risk", "Risk level before any controls or mitigations are applied."],
      ["Residual Risk", "Risk level remaining after controls and mitigations are applied."],
      ["Domain", "Specific area of assessment (e.g., Data Security, Access Control, Business Continuity)."],
      ["Offboarding", "Process of terminating a vendor relationship, including contract closure and final assessment."],
      ["Due Diligence", "Systematic investigation of a vendor before and during the engagement to assess risk."],
      ["Scorecard", "Quantitative summary of a vendor's security posture across multiple KPIs."],
      ["Assessment Factory", "Batch mechanism for creating multiple vendor assessments simultaneously."],
      ["SME", "Subject Matter Expert — specialist who provides domain-specific expertise during vendor assessments."],
    ];
    for (const [term, def] of terms) {
      items.push(h3(term));
      items.push(para(def));
    }
  } else {
    const terms: [string, string][] = [
      ["GRC", "Governance, Risk, and Compliance — integrated approach to managing governance, risk management, and compliance activities across the organization."],
      ["BIA", "Business Impact Analysis — process of determining critical business processes and the potential impact of disruption."],
      ["RTO", "Recovery Time Objective — maximum acceptable time to restore a process after disruption."],
      ["RPO", "Recovery Point Objective — maximum acceptable data loss measured in time."],
      ["BCP", "Business Continuity Plan — documented procedures for maintaining business operations during and after a disaster."],
      ["CAPA", "Corrective and Preventive Action — actions taken to eliminate the causes of non-conformities and prevent recurrence."],
      ["CIA", "Confidentiality, Integrity, Availability — three pillars of information security used for asset classification."],
      ["Control", "Measure that modifies risk — can be a policy, procedure, guideline, practice, or organizational structure."],
      ["Finding", "Result of an audit that identifies a gap between the current state and the expected criteria."],
      ["Risk Register", "Centralized record of identified risks with their analysis, treatment plans, and current status."],
      ["Risk Matrix", "Visual tool mapping risks against controls to identify coverage and gaps."],
      ["Framework", "Structured set of guidelines and best practices for managing compliance (e.g., ISO 27001, NIST, SOC 2, GDPR)."],
      ["Audit Universe", "Complete set of auditable entities, processes, and functions within the organization."],
      ["Audit Engagement", "A planned and executed audit activity with defined scope, objectives, and team."],
      ["Evidence", "Documentation, records, or artifacts that demonstrate compliance with controls and requirements."],
      ["Exception", "Documented deviation from a control requirement, with justification and compensating controls."],
      ["KPI", "Key Performance Indicator — measurable metric for tracking compliance program health."],
    ];
    for (const [term, def] of terms) {
      items.push(h3(term));
      items.push(para(def));
    }
  }
  items.push(pb());
  return items;
}

// ─── Full manual builders ───────────────────────────────────────

function buildFullGRCManual(): Paragraph[] {
  const s: Paragraph[] = [];
  s.push(...buildCoverPage("GRC Application", "Complete User Manual — All Roles"));
  s.push(...buildGettingStarted("GRC"));
  s.push(...buildRoleOverview(GRC_ROLES));
  for (const mod of GRC_MODULES) s.push(...buildModuleSection(mod));
  s.push(...buildPermissionsReference());
  s.push(...buildGlossary(false));
  return s;
}

function buildGRCRoleManual(role: RoleInfo): Paragraph[] {
  const s: Paragraph[] = [];
  s.push(...buildCoverPage("GRC Application", `User Manual — ${role.displayName}`));
  s.push(...buildGettingStarted("GRC"));
  s.push(...buildRoleDetail(role));
  s.push(...buildRoleSpecificModules(role, GRC_MODULES));
  s.push(...buildPermissionsReference());
  s.push(...buildGlossary(false));
  return s;
}

function buildFullTPRMManual(): Paragraph[] {
  const s: Paragraph[] = [];
  s.push(...buildCoverPage("TPRM Module", "Complete User Manual — All Roles"));
  s.push(...buildGettingStarted("TPRM"));
  s.push(...buildRoleOverview(TPRM_ROLES));
  for (const mod of TPRM_MODULES) s.push(...buildModuleSection(mod));
  s.push(...buildPermissionsReference());
  s.push(...buildGlossary(true));
  return s;
}

function buildTPRMRoleManual(role: RoleInfo): Paragraph[] {
  const s: Paragraph[] = [];
  s.push(...buildCoverPage("TPRM Module", `User Manual — ${role.displayName}`));
  s.push(...buildGettingStarted("TPRM"));
  s.push(...buildRoleDetail(role));
  s.push(...buildRoleSpecificModules(role, TPRM_MODULES));
  s.push(...buildPermissionsReference());
  s.push(...buildGlossary(true));
  return s;
}

// ─── Build & write document ─────────────────────────────────────

async function generateDoc(filename: string, children: Paragraph[]) {
  const doc = new Document({
    sections: [{
      properties: {},
      headers: { default: makeHeader(filename.replace(".docx", "").replace(/_/g, " ")) },
      footers: { default: makeFooter() },
      children,
    }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: BRAND.dark },
        },
      },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  const outDir = path.join(process.cwd(), "manuals");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("Generating GRC & TPRM User Manuals...\n");

  console.log("=== GRC Manuals ===");
  await generateDoc("GRC_Full_Manual.docx", buildFullGRCManual());
  for (const role of GRC_ROLES) {
    await generateDoc(`GRC_${role.name}.docx`, buildGRCRoleManual(role));
  }

  console.log("\n=== TPRM Manuals ===");
  await generateDoc("TPRM_Full_Manual.docx", buildFullTPRMManual());
  for (const role of TPRM_ROLES) {
    await generateDoc(`TPRM_${role.name}.docx`, buildTPRMRoleManual(role));
  }

  console.log(`\nDone! ${GRC_ROLES.length + TPRM_ROLES.length + 2} manuals generated in manuals/`);
}

main().catch(console.error);
