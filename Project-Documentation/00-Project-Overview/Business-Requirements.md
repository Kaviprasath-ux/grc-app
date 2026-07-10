# Business Requirements Document — testgrc 2025

> **Document Type:** Business Requirements Document (BRD)
> **Audience:** Business Analysts, Project Managers, Executive Sponsors, Compliance Officers
> **Purpose:** Defines what the system must do, from a business perspective, without prescribing technical solutions

---

## 1. Business Context

### 1.1 The Regulatory Landscape

Organizations across all industries face a growing body of compliance obligations. In 2025, the regulatory environment is characterized by:

- **Volume** — A mid-size multinational may face 50+ distinct regulatory obligations
- **Overlap** — Multiple regulations cover the same topic (data protection appears in GDPR, CCPA, HIPAA, ISO 27001, and SOC 2 simultaneously)
- **Change** — Regulations change frequently; compliance status can shift overnight when new rules take effect
- **Consequences** — Penalties for non-compliance are significant: GDPR fines can reach 4% of global annual turnover; SOC 2 failures can end vendor relationships worth millions

The traditional response to this complexity — manual spreadsheet tracking — fails at scale. Organizations with mature compliance programs cannot manage them without purpose-built software.

### 1.2 The Market Need

**testgrc 2025** targets organizations that:

1. Are too large to manage compliance manually (more than ~50 employees or ~$5M in revenue)
2. Are too small to afford large enterprise GRC platforms (which cost $100,000+ per year)
3. Operate in regulated industries (financial services, healthcare, technology, government)
4. Require multilingual capability (operating in non-English-speaking markets)
5. Need integrated risk, compliance, and audit management in one system

### 1.3 Regulatory Drivers by Industry

| Industry              | Key Regulations                          | Primary GRC Concern               |
|-----------------------|------------------------------------------|-----------------------------------|
| Financial Services    | Basel III, SOX, PCI-DSS, MiFID II        | Financial controls, fraud risk    |
| Healthcare            | HIPAA, HL7, HITECH, local health laws    | Patient data privacy              |
| Technology / SaaS     | SOC 2, ISO 27001, GDPR, CCPA            | Security and data privacy         |
| Retail / E-commerce   | PCI-DSS, GDPR, consumer protection laws | Payment security, data privacy    |
| Government / Public   | FISMA, FedRAMP, local regulations        | Data sovereignty, integrity       |
| Banking               | Basel, local central bank rules, AML     | Credit risk, operational risk     |

---

## 2. Stakeholder Roles and Their Needs

### 2.1 Primary Stakeholders

A **stakeholder** is anyone whose needs the system must satisfy. The following stakeholders were identified during requirements gathering:

---

**Chief Executive Officer (CEO) / Board of Directors**

*What they need from GRC:*
- Assurance that the organization is not exposed to catastrophic risk
- Confidence that regulatory compliance is maintained
- Evidence for board-level reporting and external audit readiness

*How the system serves them:*
- Dashboard showing organization-wide risk posture
- Compliance percentage trends over time
- Exception reports (things that are not compliant and why)

---

**Chief Risk Officer (CRO) / Risk Manager**

*What they need from GRC:*
- A single, authoritative risk register for the entire organization
- Consistent risk scoring methodology applied across all departments
- Ability to track risk treatment progress over time
- Reports for regulatory submissions

*How the system serves them:*
- Risk Register module with scoring, categorization, and treatment tracking
- Risk heat maps and dashboards
- Linkage between risks and the controls that mitigate them

---

**Compliance Officer / Compliance Manager**

*What they need from GRC:*
- Tracking of all applicable regulatory requirements
- Evidence that each requirement is met
- Alerts when evidence expires or reviews are due
- Multi-framework support (one control mapped to many regulations)

*How the system serves them:*
- Compliance module with framework management
- Control library linked to frameworks
- Evidence collection with expiry tracking
- Exception management for approved deviations

---

**Internal Audit Team (Head, Manager, Auditor)**

*What they need from GRC:*
- Structured methodology for planning, executing, and reporting audits
- Assignment of work to individual auditors
- Secure working papers and evidence storage
- Professional, formatted audit reports
- Tracking of all findings and corrective actions

*How the system serves them:*
- Full Internal Audit module
- Role-based permissions (Auditor cannot approve their own findings)
- PDF report generation
- CAPA (Corrective and Preventive Actions) tracking

---

**Auditee (Department Manager / Employee Subject to Audit)**

*What they need from GRC:*
- Visibility into findings that relate to their area
- Ability to respond formally to findings
- Tracking of corrective actions they are responsible for
- Notifications of due dates

*How the system serves them:*
- Limited access to their own findings and CAPAs
- Automated email reminders for due items

---

**IT / Security Team**

*What they need from GRC:*
- Asset inventory linked to security controls
- Ability to submit technical evidence (screenshots, configurations)
- Visibility into which controls are their responsibility

*How the system serves them:*
- Asset Management module
- Technical Evidence module
- Evidence attachment to compliance controls

---

**Third-Party / Vendor (External)**

*What they need from GRC:*
- A clear process for completing security questionnaires
- Visibility into their assessment status

*How the system serves them:*
- TPRM portal (email-based questionnaire distribution)
- Automated notifications

---

**System Administrator (GRCAdministrator / CustomerAdministrator)**

*What they need from GRC:*
- User management (create, edit, deactivate users)
- Framework and control library configuration
- System configuration and health monitoring

*How the system serves them:*
- Full administrative access
- User management screens
- Configuration panels

---

## 3. Functional Requirements

**Functional requirements** describe specific things the system must do. Each requirement is stated as a capability.

### 3.1 Organization Module

| ID    | Requirement                                                                                         |
|-------|-----------------------------------------------------------------------------------------------------|
| ORG-1 | The system shall allow administrators to configure the organization's name, industry, size, and regulatory profile |
| ORG-2 | The system shall support an organizational chart with departments and reporting lines              |
| ORG-3 | The system shall maintain a business process inventory with process owners                         |
| ORG-4 | The system shall support Business Impact Analysis (BIA) — rating each process by criticality       |
| ORG-5 | The system shall maintain a stakeholder register with contact information and roles               |
| ORG-6 | Changes to organizational structure shall be tracked with timestamps and the name of the user who made the change |

### 3.2 Compliance Module

| ID     | Requirement                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| COM-1  | The system shall maintain a library of compliance frameworks (ISO 27001, SOC 2, GDPR, PCI-DSS, NIST, and others) |
| COM-2  | The system shall support a control library where each control can be mapped to multiple frameworks  |
| COM-3  | The system shall track the implementation status of each control                                    |
| COM-4  | The system shall allow evidence documents to be uploaded and linked to specific controls            |
| COM-5  | Evidence items shall have expiry dates with automated reminders before expiry                       |
| COM-6  | The system shall support governance documents (policies, procedures, standards) with version control |
| COM-7  | The system shall allow exceptions to be granted with documented justification, approver, and expiry  |
| COM-8  | The system shall calculate and display a compliance percentage for each framework                    |
| COM-9  | The system shall support Key Performance Indicators (KPIs) for measuring compliance health          |
| COM-10 | The system shall generate compliance reports exportable to PDF                                      |

### 3.3 Risk Management Module

| ID     | Requirement                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| RSK-1  | The system shall maintain a centralized risk register for the organization                          |
| RSK-2  | Each risk shall have: name, description, category, owner, likelihood score, impact score, and risk level |
| RSK-3  | The system shall calculate risk scores as a function of likelihood and impact                        |
| RSK-4  | Risks shall be categorized (strategic, operational, financial, reputational, compliance, etc.)      |
| RSK-5  | The system shall support risk treatment plans (mitigate, accept, transfer, avoid)                   |
| RSK-6  | Risks shall be linkable to specific controls in the compliance module                               |
| RSK-7  | The system shall support a Risk Control Matrix showing which controls mitigate which risks          |
| RSK-8  | The system shall display a risk heat map (likelihood vs. impact grid)                               |
| RSK-9  | Risk assessments shall be tracked historically — previous scores shall not be deleted               |
| RSK-10 | The system shall support strategic risk planning aligned to organizational objectives                |

### 3.4 Asset Management Module

| ID    | Requirement                                                                                          |
|-------|------------------------------------------------------------------------------------------------------|
| AST-1 | The system shall maintain an inventory of all organizational assets                                  |
| AST-2 | Asset types shall include: hardware, software, data, people, facilities, and services               |
| AST-3 | Each asset shall have: name, type, owner, custodian, classification, and location                   |
| AST-4 | Assets shall be classified by Confidentiality, Integrity, and Availability (CIA triad)              |
| AST-5 | Assets shall be linkable to risks in the Risk Management module                                     |
| AST-6 | Assets shall be linkable to controls in the Compliance module                                       |

### 3.5 Internal Audit Module

| ID     | Requirement                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| AUD-1  | The system shall maintain an Audit Universe — a registry of all auditable areas                     |
| AUD-2  | The system shall maintain an Audit Charter documenting the mandate and authority of the audit function |
| AUD-3  | The system shall support annual audit planning — selecting which audits to conduct in the coming year |
| AUD-4  | The system shall manage audit engagements from planning through fieldwork to report                  |
| AUD-5  | Fieldwork shall support working paper creation, evidence attachment, and observation recording      |
| AUD-6  | The system shall manage audit findings with severity classification and recommendations              |
| AUD-7  | The system shall track CAPA (Corrective and Preventive Actions) with deadlines and responsible parties |
| AUD-8  | The system shall enforce separation of duties — an auditor cannot approve their own work            |
| AUD-9  | The system shall generate formal audit reports in PDF format                                        |
| AUD-10 | The system shall maintain an immutable audit trail (activity log) for all actions in the module     |
| AUD-11 | Auditors shall declare their independence and objectivity before each engagement                    |
| AUD-12 | The system shall send automated reminders for CAPA due dates                                        |

### 3.6 TPRM Module (Third-Party Risk Management)

| ID      | Requirement                                                                                         |
|---------|-----------------------------------------------------------------------------------------------------|
| TPR-1   | The system shall maintain a register of all third-party vendors and suppliers                      |
| TPR-2   | The system shall support due-diligence questionnaires that can be sent to vendors                  |
| TPR-3   | Questionnaire responses shall be scored and risk-rated automatically                               |
| TPR-4   | The system shall track vendor contracts and renewal dates                                          |
| TPR-5   | The system shall send automated email notifications to vendors for assessments due                  |
| TPR-6   | Vendor risk assessments shall be reviewed on a scheduled basis                                     |

### 3.7 Dashboard Module

| ID    | Requirement                                                                                          |
|-------|------------------------------------------------------------------------------------------------------|
| DSH-1 | The system shall provide a real-time dashboard visible to all authorized users                      |
| DSH-2 | The dashboard shall display: overall compliance %, risk score summary, open findings count, CAPA status |
| DSH-3 | The dashboard shall respect role-based permissions — users see only data relevant to their role     |
| DSH-4 | Charts shall include: risk heat map, compliance by framework, audit status, evidence expiry timeline |

---

## 4. Non-Functional Requirements

**Non-functional requirements** describe HOW the system must behave — not what it must do, but its qualities.

### 4.1 Security

| ID    | Requirement                                                                            |
|-------|----------------------------------------------------------------------------------------|
| SEC-1 | All data in transit shall be encrypted using TLS 1.2 or higher                        |
| SEC-2 | File data stored in the database shall be encrypted using AES-256-GCM                 |
| SEC-3 | All API endpoints shall require authentication except login and password reset         |
| SEC-4 | Every API endpoint shall enforce RBAC — users cannot access data outside their permissions |
| SEC-5 | The system shall maintain a tamper-evident audit log of all significant actions        |
| SEC-6 | Passwords shall be hashed using a strong algorithm (bcrypt)                            |
| SEC-7 | Sessions shall expire after a configurable inactivity timeout                          |
| SEC-8 | The encryption key shall never be stored in the database alongside the encrypted data  |

### 4.2 Performance

| ID    | Requirement                                                                            |
|-------|----------------------------------------------------------------------------------------|
| PER-1 | Pages shall load in under 3 seconds under normal load (< 100 concurrent users)        |
| PER-2 | API responses shall complete in under 500ms for 95% of requests                       |
| PER-3 | File uploads up to 50MB shall be supported                                             |
| PER-4 | The database shall support organizations with up to 10,000 records per model          |

### 4.3 Scalability

| ID    | Requirement                                                                            |
|-------|----------------------------------------------------------------------------------------|
| SCA-1 | The system shall support at least 50 concurrent customer organizations (tenants)       |
| SCA-2 | Adding a new customer shall not require application restart or code changes            |
| SCA-3 | The database schema shall be designed to scale horizontally                            |

### 4.4 Internationalization (i18n)

| ID    | Requirement                                                                            |
|-------|----------------------------------------------------------------------------------------|
| I18-1 | The entire user interface shall be available in English, Arabic, and Latvian           |
| I18-2 | Arabic shall be displayed with a full right-to-left (RTL) layout                      |
| I18-3 | User-entered text (risk names, control descriptions, etc.) shall be auto-translated   |
| I18-4 | Users shall be able to switch languages at any time without losing their work          |
| I18-5 | Dates and numbers shall be formatted according to locale conventions                   |

### 4.5 Accessibility

| ID    | Requirement                                                                            |
|-------|----------------------------------------------------------------------------------------|
| ACC-1 | The application shall meet WCAG 2.1 Level AA standards                                |
| ACC-2 | All form fields shall have labels accessible to screen readers                         |
| ACC-3 | Color shall not be the only means of conveying information (e.g., status)              |
| ACC-4 | The application shall be navigable using keyboard only                                 |

### 4.6 Reliability and Availability

| ID    | Requirement                                                                            |
|-------|----------------------------------------------------------------------------------------|
| REL-1 | The system shall achieve 99.5% uptime during business hours                            |
| REL-2 | Scheduled maintenance windows shall not exceed 2 hours per month                      |
| REL-3 | Data shall be backed up at least daily with retention of at least 30 days              |
| REL-4 | Recovery Time Objective (RTO): system restoration within 4 hours of failure           |
| REL-5 | Recovery Point Objective (RPO): no more than 1 hour of data loss in a disaster        |

### 4.7 Usability

| ID    | Requirement                                                                            |
|-------|----------------------------------------------------------------------------------------|
| USA-1 | A new user with GRC knowledge but no software training shall accomplish basic tasks without help |
| USA-2 | The application shall display meaningful error messages (not technical error codes)    |
| USA-3 | All forms shall validate input and show validation errors before submission             |
| USA-4 | Destructive actions (delete) shall require a confirmation step                         |

---

## 5. Compliance Standards Supported

The application is designed to help organizations achieve and maintain compliance with the following standards. Each standard is briefly explained:

### ISO 27001

**What it is:** An international standard for information security management systems (ISMS). Published by the International Organization for Standardization.

**Who needs it:** Technology companies, financial institutions, any organization handling sensitive information.

**What it requires:** Organizations must identify their information assets, assess the risks to those assets, implement appropriate controls, and continuously monitor and improve their security posture.

**How the application supports it:** The Compliance module includes the full ISO 27001 control set. Organizations map their existing controls to ISO requirements, collect evidence, and track compliance percentage.

---

### SOC 2 (System and Organization Controls 2)

**What it is:** An auditing procedure developed by the American Institute of CPAs (AICPA). Evaluates whether a service organization's controls around security, availability, processing integrity, confidentiality, and privacy are properly designed and operating effectively.

**Who needs it:** Any SaaS company or technology service provider whose customers ask for security assurance.

**What it requires:** Organizations must demonstrate controls over five "Trust Services Criteria." External auditors conduct a SOC 2 audit and issue a report.

**How the application supports it:** Controls can be mapped to SOC 2 criteria, evidence is collected and stored, and the system generates audit-ready documentation.

---

### GDPR (General Data Protection Regulation)

**What it is:** European Union regulation that protects the personal data of EU residents. In effect since May 2018.

**Who needs it:** Any organization that processes the personal data of EU residents, regardless of where the organization is located.

**What it requires:** Organizations must have legal basis to process data, must respond to subject access requests, must report data breaches within 72 hours, must implement privacy by design, and more.

**How the application supports it:** Data processing activity records, risk assessments, and evidence collection for privacy controls.

---

### PCI-DSS (Payment Card Industry Data Security Standard)

**What it is:** A security standard for organizations that handle credit card data. Maintained by the PCI Security Standards Council.

**Who needs it:** Any organization that processes, stores, or transmits credit card data.

**What it requires:** 12 high-level requirements covering network security, access control, vulnerability management, and monitoring.

**How the application supports it:** Control library with PCI-DSS requirements, evidence collection for quarterly and annual assessments.

---

### NIST Cybersecurity Framework (CSF)

**What it is:** A framework published by the US National Institute of Standards and Technology for managing cybersecurity risk. Widely used in the United States.

**Who needs it:** US government contractors, critical infrastructure operators, and any organization seeking a comprehensive cybersecurity framework.

**What it requires:** Organizations identify, protect, detect, respond, and recover (the five NIST functions).

**How the application supports it:** Controls mapped to NIST functions, risk management aligned to NIST categories.

---

## 6. Multi-Tenant Requirements

Multi-tenancy is a critical architectural requirement. This section defines what it must guarantee:

| ID     | Requirement                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| MT-1   | Data belonging to Customer A shall never be accessible to Customer B under any circumstances        |
| MT-2   | A GRCAdministrator shall be able to view any customer's data for support purposes                   |
| MT-3   | Customer accounts shall be fully independent — one customer's configuration shall not affect another |
| MT-4   | Customer administrators shall be able to create users only within their own organization            |
| MT-5   | New customers shall be onboardable without code changes or database migrations                      |
| MT-6   | Usage by one customer (large data volume, heavy activity) shall not degrade performance for others  |

---

## 7. Audit Trail and Immutability Requirements

The audit trail is one of the most critical requirements. External auditors and regulators rely on it.

| ID     | Requirement                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| ATR-1  | Every create, update, and delete operation on significant records shall be logged                   |
| ATR-2  | The audit log shall record: timestamp (UTC), user identity, action performed, and affected record   |
| ATR-3  | Audit log records shall be immutable — they cannot be edited or deleted by any user, including admins |
| ATR-4  | Audit log entries shall be queryable by date range, user, and record type                           |
| ATR-5  | The audit log shall be retained for a minimum of 7 years                                            |
| ATR-6  | Administrators shall not be able to delete their own audit log entries                              |

---

## 8. Email Notification Requirements

| ID     | Requirement                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| EML-1  | The system shall send email notifications for all significant events (assignment, due dates, approvals) |
| EML-2  | The system shall support at least 65 distinct email notification types                              |
| EML-3  | Emails shall be sent using HTML templates with the organization's branding                          |
| EML-4  | Users shall be able to control which notifications they receive (notification preferences)          |
| EML-5  | Email sending failures shall be logged and retried                                                  |
| EML-6  | Due-date reminders shall be automated — no manual action required from users                        |

---

## 9. Acceptance Criteria Summary

The system shall be considered ready for production when:

1. All functional requirements in Section 3 are implemented and verified by QA testing
2. All non-functional requirements in Section 4 are verified (performance testing, security testing, accessibility audit)
3. The system passes end-to-end (E2E) tests covering all 10 modules
4. A security penetration test has been conducted with no Critical or High findings outstanding
5. The application successfully completes a mock ISO 27001 audit using data entered into the system
6. All three languages (English, Arabic, Latvian) are verified functional
7. The multi-tenant isolation test confirms Customer A cannot access Customer B's data

---

*Related documents: `Architecture-Overview.md` (how requirements are implemented), `08-Features/` (detailed module functionality)*
