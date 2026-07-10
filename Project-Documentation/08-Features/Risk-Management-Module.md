# Risk Management Module

## Table of Contents

1. [What is Risk Management?](#what-is-risk-management)
2. [The Risk Lifecycle](#the-risk-lifecycle)
3. [Risk Scoring Matrix](#risk-scoring-matrix)
4. [Inherent vs Residual vs Target Risk](#inherent-vs-residual-vs-target-risk)
5. [Risk Register](#risk-register)
6. [Risk Taxonomy](#risk-taxonomy)
7. [Risk Assessment](#risk-assessment)
8. [Risk Response Strategies](#risk-response-strategies)
9. [Risk-Control Matrix](#risk-control-matrix)
10. [Dashboard and Visualisation](#dashboard-and-visualisation)
11. [Import and Export](#import-and-export)
12. [Integration with Internal Audit](#integration-with-internal-audit)
13. [Reports and Analytics](#reports-and-analytics)

---

## What is Risk Management?

**Risk management** is the systematic process of identifying, assessing, responding to, and monitoring potential events that could negatively impact an organisation's ability to achieve its objectives.

The international standard for risk management is **ISO 31000:2018 — Risk Management: Guidelines**, which defines:

> **Risk:** The effect of uncertainty on objectives.

This definition is deliberately broad. Risk is not just about bad things — uncertainty can sometimes lead to better-than-expected outcomes (upside risk). However, in GRC contexts, risk management primarily focuses on **downside risk**: events that could cause harm.

### Why Risk Management Matters

| Business Objective | Risk Consequence If Not Managed |
|-------------------|--------------------------------|
| Protect customer data | Data breach, regulatory fines, reputational damage |
| Ensure system availability | Downtime, lost revenue, SLA penalties |
| Maintain regulatory compliance | Fines, licence revocation, legal action |
| Achieve financial targets | Fraud, errors, cost overruns |
| Protect physical assets | Theft, damage, business interruption |

### ISO 31000 Key Principles

1. **Integrated** — Risk management is part of all organisational activities, not a separate function.
2. **Structured and comprehensive** — A systematic approach produces comparable and reliable results.
3. **Customised** — Risk management is tailored to the organisation's context and objectives.
4. **Inclusive** — Stakeholder participation improves risk awareness and the quality of assessment.
5. **Dynamic** — Risk management anticipates, detects, and responds to changes.
6. **Best available information** — Based on historical data, expert judgement, and stakeholder feedback.
7. **Human and cultural factors** — Behaviour and culture significantly influence risk management.
8. **Continual improvement** — Risk management is continuously improved through learning and experience.

---

## The Risk Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        RISK LIFECYCLE                           │
│                                                                 │
│   IDENTIFY → ASSESS → RESPOND → MONITOR → REPORT               │
│      ↑                                         │               │
│      └─────────────────────────────────────────┘               │
│                    (continuous cycle)                           │
└─────────────────────────────────────────────────────────────────┘
```

### Identify

Discover and document risks before they materialise. Sources of risk identification:
- Business process mapping (where could things go wrong?)
- Industry threat intelligence (what are peers experiencing?)
- Past incidents and near-misses
- Internal audit findings
- Employee brainstorming workshops
- Regulatory change monitoring

**Output:** New risk entries in the Risk Register.

### Assess

Evaluate the likelihood and impact of each identified risk:
- **Inherent risk** — the raw risk level before any controls are applied.
- **Control effectiveness** — how well current controls reduce the risk.
- **Residual risk** — the remaining risk after controls are considered.

**Output:** Risk scores, risk ratings (Critical/High/Medium/Low), and prioritised list.

### Respond

Decide what to do about each risk. The four response strategies (explained in detail below) are: Accept, Mitigate, Transfer, Avoid.

**Output:** Risk response plans, control implementations, insurance policies, process changes.

### Monitor

Track risk levels over time and ensure response actions are being implemented:
- Regular risk reassessments (cadence: monthly/quarterly/annual per risk).
- KRI (Key Risk Indicator) monitoring.
- Control effectiveness testing (links to Compliance module).
- Escalation of deteriorating risks.

**Output:** Updated risk scores, trend data, escalation alerts.

### Report

Communicate risk posture to decision-makers:
- Risk dashboard for operational management.
- Risk heat maps for executive management.
- Board-level risk summaries.

---

## Risk Scoring Matrix

The GRC application uses a **likelihood × impact** matrix to calculate risk scores.

### Default 5×5 Matrix

|  | **1 — Negligible** | **2 — Minor** | **3 — Moderate** | **4 — Major** | **5 — Critical** |
|---|---|---|---|---|---|
| **5 — Almost Certain** | 5 | 10 | 15 | 20 | **25** |
| **4 — Likely** | 4 | 8 | 12 | **16** | **20** |
| **3 — Possible** | 3 | 6 | **9** | 12 | 15 |
| **2 — Unlikely** | 2 | 4 | 6 | 8 | 10 |
| **1 — Rare** | 1 | 2 | 3 | 4 | 5 |

**Risk Score = Likelihood Rating × Impact Rating**

### Risk Rating Bands (configurable per tenant)

| Score Range | Rating | Colour |
|------------|--------|--------|
| 20–25 | Critical | Red |
| 12–19 | High | Orange |
| 6–11 | Medium | Yellow |
| 1–5 | Low | Green |

### Customising the Scoring Matrix

The scoring matrix is fully configurable via master data:
- **Likelihood levels:** `src/app/api/internal-audit/probability/` — add/rename/reorder levels.
- **Impact ratings:** `src/app/api/impact-ratings/` — configure impact descriptors.
- **Scoring ranges:** `src/app/api/internal-audit/scoring-ranges/` — set the numeric bands.

This allows the matrix to be tailored to the organisation's risk appetite and scale (e.g., financial materiality thresholds, life-safety impact definitions).

---

## Inherent vs Residual vs Target Risk

### Inherent Risk

**Inherent risk** is the level of risk that exists **before** any controls, processes, or other risk responses are applied. It represents the "raw" exposure.

Example: A financial institution processes wire transfers. The inherent risk of fraud is Very High (Likely × Major = 16) because wire fraud is common and the financial impact is significant.

**Where it lives:** `Risk.inherentLikelihood`, `Risk.inherentImpact`, `Risk.inherentScore`

### Residual Risk

**Residual risk** is the level of risk that **remains after** existing controls are applied. If the financial institution has dual approval controls, reconciliation processes, and fraud detection software, those controls reduce the likelihood of fraud.

Residual risk = Inherent risk reduced by control effectiveness.

Example: After controls, fraud risk might reduce to Unlikely × Major = 8 (Medium).

**Where it lives:** `Risk.residualLikelihood`, `Risk.residualImpact`, `Risk.residualScore`

### Target Risk

**Target risk** is the risk level the organisation **wants to achieve** through its risk response plan. It reflects risk appetite — how much risk is acceptable.

Example: The organisation's risk appetite for fraud is Low (score ≤ 5). Current residual score is 8 (Medium). The gap (8 → 5) drives the risk response plan to implement additional controls.

**Where it lives:** `Risk.targetLikelihood`, `Risk.targetImpact`, `Risk.targetScore`

### The Three Scores on the Dashboard

The risk dashboard shows all three scores side by side for each risk, making it easy to see:
- How much risk has been reduced by controls (inherent → residual gap).
- How much more reduction is needed (residual → target gap).

---

## Risk Register

The Risk Register is the central database of all identified risks for the organisation.

**URL:** `/risks`

### Risk Record Fields

| Field | Description |
|-------|-------------|
| Risk Code | Auto-generated unique identifier (e.g., RSK-0042) |
| Name | Short, descriptive name |
| Description | Full description of the risk event |
| Category | Risk category (e.g., Operational, Financial, Strategic, Compliance) |
| Type | Risk type (sub-classification within category) |
| Threat | What threat actor or event triggers the risk |
| Vulnerability | What weakness makes the risk possible |
| Cause | Root cause |
| Department | Owning department |
| Owner | Responsible user (risk owner) |
| Inherent Likelihood | 1–5 scale |
| Inherent Impact | 1–5 scale |
| Inherent Score | Calculated (Likelihood × Impact) |
| Residual Likelihood | After current controls |
| Residual Impact | After current controls |
| Residual Score | Calculated |
| Target Likelihood | Target state |
| Target Impact | Target state |
| Target Score | Calculated |
| Response Strategy | Accept / Mitigate / Transfer / Avoid |
| Status | Open / Under Treatment / Closed / Accepted |
| Next Assessment Date | When the risk must be reassessed |
| Assets at Risk | Linked assets (from Asset module) |

### Risk Register Views

- **Table view** — sortable/filterable list of all risks.
- **Heat map view** — visual grid showing all risks positioned by likelihood and impact.
- **By category** — grouped view showing risks per category.
- **By department** — grouped by owning department.
- **My risks** — filtered to show only risks owned by the logged-in user.

**API:** `GET/POST /api/risks`

---

## Risk Taxonomy

### Risk Categories

The highest-level grouping. Configurable per tenant. Common categories:
- **Operational** — process failures, human error, system outages.
- **Financial** — fraud, miscalculation, liquidity issues.
- **Strategic** — wrong decisions, competitive threats, market changes.
- **Compliance** — regulatory fines, legal liability.
- **Reputational** — brand damage, media exposure.
- **Technology/IT** — cyberattacks, data breaches, system failures.
- **Environmental** — natural disasters, climate-related disruptions.

### Risk Types

Sub-categories within each category. Example (within IT):
- Cybersecurity threats
- Software vulnerabilities
- Hardware failure
- Third-party technology failure
- Data corruption

### Threats and Vulnerabilities

**Threat:** An event or actor that could exploit a vulnerability. Examples:
- Phishing email (threat) exploits lack of security training (vulnerability).
- Ransomware (threat) exploits unpatched systems (vulnerability).
- Disgruntled employee (threat) exploits excessive access rights (vulnerability).

**Vulnerability:** A weakness in a process, control, or system. Examples:
- No multi-factor authentication.
- Outdated software versions.
- Inadequate segregation of duties.

Separating threats from vulnerabilities helps identify root causes and design better controls.

---

## Risk Assessment

A **Risk Assessment** is a formal, periodic review of a risk's current score. Unlike ad hoc updates to the risk register, assessments create a dated snapshot that builds a trend history.

**URL:** `/risks/assessments`

### Assessment Process

1. System triggers a reassessment when `nextAssessmentDate` arrives (via the `cadence-reassessment` cron job).
2. Risk owner receives a notification that reassessment is due.
3. Owner reviews current likelihood and impact, considering:
   - Changes in the control environment.
   - New threat intelligence.
   - Changes in business context.
4. Owner updates scores and saves the assessment.
5. The previous scores become historical data for trend analysis.

### Assessment Cadence

Configurable per risk based on risk level:
- **Critical risks:** Monthly reassessment.
- **High risks:** Quarterly.
- **Medium risks:** Semi-annual.
- **Low risks:** Annual.

**API:** `GET/POST /api/risks/[id]/assessments`

---

## Risk Response Strategies

When a risk is assessed, the risk owner must choose a response strategy.

### Accept

**Definition:** The organisation acknowledges the risk and decides to do nothing about it, accepting that the potential loss will occur.

**When to use:**
- The cost of mitigation exceeds the potential loss.
- The residual risk is already within the organisation's risk appetite.
- The risk cannot be mitigated within reasonable cost or timeframe.

**Documentation required:** Formal acceptance signed by an appropriate authority (e.g., CISO for IT risks, CFO for financial risks). Includes justification and review date.

**Risk Register indicator:** `Status: Accepted`

### Mitigate

**Definition:** Implement controls to reduce the likelihood or impact of the risk to an acceptable level.

**When to use:**
- The residual risk is above the target risk (risk appetite gap).
- Cost-effective controls exist.
- The risk is in an area critical to the organisation's operations.

**How it works in the system:**
1. A `RiskResponse` record is created with the mitigation actions.
2. `RiskPlannedControl` records define specific controls to be implemented.
3. As controls are implemented, the residual risk score is updated.
4. The system tracks implementation progress via the Risk-Control Matrix.

### Transfer

**Definition:** Shift the financial consequence of the risk to a third party.

**Examples:**
- Purchase cyber liability insurance to transfer financial risk of a data breach.
- Outsource a high-risk process to a specialist vendor (with appropriate contractual protections).
- Enter a contractual indemnity with a partner.

**Limitation:** Risk transfer does not eliminate the reputational or operational consequences — only the financial ones. Insurance covers the cost of a breach but not the breach itself.

**Documentation required:** Insurance policy details, contractual provisions, coverage limits, and renewal dates (tracked in TPRM module for vendor contracts).

### Avoid

**Definition:** Eliminate the risk entirely by not engaging in the risky activity.

**Examples:**
- Cancel a project that introduces unacceptable cybersecurity risks.
- Exit a business line with regulatory exposure the organisation cannot manage.
- Decide not to process certain categories of personal data.

**When to use:**
- The risk level is unacceptable and cannot be reduced to within appetite.
- The business benefit does not justify the risk exposure.

**Trade-off:** Avoiding a risk often means forgoing an opportunity. This decision requires executive sign-off.

---

## Risk-Control Matrix

The Risk-Control Matrix (RCM) maps risks to the controls that mitigate them.

**URL:** `/risks/matrix`

### What the RCM Shows

A grid where:
- **Rows** = Risks
- **Columns** = Controls
- **Cells** = Relationship between a risk and a control (does this control mitigate this risk?)

Each relationship has a strength indicator:
- **Primary** — This is the main control designed specifically for this risk.
- **Secondary** — This control partially mitigates the risk as a by-product.
- **Compensating** — Substitute control used when the primary control is not available.

### Using the RCM for Control Gap Analysis

The RCM immediately highlights:
- **Risks with no controls** — Unmitigated risks that need urgent attention.
- **Controls mitigating no risks** — Potentially redundant controls that waste resources.
- **Single points of failure** — Risks with only one control (no defence-in-depth).

### Integration with Compliance Module

When a compliance control (from the Compliance module) is linked to a risk in the RCM, improvements in the control's maturity score automatically reduce the residual risk score. This creates a bidirectional link between compliance and risk management.

**API:** `GET/POST /api/risks/[id]/controls`

---

## Dashboard and Visualisation

**URL:** `/risks/dashboard`

### Risk Heat Map

A visual 5×5 grid plotting all risks by likelihood (vertical axis) and impact (horizontal axis). Risks are shown as numbered dots or labels positioned in the grid cell matching their scores.

- **Bottom-left quadrant** — Low likelihood, low impact (Green). Monitor.
- **Top-right quadrant** — High likelihood, high impact (Red). Immediate action required.
- **Clicking a dot** opens the risk detail panel.

The heat map can toggle between showing:
- **Inherent risk** positions (before controls)
- **Residual risk** positions (after controls)

This comparison visually demonstrates the value of the control environment.

### Trend Charts

Line charts showing how the risk portfolio has evolved:
- Average residual risk score over time.
- Count of Critical/High/Medium/Low risks per period.
- Risk velocity (how quickly risks are being treated).

### Risk by Category

Doughnut or bar charts showing risk distribution across categories. Highlights which domains have the most risk concentration.

---

## Import and Export

### Importing Risks

**URL:** `POST /api/risks/import`

Supports bulk import from Excel/CSV files. Template columns:
- Name, Description, Category, Type, Department, Owner Email
- Inherent Likelihood (1–5), Inherent Impact (1–5)
- Response Strategy
- Notes

The importer:
1. Validates all rows for required fields and valid values.
2. Looks up users by email to assign ownership.
3. Creates risk records with calculated inherent scores.
4. Returns a summary: records created, skipped, errors.

### Exporting Risks

**URL:** `GET /api/risks/export`

Exports the full risk register to Excel/CSV. Includes all fields, current scores, response strategies, and linked controls count. Useful for:
- Board reporting.
- Regulatory submissions.
- Offline analysis.
- Migration to/from other systems.

**Query parameters:**
- `format=csv` or `format=xlsx`
- `category=Operational` — filter by category
- `status=Open` — filter by status
- `rating=High` — filter by current risk rating

---

## Integration with Internal Audit

Risk management and internal audit are deeply integrated in the GRC application.

### Risk-Based Audit Planning

The **Internal Audit Risk Universe** is populated from risks in the risk register. The AuditHead can:
1. View the risk universe to identify the highest-risk areas.
2. Prioritise the strategic audit plan to focus on high-risk auditable entities.
3. See which risks have been addressed by past audits and which have not.

### Audit Findings → New Risks

When an internal audit finding reveals a previously unknown risk (e.g., "vendor is not performing background checks"), the auditor can:
1. Create a new risk in the Risk Register directly from the finding record.
2. Link the finding as evidence of the risk's existence.
3. The CAPA for the finding automatically becomes the risk response action.

### Control Testing → Residual Risk Update

When internal audit tests a control and finds it operating effectively, the risk owner can use this as evidence to maintain or improve the control's effectiveness rating. If audit finds a control is not operating, the residual risk score may need to increase, triggering reassessment and escalation.

---

## Reports and Analytics

### Risk Register Report

A full export of all risks with current scores, response strategies, and open action items. Formatted for Audit Committee or Board presentation.

### Risk Trend Report

Charts showing how the risk profile has changed over time:
- Were risks closed faster or slower than last quarter?
- Are new risks being identified at a higher or lower rate?
- Is the overall risk posture improving?

### Risk Heatmap Report

A printable version of the risk heat map, showing both inherent and residual positions side by side. Demonstrates the value of the control environment to senior management.

### Control Effectiveness Report

Cross-module report combining data from Risk (control mappings) and Compliance (control maturity scores):
- Controls with low maturity scores that are primary mitigants of High/Critical risks are flagged as "Critical Control Gaps."

**URL:** `/risks/reports`
