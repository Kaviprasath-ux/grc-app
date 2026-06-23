import type { CharterBlock, CharterInlineNode } from './charter-parser';

// ── Builder helpers ────────────────────────────────────────────────────────────

const t = (content: string): CharterInlineNode => ({ type: 'text', content });
const f = (id: string, defaultValue: string): CharterInlineNode => ({ type: 'field', id, defaultValue });

// Named field factories — calling each as a function ensures each block gets
// its own object, which avoids shared-reference surprises during serialisation.
const ORG = () => f('org_name', '[name of organization]');
const FREQ = () => f('report_frequency', '[periodically]');
const BOARD_DATE = () => f('board_date', '[date]');
const CEO = () => f('ceo_title', '[chief executive officer or equivalent senior officer]');
const CHARTER_FREQ = () => f('charter_review_freq', '[periodically (typically annually)]');

function p(...segs: CharterInlineNode[]): CharterBlock {
  return { type: 'paragraph', segments: segs };
}
function h2(content: string): CharterBlock {
  return { type: 'heading', level: 2, segments: [t(content)] };
}
function h3(content: string): CharterBlock {
  return { type: 'heading', level: 3, segments: [t(content)] };
}
function ul(...items: CharterInlineNode[][]): CharterBlock {
  return { type: 'list', ordered: false, items: items.map((segments) => ({ segments })) };
}

// ── Helper: does a parsed content array have any editable fields? ─────────────

export function hasEditableFields(content: unknown[]): boolean {
  function checkSegs(segs: CharterInlineNode[]): boolean {
    return segs.some((s) => s.type === 'field');
  }
  return (content as CharterBlock[]).some((block) => {
    if (block.type === 'heading' || block.type === 'paragraph') return checkSegs(block.segments);
    if (block.type === 'list') return block.items.some((it) => checkSegs(it.segments));
    if (block.type === 'table') return block.rows.some((r) => r.cells.some((c) => checkSegs(c.segments)));
    return false;
  });
}

// ── IIA Model Internal Audit Charter — default content ────────────────────────
//
// Source: The IIA's Model Internal Audit Charter.
// Bracket placeholders ([name of organization] etc.) are mapped to named field
// IDs so ALL occurrences share a single value — editing one updates them all.

export const DEFAULT_CHARTER_CONTENT: CharterBlock[] = [
  // ── Title ──────────────────────────────────────────────────────────────────
  p(t('Internal Audit Charter for '), ORG()),

  // ── Purpose ────────────────────────────────────────────────────────────────
  h2('Purpose'),
  p(
    t('The purpose of the internal audit function is to strengthen '), ORG(),
    t("’s ability to create, protect, and sustain value by providing the board and management with independent, risk-based, and objective assurance, advice, insight, and foresight."),
  ),
  p(t('The internal audit function enhances '), ORG(), t('’s:')),
  ul(
    [t('Successful achievement of its objectives.')],
    [t('Governance, risk management, and control processes.')],
    [t('Decision-making and oversight.')],
    [t('Reputation and credibility with its stakeholders.')],
    [t('Ability to serve public interest.')],
  ),
  p(ORG(), t('’s internal audit function is most effective when:')),
  ul(
    [t('Internal auditing is performed by competent professionals in conformance with The IIA’s Global Internal Audit Standards™, which are set in the public interest.')],
    [t('The internal audit function is independently positioned with direct accountability to the board.')],
    [t('Internal auditors are free from undue influence and committed to making objective assessments.')],
  ),

  // ── Commitment to Adhering to the Global Internal Audit Standards ──────────
  h2('Commitment to Adhering to the Global Internal Audit Standards'),
  p(
    t('The '), ORG(),
    t('’s internal audit function will adhere to the mandatory elements of The Institute of Internal Auditors’ International Professional Practices Framework, which are the Global Internal Audit Standards and Topical Requirements. The chief audit executive will report '), FREQ(),
    t(' to the board and senior management regarding the internal audit function’s conformance with the Standards, which will be assessed through a quality assurance and improvement program.'),
  ),

  // ── Mandate ────────────────────────────────────────────────────────────────
  h2('Mandate'),
  p(t('[USER’S NOTE: In those jurisdictions and industries where the internal audit function’s mandate is prescribed wholly or partially in laws or regulations, the internal audit charter must include the legal requirements of the mandate. See user’s guide for more information.]')),

  // ── Authority ──────────────────────────────────────────────────────────────
  h2('Authority'),
  p(
    t('The '), ORG(),
    t('’s board grants the internal audit function the mandate to provide the board and senior management with objective assurance, advice, insight, and foresight.'),
  ),
  p(t('The internal audit function’s authority is created by its direct reporting relationship to the board. Such authority allows for unrestricted access to the board.')),
  p(t('The board authorizes the internal audit function to:')),
  ul(
    [t('Have full and unrestricted access to all functions, data, records, information, physical property, and personnel pertinent to carrying out internal audit responsibilities. Internal auditors are accountable for confidentiality and safeguarding records and information.')],
    [t('Allocate resources, set frequencies, select subjects, determine scopes of work, apply techniques, and issue communications to accomplish the function’s objectives.')],
    [t('Obtain assistance from the necessary personnel of '), ORG(), t(' and other specialized services from within or outside '), ORG(), t(' to complete internal audit services.')],
  ),

  // ── Independence, Organizational Position, and Reporting Relationships ──────
  h2('Independence, Organizational Position, and Reporting Relationships'),
  p(
    t('The chief audit executive will be positioned at a level in the organization that enables internal audit services and responsibilities to be performed without interference from management, thereby establishing the independence of the internal audit function. (See “Mandate” section.) The chief audit executive will report functionally to the board and administratively (for example, day-to-day operations) to the '), CEO(),
    t('. This positioning provides the organizational authority and status to bring matters directly to senior management and escalate matters to the board, when necessary, without interference and supports the internal auditors’ ability to maintain objectivity.'),
  ),
  p(t('The chief audit executive will confirm to the board, at least annually, the organizational independence of the internal audit function. If the governance structure does not support organizational independence, the chief audit executive will document the characteristics of the governance structure limiting independence and any safeguards employed to support the principle of independence. The chief audit executive will disclose to the board any interference internal auditors encounter related to the scope, performance, or communication of internal audit work and results. The disclosure will include communicating the implications of such interference on the internal audit function’s effectiveness and ability to fulfill its mandate.')),

  // ── Changes to the Mandate and Charter ────────────────────────────────────
  h2('Changes to the Mandate and Charter'),
  p(t('Circumstances may justify a follow-up discussion between the chief audit executive, board, and senior management on the internal audit mandate or other aspects of the internal audit charter. Such circumstances may include but are not limited to:')),
  ul(
    [t('A significant change in the Global Internal Audit Standards.')],
    [t('A significant acquisition or reorganization within the organization.')],
    [t('Significant changes in the chief audit executive, board, and/or senior management.')],
    [t('Significant changes to the organization’s strategies, objectives, risk profile, or the environment in which the organization operates.')],
    [t('New laws or regulations that may affect the nature and/or scope of internal audit services.')],
  ),

  // ── Board Oversight ────────────────────────────────────────────────────────
  h2('Board Oversight'),
  p(t('[USER’S NOTE: Due to the Global Internal Audit Standards’ “essential conditions,” board responsibilities should be included in the internal audit charter. However, if an audit committee charter that outlines its responsibilities is already in place, it is not necessary to repeat the information in this charter.]')),
  p(t('To establish, maintain, and ensure that '), ORG(), t('’s internal audit function has sufficient authority to fulfill its duties, the board will:')),
  ul(
    [t('Discuss with the chief audit executive and senior management the appropriate authority, role, responsibilities, scope, and services (assurance and/or advisory) of the internal audit function.')],
    [t('Ensure the chief audit executive has unrestricted access to and communicates and interacts directly with the board, including in private meetings without senior management present.')],
    [t('Discuss with the chief audit executive and senior management other topics that should be included in the internal audit charter.')],
    [t('Participate in discussions with the chief audit executive and senior management about the “essential conditions,” described in the Global Internal Audit Standards, which establish the foundation that enables an effective internal audit function.')],
    [t('Approve the internal audit function’s charter, which includes the internal audit mandate and the scope and types of internal audit services.')],
    [t('Review the internal audit charter '), FREQ(), t(' with the chief audit executive to consider changes affecting the organization, such as the employment of a new chief audit executive or changes in the type, severity, and interdependencies of risks to the organization; and approve the internal audit charter '), CHARTER_FREQ(), t('.')],
    [t('Approve the risk-based internal audit plan.')],
    [t('Approve the internal audit function’s human resources administration and budgets.')],
    [t('Approve the internal audit function’s expenses.')],
    [t('Collaborate with senior management to determine the qualifications and competencies the organization expects in a chief audit executive, as described in the Global Internal Audit Standards.')],
    [t('Authorize the appointment and removal of the chief audit executive.')],
    [t('Approve the remuneration of the chief audit executive.')],
    [t('Review the chief audit executive’s performance.')],
    [t('Receive communications from the chief audit executive about the internal audit function including its performance relative to its plan.')],
    [t('Ensure a quality assurance and improvement program has been established and review the results annually.')],
    [t('Make appropriate inquiries of senior management and the chief audit executive to determine whether scope or resource limitations are inappropriate.')],
  ),

  // ── Chief Audit Executive Roles and Responsibilities ──────────────────────
  h2('Chief Audit Executive Roles and Responsibilities'),

  // Ethics and Professionalism
  h3('Ethics and Professionalism'),
  p(t('The chief audit executive will ensure that internal auditors:')),
  ul(
    [t('Conform with the Global Internal Audit Standards, including the principles of Ethics and Professionalism: integrity, objectivity, competency, due professional care, and confidentiality.')],
    [t('Understand, respect, meet, and contribute to the legitimate and ethical expectations of the organization and be able to recognize conduct that is contrary to those expectations.')],
    [t('Encourage and promote an ethics-based culture in the organization.')],
    [t('Report organizational behavior that is inconsistent with the organization’s ethical expectations, as described in applicable policies and procedures.')],
  ),

  // Objectivity
  h3('Objectivity'),
  p(t('The chief audit executive will ensure that the internal audit function remains free from all conditions that threaten the ability of internal auditors to carry out their responsibilities in an unbiased manner, including matters of engagement selection, scope, procedures, frequency, timing, and communication. If the chief audit executive determines that objectivity may be impaired in fact or appearance, the details of the impairment will be disclosed to appropriate parties.')),
  p(t('Internal auditors will maintain an unbiased mental attitude that allows them to perform engagements objectively such that they believe in their work product, do not compromise quality, and do not subordinate their judgment on audit matters to others, either in fact or appearance.')),
  p(t('Internal auditors will have no direct operational responsibility or authority over any of the activities they review. Accordingly, internal auditors will not implement internal controls, develop procedures, install systems, or engage in other activities that may impair their judgment, including:')),
  ul(
    [t('Assessing specific operations for which they had responsibility within the previous year.')],
    [t('Performing operational duties for '), ORG(), t(' or its affiliates.')],
    [t('Initiating or approving transactions external to the internal audit function.')],
    [t('Directing the activities of any '), ORG(), t(' employee that is not employed by the internal audit function, except to the extent that such employees have been appropriately assigned to internal audit teams or to assist internal auditors.')],
  ),
  p(t('Internal auditors will:')),
  ul(
    [t('Disclose impairments of independence or objectivity, in fact or appearance, to appropriate parties and at least annually, such as the chief audit executive, board, management, or others.')],
    [t('Exhibit professional objectivity in gathering, evaluating, and communicating information.')],
    [t('Make balanced assessments of all available and relevant facts and circumstances.')],
    [t('Take necessary precautions to avoid conflicts of interest, bias, and undue influence.')],
  ),

  // Managing the Internal Audit Function
  h3('Managing the Internal Audit Function'),
  p(t('The chief audit executive has the responsibility to:')),
  ul(
    [t('At least annually, develop a risk-based internal audit plan that considers the input of the board and senior management. Discuss the plan with the board and senior management and submit the plan to the board for review and approval.')],
    [t('Communicate the impact of resource limitations on the internal audit plan to the board and senior management.')],
    [t('Review and adjust the internal audit plan, as necessary, in response to changes in '), ORG(), t('’s business, risks, operations, programs, systems, and controls.')],
    [t('Communicate with the board and senior management if there are significant interim changes to the internal audit plan.')],
    [t('Ensure internal audit engagements are performed, documented, and communicated in accordance with the Global Internal Audit Standards.')],
    [t('Follow up on engagement findings and confirm the implementation of recommendations or action plans and communicate the results of internal audit services to the board and senior management '), FREQ(), t(' and for each engagement as appropriate.')],
    [t('Ensure the internal audit function collectively possesses or obtains the knowledge, skills, and other competencies and qualifications needed to meet the requirements of the Global Internal Audit Standards and fulfill the internal audit mandate.')],
    [t('Identify and consider trends and emerging issues that could impact '), ORG(), t(' and communicate to the board and senior management as appropriate.')],
    [t('Consider emerging trends and successful practices in internal auditing.')],
    [t('Establish and ensure adherence to methodologies designed to guide the internal audit function.')],
    [t('Ensure adherence to '), ORG(), t('’s relevant policies and procedures unless such policies and procedures conflict with the internal audit charter or the Global Internal Audit Standards. Any such conflicts will be resolved or documented and communicated to the board and senior management.')],
    [t('Coordinate activities and consider relying upon the work of other internal and external providers of assurance and advisory services. If the chief audit executive cannot achieve an appropriate level of coordination, the issue must be communicated to senior management and if necessary escalated to the board.')],
  ),

  // Communication with the Board and Senior Management
  h3('Communication with the Board and Senior Management'),
  p(t('The chief audit executive will report '), FREQ(), t(' to the board and senior management regarding:')),
  ul(
    [t('The internal audit function’s mandate.')],
    [t('The internal audit plan and performance relative to its plan.')],
    [t('Internal audit budget.')],
    [t('Significant revisions to the internal audit plan and budget.')],
    [t('Potential impairments to independence, including relevant disclosures as applicable.')],
    [t('Results from the quality assurance and improvement program, which include the internal audit function’s conformance with The IIA’s Global Internal Audit Standards and action plans to address the internal audit function’s deficiencies and opportunities for improvement.')],
    [t('Significant risk exposures and control issues, including fraud risks, governance issues, and other areas of focus for the board.')],
    [t('Results of assurance and advisory services.')],
    [t('Resource requirements.')],
    [t('Management’s responses to risk that the internal audit function determines may be unacceptable or acceptance of a risk that is beyond '), ORG(), t('’s risk appetite.')],
  ),

  // Quality Assurance and Improvement Program
  h3('Quality Assurance and Improvement Program'),
  p(t('The chief audit executive will develop, implement, and maintain a quality assurance and improvement program that covers all aspects of the internal audit function. The program will include external and internal assessments of the internal audit function’s conformance with the Global Internal Audit Standards, as well as performance measurement to assess the internal audit function’s progress toward the achievement of its objectives and promotion of continuous improvement. The program also will assess, if applicable, compliance with laws and/or regulations relevant to internal auditing. Also, if applicable, the assessment will include plans to address the internal audit function’s deficiencies and opportunities for improvement.')),
  p(
    t('Annually, the chief audit executive will communicate with the board and senior management about the internal audit function’s quality assurance and improvement program, including the results of internal assessments (ongoing monitoring and periodic self-assessments) and external assessments. External assessments will be conducted at least once every five years by a qualified, independent assessor or assessment team from outside '), ORG(),
    t('; qualifications must include at least one assessor holding an active Certified Internal Auditor® credential.'),
  ),

  // ── Scope and Types of Internal Audit Services ────────────────────────────
  h2('Scope and Types of Internal Audit Services'),
  p(
    t('The scope of internal audit services covers the entire breadth of the organization, including all '), ORG(),
    t('’s activities, assets, and personnel. [USER’S NOTE: if the internal audit function has an audit universe, it could be referenced here.] The scope of internal audit activities also encompasses but is not limited to objective examinations of evidence to provide independent assurance and advisory services to the board and management on the adequacy and effectiveness of governance, risk management, and control processes for '), ORG(), t('.'),
  ),
  p(t('The nature and scope of advisory services may be agreed with the party requesting the service, provided the internal audit function does not assume management responsibility. Opportunities for improving the efficiency of governance, risk management, and control processes may be identified during advisory engagements. These opportunities will be communicated to the appropriate level of management.')),
  p(t('[USER’S NOTE: The list of examples below should be customized to the scope of services agreed upon with the organization’s board and senior management. See Guide to Customizing the Model Internal Audit Charter for more information.]')),
  p(t('Internal audit engagements may include evaluating whether:')),
  ul(
    [t('Risks relating to the achievement of '), ORG(), t('’s strategic objectives are appropriately identified and managed.')],
    [t('The actions of '), ORG(), t('’s officers, directors, management, employees, and contractors or other relevant parties comply with '), ORG(), t('’s policies, procedures, and applicable laws, regulations, and governance standards.')],
    [t('The results of operations and programs are consistent with established goals and objectives.')],
    [t('Operations and programs are being carried out effectively and efficiently.')],
    [t('Established processes and systems enable compliance with the policies, procedures, laws, and regulations that could significantly impact '), ORG(), t('.')],
    [t('The integrity of information and the means used to identify, measure, analyze, classify, and report such information is reliable.')],
    [t('Resources and assets are acquired economically, used efficiently and sustainably, and protected adequately.')],
  ),

  // ── Approval and Signatures ────────────────────────────────────────────────
  p(t('Approved by the board at its meeting on '), BOARD_DATE(), t('.')),

  h2('Acknowledgments/Signatures'),
  p(t('_________________________ ______________')),
  p(t('Chief Audit Executive  Date')),
  p(t('_________________________ ______________')),
  p(t('Board Chair  Date')),
  p(t('_________________________ ______________')),
  p(t('Chief Executive Officer  Date')),
];
