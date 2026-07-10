// Audit Planning Memorandum (APM) — structured, data-driven template.
//
// Mirrors the 17-section APM defined by the Internal Audit team
// (source: APM_Final.docx). Each section is broken into one or more
// LABELED fields so auditors fill in discrete inputs rather than one big
// free-text box. The whole memorandum is stored as JSON in
// `AuditEngagementAPM.content`.
//
// The section/field layout lives in a single `APM_STRUCTURE` definition so
// the editor and the print view render from one source of truth. Two sections
// carry an extra widget: section 2 (Risk-Based Justification) appends the
// trigger-factor checkboxes; section 7 (Risk & Control Framework) appends the
// editable Objective/Risk/Control table.

export interface ApmTriggerFactor {
  label: string;
  checked: boolean;
}

export interface ApmFrameworkRow {
  objective: string;
  risk: string;
  control: string;
  auditProcedure: string;
  riskRating: string;
  controlType: string;
  controlFrequency: string;
}

export type ApmFieldType = "text" | "textarea" | "date";

export interface ApmField {
  key: string;
  label: string;
  type: ApmFieldType;
  rows?: number;
  placeholder?: string;
  default: string;
}

export interface ApmSectionDef {
  key: string;
  number: number;
  title: string;
  fields: ApmField[];
  // Optional extra widget rendered after `specialAfter` fields (default: end).
  special?: "triggerFactors" | "frameworkTable";
  specialAfter?: number;
}

// Section 2 trigger factors.
export const APM_TRIGGER_FACTOR_LABELS = [
  "High dependency on manual or judgment-based processes",
  "Absence or immaturity of automated controls",
  "Significant reliance on third parties or external stakeholders",
  "Gaps identified in previous audits or control assessments",
  "Changes in regulatory landscape or enforcement expectations",
] as const;

// Section 7 table dropdown options.
export const APM_RISK_RATINGS = ["High", "Medium", "Low"] as const;
export const APM_CONTROL_TYPES = [
  "Preventive",
  "Detective",
  "Automated",
  "Manual",
] as const;
export const APM_CONTROL_FREQUENCIES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Ad hoc",
] as const;

export const emptyFrameworkRow = (): ApmFrameworkRow => ({
  objective: "",
  risk: "",
  control: "",
  auditProcedure: "",
  riskRating: "",
  controlType: "",
  controlFrequency: "",
});

// ---------------------------------------------------------------------------
// The 17 sections, each with labeled fields. Defaults are the standard
// professional boilerplate from APM_Final.docx; auditors customize from here.
// ---------------------------------------------------------------------------
export const APM_STRUCTURE: ApmSectionDef[] = [
  {
    key: "engagementOverview",
    number: 1,
    title: "Engagement Overview",
    fields: [
      {
        key: "purpose",
        label: "Purpose & Alignment",
        type: "textarea",
        rows: 3,
        default:
          "This Audit Planning Memorandum (APM) defines the audit strategy, scope, and execution approach aligned with the approved risk-based internal audit plan and organizational strategic priorities.",
      },
      {
        key: "assurance",
        label: "Assurance Provided",
        type: "textarea",
        rows: 3,
        default:
          "The engagement provides independent assurance on whether governance, risk management, and control processes are adequately designed and operating effectively to mitigate key risks.",
      },
      {
        key: "riskFocus",
        label: "Risk Focus",
        type: "textarea",
        rows: 2,
        default:
          "This audit focuses on areas of highest risk exposure and control reliance critical to achieving organizational objectives.",
      },
    ],
  },
  {
    key: "riskBasedJustification",
    number: 2,
    title: "Risk-Based Justification",
    special: "triggerFactors",
    specialAfter: 2,
    fields: [
      {
        key: "planYear",
        label: "Approved Risk-Based Audit Plan Year",
        type: "text",
        placeholder: "20XX",
        default: "20XX",
      },
      {
        key: "justification",
        label: "Justification",
        type: "textarea",
        rows: 3,
        default:
          "This engagement is selected based on the approved risk-based audit plan for the year stated above, and the following trigger factors were taken into consideration upon planning the engagement:",
      },
      {
        key: "conclusion",
        label: "Conclusion",
        type: "textarea",
        rows: 2,
        default:
          "The combination of these factors indicates an elevated residual risk exposure, requiring targeted internal audit intervention.",
      },
    ],
  },
  {
    key: "background",
    number: 3,
    title: "Background",
    fields: [
      {
        key: "function",
        label: "Audited Function",
        type: "textarea",
        rows: 2,
        default: "The audited function supports key organizational objectives.",
      },
      {
        key: "dependencies",
        label: "Control Environment Dependencies",
        type: "textarea",
        rows: 2,
        default:
          "Control environment effectiveness depends on process standardization, automation, clarity of roles, and oversight mechanisms.",
      },
      {
        key: "weaknesses",
        label: "Potential Weaknesses",
        type: "textarea",
        rows: 2,
        default:
          "Weaknesses in these areas may result in control failures, inconsistent policy application, and reporting inaccuracies.",
      },
    ],
  },
  {
    key: "objectives",
    number: 4,
    title: "Objectives",
    fields: [
      {
        key: "aimsTo",
        label: "The audit aims to",
        type: "textarea",
        rows: 6,
        default:
          "- Assess risk identification and management effectiveness\n- Evaluate control design and operating effectiveness\n- Ensure compliance with laws and policies\n- Assess governance and oversight\n- Identify improvement opportunities and control maturity gaps",
      },
      {
        key: "alsoAssess",
        label: "The audit will also assess whether",
        type: "textarea",
        rows: 3,
        default:
          "- Risk ownership is clearly defined and understood\n- Monitoring mechanisms are sufficient to detect control failures on a timely basis",
      },
    ],
  },
  {
    key: "scope",
    number: 5,
    title: "Scope",
    fields: [
      {
        key: "basis",
        label: "Scope Basis",
        type: "textarea",
        rows: 2,
        default: "Scope is determined based on risk and process criticality.",
      },
      {
        key: "focusAreas",
        label: "Focus Areas",
        type: "textarea",
        rows: 2,
        default:
          "Focus areas include governance, compliance with relevant regulations, operations, reporting, and supporting systems.",
      },
    ],
  },
  {
    key: "riskAssessmentSummary",
    number: 6,
    title: "Risk Assessment Summary",
    fields: [
      {
        key: "basis",
        label: "Risk Prioritization Basis",
        type: "textarea",
        rows: 2,
        default: "Risk prioritization is based on impact, likelihood, and control strength.",
      },
    ],
  },
  {
    key: "riskControlFramework",
    number: 7,
    title: "Risk & Control Framework",
    special: "frameworkTable",
    fields: [
      {
        key: "approach",
        label: "Audit Approach",
        type: "textarea",
        rows: 3,
        default:
          "The audit approach is based on identifying key risks and evaluating related controls. Control types include preventive, detective, automated, and manual controls.",
      },
      {
        key: "focusOn",
        label: "The audit will focus on",
        type: "textarea",
        rows: 6,
        default:
          "- Key risk areas\n- Control design, implementation and operating effectiveness\n- Indicators of control weaknesses\n- Automation vs manual dependency\n- Susceptibility to override\n- Audit procedures",
      },
    ],
  },
  {
    key: "controlRelianceStrategy",
    number: 8,
    title: "Control Reliance Strategy",
    fields: [
      {
        key: "dependsOn",
        label: "Control reliance will depend on",
        type: "textarea",
        rows: 7,
        default:
          "- Operating effectiveness in the past\n- Appropriateness of design\n- Consistency of execution\n- Frequency of using controls\n- Complexity of operations\n- Automation and dependency on individuals vs systems\n- Susceptibility to override",
      },
      {
        key: "highReliance",
        label: "High reliance will only be placed on controls that demonstrate",
        type: "textarea",
        rows: 3,
        default:
          "- Consistent execution\n- Verifiable evidence\n- Minimal subjectivity",
      },
    ],
  },
  {
    key: "auditMethodology",
    number: 9,
    title: "Audit Methodology",
    fields: [
      {
        key: "approach",
        label: "Risk-Based Approach",
        type: "textarea",
        rows: 6,
        default:
          "The audit will apply a risk-based approach including:\n- Walkthroughs and process validation\n- Identification and mapping of key controls\n- Testing of design and operating effectiveness\n- Substantive testing where needed\n- Data analytics",
      },
    ],
  },
  {
    key: "samplingApproach",
    number: 10,
    title: "Sampling Approach",
    fields: [
      {
        key: "technique",
        label: "Sampling Technique",
        type: "textarea",
        rows: 5,
        default:
          "Sampling will combine judgmental and random techniques focusing on high-risk transactions. Sample sizes may be expanded if control deviations are identified.\n\nSampling will incorporate both:\n- Judgmental selection (targeting high-risk items)\n- Random selection (ensuring coverage and objectivity)",
      },
      {
        key: "expansion",
        label: "Sample Expansion Triggers",
        type: "textarea",
        rows: 3,
        default:
          "Where exceptions are identified, sample sizes may be expanded to:\n- Confirm systemic issues\n- Assess the extent of control failure",
      },
    ],
  },
  {
    key: "dataAnalytics",
    number: 11,
    title: "Data Analytics",
    fields: [
      {
        key: "usage",
        label: "Data Analytics Usage",
        type: "textarea",
        rows: 7,
        default:
          "Analytics will be used to identify anomalies, validate controls, and detect inefficiencies. Where feasible, data analytics techniques will be integrated into the audit approach to enhance coverage, efficiency, and depth of analysis.\n\nData analytics will be used to:\n- Identify anomalies, outliers, and unusual patterns within large datasets\n- Detect potential control breaches or non-compliance scenarios\n- Validate the completeness and accuracy of transactions\n- Assess trends and correlations that may indicate emerging risks",
      },
      {
        key: "techniques",
        label: "Analytics Techniques",
        type: "textarea",
        rows: 6,
        default:
          "Analytics may include:\n- Trend analysis\n- Exception reporting\n- Duplicate or abnormal transaction testing\n- Rule-based testing aligned with control requirements\n\nThe use of analytics will enable the audit to move beyond traditional sampling and provide broader and more continuous assurance coverage.",
      },
    ],
  },
  {
    key: "fraudRiskConsideration",
    number: 12,
    title: "Fraud Risk Consideration",
    fields: [
      {
        key: "attention",
        label: "Particular attention will be given to",
        type: "textarea",
        rows: 6,
        default:
          "In accordance with professional standards, the audit will explicitly consider the risk of fraud and management override of controls.\n\nParticular attention will be given to:\n- Areas with high judgment or estimation\n- Transactions outside normal business patterns\n- Lack of segregation of duties\n- Override or bypassing of established controls",
      },
      {
        key: "alsoAssess",
        label: "The audit will also assess whether",
        type: "textarea",
        rows: 3,
        default:
          "- Anti-fraud controls are adequately designed and implemented\n- There is sufficient monitoring to detect fraudulent activities\n- Management demonstrates an appropriate tone at the top",
      },
      {
        key: "limitation",
        label: "Scope Limitation",
        type: "textarea",
        rows: 2,
        default:
          "While the audit is not designed to detect all fraud, procedures will be performed to identify indicators of potential fraudulent activity and escalate them where necessary.",
      },
    ],
  },
  {
    key: "stakeholderCommunication",
    number: 13,
    title: "Stakeholder Communication",
    fields: [
      {
        key: "intro",
        label: "Communication Approach",
        type: "textarea",
        rows: 2,
        default:
          "Effective and continuous communication with stakeholders is critical to the success of the audit engagement. The audit team will adopt a structured communication approach, including:",
      },
      {
        key: "openingMeeting",
        label: "Opening Meeting",
        type: "textarea",
        rows: 2,
        default:
          "To confirm audit objectives, scope, timelines, and key expectations with management.",
      },
      {
        key: "ongoingEngagement",
        label: "Ongoing Engagement",
        type: "textarea",
        rows: 2,
        default:
          "Regular interactions with process owners to clarify processes, validate understanding, and discuss preliminary observations.",
      },
      {
        key: "issueValidation",
        label: "Issue Validation",
        type: "textarea",
        rows: 2,
        default:
          "All identified observations will be discussed with management to confirm factual accuracy, obtain management perspective, and ensure alignment before reporting.",
      },
      {
        key: "closingMeeting",
        label: "Closing Meeting",
        type: "textarea",
        rows: 2,
        default: "Presentation of key findings, risk implications, and recommended actions.",
      },
      {
        key: "reporting",
        label: "Reporting",
        type: "textarea",
        rows: 2,
        default:
          "Issuance of draft and final audit reports, incorporating management responses.",
      },
    ],
  },
  {
    key: "timelineResources",
    number: 14,
    title: "Timeline & Resources",
    fields: [
      { key: "startDate", label: "Start Date", type: "date", default: "" },
      { key: "endDate", label: "End Date", type: "date", default: "" },
      { key: "auditTeam", label: "Audit Team", type: "text", default: "" },
      {
        key: "manDays",
        label: "Number of Audit Days",
        type: "text",
        placeholder: "XX Man-days",
        default: "",
      },
      {
        key: "planningPhase",
        label: "Planning Phase",
        type: "textarea",
        rows: 2,
        default:
          "Understanding the process, identifying risks, and developing the audit approach.",
      },
      {
        key: "fieldworkPhase",
        label: "Fieldwork Phase",
        type: "textarea",
        rows: 2,
        default:
          "Execution of audit procedures, including testing of controls and data analysis.",
      },
      {
        key: "reportingPhase",
        label: "Reporting Phase",
        type: "textarea",
        rows: 2,
        default:
          "Consolidation of findings, validation with management, and issuance of reports.",
      },
      {
        key: "resourceAllocation",
        label: "Resource Allocation",
        type: "textarea",
        rows: 4,
        default:
          "The audit team will consist of personnel with appropriate skills, experience, and subject matter expertise relevant to the audited area. Resource allocation will be aligned with the complexity of processes, the level of risk, and the extent of audit coverage required. Timelines may be adjusted where necessary to ensure audit quality is not compromised.",
      },
    ],
  },
  {
    key: "reportingApproach",
    number: 15,
    title: "Reporting Approach",
    fields: [
      {
        key: "observation",
        label: "Each observation will include",
        type: "textarea",
        rows: 4,
        default:
          "- Criteria for the finding\n- A clear description of the issue\n- Associated risks and implications\n- Practical and actionable recommendations",
      },
      {
        key: "priorities",
        label: "Recommendations will be prioritized as",
        type: "textarea",
        rows: 3,
        default:
          "- High Priority: requiring immediate action due to significant risk exposure\n- Medium Priority: requiring timely remediation\n- Low Priority: improvement opportunities",
      },
      {
        key: "opinion",
        label: "Overall Opinion on the Control Environment",
        type: "textarea",
        rows: 3,
        default:
          "- Satisfactory: controls are well designed and operating effectively\n- Improvements Required: some control weaknesses identified\n- Unsatisfactory: significant control deficiencies exist",
      },
    ],
  },
  {
    key: "independenceSkepticism",
    number: 16,
    title: "Independence & Professional Skepticism",
    fields: [
      {
        key: "independence",
        label: "Independence Confirmation",
        type: "textarea",
        rows: 4,
        default:
          "The audit engagement will be conducted with full independence and objectivity, in accordance with the IIA Code of Ethics and internal audit policies.\n\nThe audit team confirms that:\n- No conflicts of interest exist that would impair independence\n- The engagement will be performed without undue influence from management",
      },
      {
        key: "skepticism",
        label: "Professional Skepticism",
        type: "textarea",
        rows: 4,
        default:
          "The audit team will apply professional skepticism throughout the engagement by:\n- Critically assessing information and explanations provided\n- Challenging assumptions and judgments\n- Seeking corroborative evidence to support conclusions\n\nThis approach ensures that audit conclusions are based on reliable and sufficient evidence.",
      },
    ],
  },
  {
    key: "qualityAssurance",
    number: 17,
    title: "Quality Assurance",
    fields: [
      {
        key: "measures",
        label: "Quality Assurance Measures",
        type: "textarea",
        rows: 5,
        default:
          "This engagement will be conducted in accordance with the Internal Audit Function's Quality Assurance and Improvement Program (QAIP), ensuring compliance with the Global Internal Audit Standards (IIA 2024).\n\nQuality assurance measures include:\n- Supervisory review of audit work and documentation\n- Adherence to standardized audit methodologies and templates\n- Validation of audit evidence and conclusions\n- Alignment with internal audit policies and procedures",
      },
      {
        key: "subjectTo",
        label: "The engagement will also be subject to",
        type: "textarea",
        rows: 3,
        default:
          "- Periodic internal quality reviews\n- External quality assessments (where applicable)\n\nThese measures ensure that the audit maintains a high level of consistency, reliability, and professional quality.",
      },
    ],
  },
];

// A single field instance inside a section. Predefined fields (custom=false)
// keep a translatable label; custom fields (custom=true) carry a user-entered
// label. Auditors can add and delete fields freely per section.
export interface ApmFieldValue {
  id: string;
  label: string;
  value: string;
  type: ApmFieldType;
  custom: boolean;
}

// A user-added section (numbered after the 17 predefined ones).
export interface ApmCustomSection {
  key: string;
  title: string;
}

// Audit Program working-paper columns (entered inline instead of Excel upload).
export const APM_AUDIT_PROGRAM_COLUMNS = [
  "Objective",
  "Process / Sub-process",
  "Risk",
  "Control",
  "Control Type",
  "Key Control",
  "Test Type",
  "Audit Procedure",
  "Sampling Method",
  "Sample Size",
  "Evidence Required",
  "Result",
  "Conclusion",
  "Exception",
  "Working Paper",
] as const;

export type AuditProgramRow = Record<string, string>;

export function emptyAuditProgramRow(): AuditProgramRow {
  const row: AuditProgramRow = {};
  for (const c of APM_AUDIT_PROGRAM_COLUMNS) row[c] = "";
  return row;
}

// Content shape: per-section ordered list of fields, the two widgets, any
// user-added custom sections, and the keys of predefined sections the user has
// removed. Custom section fields live in `sections[key]`.
export interface ApmContent {
  sections: Record<string, ApmFieldValue[]>;
  triggerFactors: ApmTriggerFactor[];
  frameworkRows: ApmFrameworkRow[];
  customSections: ApmCustomSection[];
  // Predefined (APM_STRUCTURE) section keys the user has deleted.
  removedSections: string[];
  // Audit Program working-paper entries (entered inline).
  auditProgramRows: AuditProgramRow[];
}

// Make a custom section. Caller supplies a unique key.
export function makeCustomSection(key: string, title = ""): ApmCustomSection {
  return { key, title };
}

// Make a field instance from a predefined structure field (value starts empty).
function fieldFromDef(f: ApmField): ApmFieldValue {
  return { id: f.key, label: f.label, value: "", type: f.type, custom: false };
}

// Make a custom (user-added) field. Caller supplies a unique id.
export function makeCustomField(id: string, label = "", value = ""): ApmFieldValue {
  return { id, label, value, type: "textarea", custom: true };
}

// Build default content from the structure. Fields start EMPTY — auditors fill
// them in. (Each field's `default` text is retained in APM_STRUCTURE as
// reference boilerplate, but is not pre-populated into new memoranda.)
export function cloneDefaultApmContent(): ApmContent {
  const sections: Record<string, ApmFieldValue[]> = {};
  for (const sec of APM_STRUCTURE) {
    sections[sec.key] = sec.fields.map(fieldFromDef);
  }
  return {
    sections,
    triggerFactors: APM_TRIGGER_FACTOR_LABELS.map((label) => ({ label, checked: false })),
    frameworkRows: [emptyFrameworkRow()],
    customSections: [],
    removedSections: [],
    auditProgramRows: [emptyAuditProgramRow()],
  };
}

// Normalize a saved array of fields into ApmFieldValue[] (custom-section safe).
function normalizeFieldArray(saved: unknown, keyPrefix: string): ApmFieldValue[] {
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f, i) => {
      const type = (f.type === "text" || f.type === "date" ? f.type : "textarea") as ApmFieldType;
      return {
        id: typeof f.id === "string" && f.id ? f.id : `${keyPrefix}-${i}`,
        label: typeof f.label === "string" ? f.label : "",
        value: typeof f.value === "string" ? f.value : "",
        type,
        custom: typeof f.custom === "boolean" ? f.custom : true,
      };
    });
}

// Legacy (pre-labeled-fields) content shape, for migration.
interface LegacyApmContent {
  engagementOverview?: string;
  riskBasedJustification?: { intro?: string; factors?: ApmTriggerFactor[]; conclusion?: string };
  background?: string;
  objectives?: string;
  scope?: string;
  riskAssessmentSummary?: string;
  riskControlFramework?: { intro?: string; rows?: ApmFrameworkRow[] };
  controlRelianceStrategy?: string;
  auditMethodology?: string;
  samplingApproach?: string;
  dataAnalytics?: string;
  fraudRiskConsideration?: string;
  stakeholderCommunication?: string;
  timelineResources?: {
    startDate?: string;
    endDate?: string;
    auditTeam?: string;
    manDays?: string;
    narrative?: string;
  };
  reportingApproach?: string;
  independenceSkepticism?: string;
  qualityAssurance?: string;
}

// Set a field's value within a section's field array (by field id).
function setSectionFieldValue(c: ApmContent, sectionKey: string, fieldId: string, value: string) {
  const arr = c.sections[sectionKey];
  if (!arr) return;
  const f = arr.find((x) => x.id === fieldId);
  if (f) f.value = value;
}

// Map a legacy single-string section onto the new labeled fields: the saved
// text goes into the section's first field; remaining fields keep defaults.
function migrateLegacy(raw: LegacyApmContent): ApmContent {
  const c = cloneDefaultApmContent();
  const put = (sectionKey: string, text: string | undefined) => {
    if (typeof text === "string" && text.trim()) {
      const first = APM_STRUCTURE.find((s) => s.key === sectionKey)?.fields[0]?.key;
      if (first) setSectionFieldValue(c, sectionKey, first, text);
    }
  };
  put("engagementOverview", raw.engagementOverview);
  put("background", raw.background);
  put("objectives", raw.objectives);
  put("scope", raw.scope);
  put("riskAssessmentSummary", raw.riskAssessmentSummary);
  put("controlRelianceStrategy", raw.controlRelianceStrategy);
  put("auditMethodology", raw.auditMethodology);
  put("samplingApproach", raw.samplingApproach);
  put("dataAnalytics", raw.dataAnalytics);
  put("fraudRiskConsideration", raw.fraudRiskConsideration);
  put("stakeholderCommunication", raw.stakeholderCommunication);
  put("reportingApproach", raw.reportingApproach);
  put("independenceSkepticism", raw.independenceSkepticism);
  put("qualityAssurance", raw.qualityAssurance);

  if (raw.riskBasedJustification) {
    if (raw.riskBasedJustification.intro)
      setSectionFieldValue(c, "riskBasedJustification", "justification", raw.riskBasedJustification.intro);
    if (raw.riskBasedJustification.conclusion)
      setSectionFieldValue(c, "riskBasedJustification", "conclusion", raw.riskBasedJustification.conclusion);
    if (Array.isArray(raw.riskBasedJustification.factors)) {
      c.triggerFactors = APM_TRIGGER_FACTOR_LABELS.map((label) => {
        const m = raw.riskBasedJustification!.factors!.find((f) => f && f.label === label);
        return { label, checked: m ? !!m.checked : true };
      });
    }
  }
  if (raw.riskControlFramework) {
    if (raw.riskControlFramework.intro)
      setSectionFieldValue(c, "riskControlFramework", "approach", raw.riskControlFramework.intro);
    if (Array.isArray(raw.riskControlFramework.rows) && raw.riskControlFramework.rows.length)
      c.frameworkRows = raw.riskControlFramework.rows.map((r) => ({ ...emptyFrameworkRow(), ...r }));
  }
  if (raw.timelineResources) {
    const tr = raw.timelineResources;
    if (tr.startDate) setSectionFieldValue(c, "timelineResources", "startDate", tr.startDate);
    if (tr.endDate) setSectionFieldValue(c, "timelineResources", "endDate", tr.endDate);
    if (tr.auditTeam) setSectionFieldValue(c, "timelineResources", "auditTeam", tr.auditTeam);
    if (tr.manDays) setSectionFieldValue(c, "timelineResources", "manDays", tr.manDays);
    if (tr.narrative) setSectionFieldValue(c, "timelineResources", "resourceAllocation", tr.narrative);
  }
  return c;
}

// Normalize any saved content: backfill missing fields from defaults, and
// migrate the legacy single-string shape. Preserves user-entered values.
export function normalizeApmContent(raw: unknown): ApmContent {
  const d = cloneDefaultApmContent();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;

  // Current shape (has `sections`).
  if (r.sections && typeof r.sections === "object") {
    const savedSections = r.sections as Record<string, unknown>;
    const removed = Array.isArray(r.removedSections)
      ? (r.removedSections as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    d.removedSections = removed;
    for (const sec of APM_STRUCTURE) {
      if (removed.includes(sec.key)) {
        d.sections[sec.key] = [];
        continue;
      }
      const saved = savedSections[sec.key];
      if (Array.isArray(saved)) {
        // New array-of-fields shape — use the saved list verbatim (user may
        // have added/deleted/renamed fields), normalizing each entry.
        d.sections[sec.key] = normalizeFieldArray(saved, sec.key);
      } else if (saved && typeof saved === "object") {
        // Older map shape { fieldKey: value } — map onto predefined fields.
        const map = saved as Record<string, unknown>;
        d.sections[sec.key] = sec.fields.map((def) => ({
          ...fieldFromDef(def),
          value: typeof map[def.key] === "string" ? (map[def.key] as string) : "",
        }));
        // Preserve any unknown keys as custom fields.
        const known = new Set(sec.fields.map((f) => f.key));
        for (const [k, v] of Object.entries(map)) {
          if (!known.has(k) && typeof v === "string") {
            d.sections[sec.key].push(makeCustomField(`${sec.key}-${k}`, k, v));
          }
        }
      }
      // else: section absent from saved data -> keep default fields.
    }
    const rawFactors = Array.isArray(r.triggerFactors) ? (r.triggerFactors as ApmTriggerFactor[]) : [];
    d.triggerFactors = APM_TRIGGER_FACTOR_LABELS.map((label) => {
      const m = rawFactors.find((f) => f && typeof f === "object" && f.label === label);
      return { label, checked: m ? !!m.checked : false };
    });
    if (Array.isArray(r.frameworkRows) && r.frameworkRows.length) {
      d.frameworkRows = (r.frameworkRows as ApmFrameworkRow[]).map((row) => ({
        ...emptyFrameworkRow(),
        ...(row || {}),
      }));
    }
    // Audit Program working-paper entries.
    if (Array.isArray(r.auditProgramRows) && r.auditProgramRows.length) {
      d.auditProgramRows = (r.auditProgramRows as unknown[]).map((row) => {
        const out = emptyAuditProgramRow();
        if (row && typeof row === "object") {
          for (const c of APM_AUDIT_PROGRAM_COLUMNS) {
            const v = (row as Record<string, unknown>)[c];
            if (typeof v === "string") out[c] = v;
          }
        }
        return out;
      });
    }
    // User-added custom sections + their fields.
    if (Array.isArray(r.customSections)) {
      for (const cs of r.customSections as Array<Record<string, unknown>>) {
        if (!cs || typeof cs !== "object" || typeof cs.key !== "string" || !cs.key) continue;
        const title = typeof cs.title === "string" ? cs.title : "";
        d.customSections.push({ key: cs.key, title });
        d.sections[cs.key] = normalizeFieldArray(savedSections[cs.key], cs.key);
      }
    }
    return d;
  }

  // Legacy shape.
  return migrateLegacy(r as LegacyApmContent);
}
