# API Reference

## Table of Contents

1. [How to Read This Reference](#how-to-read-this-reference)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Common Headers](#common-headers)
5. [Pagination](#pagination)
6. [Error Response Format](#error-response-format)
7. [Internal Audit APIs](#internal-audit-apis)
8. [Compliance APIs](#compliance-apis)
9. [Risk Management APIs](#risk-management-apis)
10. [Organisation APIs](#organisation-apis)
11. [Asset Management APIs](#asset-management-apis)
12. [Notification APIs](#notification-apis)
13. [Translation APIs](#translation-apis)
14. [Cron APIs](#cron-apis)
15. [Authentication APIs](#authentication-apis)
16. [Admin APIs](#admin-apis)

---

## How to Read This Reference

Each API endpoint is documented with:

- **Method and path** — the HTTP verb and URL pattern.
- **Description** — what the endpoint does.
- **Auth required** — yes for all protected endpoints; no for cron and auth routes.
- **Request body** — JSON fields accepted (for POST/PATCH).
- **Response** — the JSON structure returned on success.

### Path Parameters

Parameters inside `[brackets]` in the URL are path variables. For example, in `GET /api/risks/[id]`, replace `[id]` with the actual record ID (e.g., `GET /api/risks/clx9z2abc`).

### Optional Fields

Fields marked `?` in response examples are optional and may be absent if the value is null.

---

## Base URL

| Environment | Base URL |
|-------------|---------|
| Local development | `http://localhost:3000` |
| Production (Vercel) | `https://grc-app-ba-testing.vercel.app` |

All API routes begin with `/api/`. The full URL for a route like `/api/risks` is `http://localhost:3000/api/risks` locally.

---

## Authentication

The application uses **NextAuth v5** with **JWT sessions** stored in HTTP-only cookies.

### How Sessions Work

1. User logs in via `POST /api/auth/callback/credentials`.
2. NextAuth creates a signed JWT and sets it as the `next-auth.session-token` cookie.
3. All subsequent API requests must include this cookie.
4. The `withAuth` wrapper in each API route validates the cookie before processing the request.

### Browser Clients (Web Application)

Browsers automatically include cookies in same-origin requests. No special headers are needed when calling APIs from the frontend JavaScript code.

### Programmatic API Calls (Testing/Scripts)

For scripts or tools like `curl`:

```bash
# Step 1: Log in and capture the session cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "superadmin", "password": "1"}'

# Step 2: Use the cookie in subsequent requests
curl -b cookies.txt http://localhost:3000/api/risks
```

### What Happens Without Authentication

All protected endpoints return `401 Unauthorized` with no session:

```json
{
  "error": "Authentication required"
}
```

---

## Common Headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `Content-Type: application/json` | Request | Required for all POST/PATCH requests with JSON body |
| `x-triggered-by: manual` | Request | Use when manually triggering cron endpoints; marks run as "manual" in logs |
| `Authorization: Bearer <CRON_SECRET>` | Request | Required for cron endpoints in production |

---

## Pagination

List endpoints support cursor-based or offset pagination.

### Offset Pagination (most endpoints)

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Records per page (max usually 100) |
| `search` | string | — | Text search across name/title fields |
| `sortBy` | string | `createdAt` | Field to sort by |
| `sortOrder` | `asc` or `desc` | `desc` | Sort direction |

**Example:**
```
GET /api/risks?page=2&limit=20&search=access&sortBy=name&sortOrder=asc
```

**Paginated response shape:**
```json
{
  "risks": [ ... ],
  "total": 147,
  "page": 2,
  "pageSize": 20,
  "totalPages": 8
}
```

---

## Error Response Format

All errors return a consistent structure:

```json
{
  "error": "Human-readable error message"
}
```

Validation errors include field-level details:

```json
{
  "error": "Validation failed",
  "details": {
    "name": ["Name is required"],
    "dueDate": ["Due date must be a future date"]
  }
}
```

---

## Internal Audit APIs

### Audit Universe

---

#### GET /api/internal-audit/audit-universe

Fetch all audit universe data (categories, entities, processes, risks, engagements) for the Organisation Map page.

**Auth required:** Yes (AuditHead, AuditManager, Auditor)

**Response:**
```json
{
  "categories": [
    {
      "id": "clx_cat_001",
      "name": "Finance",
      "description": "Financial operations",
      "auditableEntities": [
        {
          "id": "clx_ent_001",
          "name": "Accounts Payable",
          "riskLevel": "High",
          "lastAuditDate": "2024-09-15T00:00:00.000Z",
          "processCount": 3,
          "riskCount": 5,
          "latestEngagement": {
            "id": "clx_eng_001",
            "status": "In Progress",
            "plannedHours": 80,
            "actualHours": 65
          }
        }
      ]
    }
  ],
  "stats": {
    "totalCategories": 6,
    "totalProcesses": 28,
    "totalRisks": 47,
    "totalAudits": 34
  }
}
```

---

### Audit Engagements

---

#### GET /api/internal-audit/engagements

List all audit engagements for the tenant.

**Auth required:** Yes

**Query parameters:** `page`, `limit`, `status`, `search`, `categoryId`

**Response:**
```json
{
  "engagements": [
    {
      "id": "clx_eng_001",
      "engagementCode": "ENG-2025-042",
      "name": "IT Security Audit 2025",
      "categoryId": "clx_cat_002",
      "category": { "id": "clx_cat_002", "name": "IT" },
      "auditType": "IT Audit",
      "status": "Fieldwork",
      "plannedStartDate": "2025-07-01T00:00:00.000Z",
      "plannedEndDate": "2025-07-31T00:00:00.000Z",
      "plannedHours": 80,
      "actualHours": 45,
      "auditManager": { "id": "clx_user_001", "name": "Sarah Chen" },
      "auditors": [
        { "id": "clx_user_002", "name": "James Liu" }
      ],
      "findingsCount": 3,
      "openCAPACount": 2
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 20
}
```

---

#### POST /api/internal-audit/engagements

Create a new audit engagement.

**Auth required:** Yes (AuditHead, AuditManager)

**Request body:**
```json
{
  "name": "IT Security Audit 2025",
  "categoryId": "clx_cat_002",
  "auditType": "IT Audit",
  "objectives": "Assess the effectiveness of IT security controls",
  "scope": "All IT systems processing customer data",
  "plannedStartDate": "2025-07-01",
  "plannedEndDate": "2025-07-31",
  "plannedHours": 80,
  "auditManagerId": "clx_user_001",
  "auditorIds": ["clx_user_002", "clx_user_003"]
}
```

**Response:** `201 Created`
```json
{
  "engagement": {
    "id": "clx_eng_001",
    "engagementCode": "ENG-2025-042",
    "name": "IT Security Audit 2025",
    "status": "Draft",
    ...
  }
}
```

---

#### GET /api/internal-audit/engagements/[id]

Get a single engagement with full details including fieldwork, findings, and CAPAs.

**Auth required:** Yes

**Response:**
```json
{
  "engagement": {
    "id": "clx_eng_001",
    "name": "IT Security Audit 2025",
    "status": "Fieldwork",
    "objectives": "Assess the effectiveness of IT security controls",
    "scope": "All IT systems processing customer data",
    "openingMeetingDate": "2025-07-03T09:00:00.000Z",
    "auditManager": { "id": "...", "name": "Sarah Chen" },
    "auditors": [ ... ],
    "findings": [ ... ],
    "capas": [ ... ],
    "evidenceRequests": [ ... ]
  }
}
```

---

#### PATCH /api/internal-audit/engagements/[id]

Update an engagement (status, dates, team, etc.).

**Auth required:** Yes (AuditHead, AuditManager)

**Request body (partial update):**
```json
{
  "status": "Reporting",
  "actualHours": 78,
  "closingMeetingDate": "2025-07-30T14:00:00.000Z"
}
```

**Response:** `200 OK` with updated engagement object.

---

### Internal Audit Risks

---

#### GET /api/internal-audit/risks

List all Internal Audit risks (risk universe). Different from the enterprise risk register.

**Auth required:** Yes (AuditHead, AuditManager, Auditor)

**Response:**
```json
{
  "risks": [
    {
      "id": "clx_iar_001",
      "name": "Unauthorised system access",
      "description": "Risk of users gaining access to systems without proper authorisation",
      "riskScore": 16,
      "riskRating": "High",
      "department": { "id": "...", "name": "IT" },
      "category": { "id": "...", "name": "IT" },
      "status": "Open"
    }
  ],
  "total": 47
}
```

---

#### POST /api/internal-audit/risks

Create a new risk in the Internal Audit risk universe.

**Auth required:** Yes (AuditHead, AuditManager)

**Request body:**
```json
{
  "name": "Unauthorised system access",
  "description": "Risk of users gaining access without proper authorisation",
  "categoryId": "clx_cat_002",
  "departmentId": "clx_dept_001",
  "likelihoodId": "clx_prob_004",
  "impactId": "clx_impact_004"
}
```

**Response:** `201 Created` with new risk object.

---

### CAPA Tracking

---

#### GET /api/internal-audit/capa-tracking

List all CAPAs with filtering options.

**Auth required:** Yes

**Query parameters:** `page`, `limit`, `status`, `engagementId`, `assigneeId`, `dueBefore`

**Response:**
```json
{
  "capas": [
    {
      "id": "clx_capa_001",
      "capaCode": "CAPA-2025-018",
      "title": "Implement quarterly access reviews",
      "description": "Establish a formal quarterly process to review and certify all privileged access rights",
      "priority": "High",
      "type": "Corrective",
      "status": "In Progress",
      "dueDate": "2025-09-30T00:00:00.000Z",
      "assignee": { "id": "clx_user_004", "name": "Tom Wilson" },
      "finding": { "id": "clx_finding_001", "title": "Privileged access not reviewed quarterly" },
      "engagement": { "id": "clx_eng_001", "name": "IT Security Audit 2025" },
      "completedDate": null,
      "verifiedDate": null
    }
  ],
  "total": 23,
  "page": 1
}
```

---

#### POST /api/internal-audit/capa-tracking

Create a new CAPA.

**Auth required:** Yes (AuditHead, AuditManager, Auditor)

**Request body:**
```json
{
  "findingId": "clx_finding_001",
  "engagementId": "clx_eng_001",
  "title": "Implement quarterly access reviews",
  "description": "Establish a formal quarterly process...",
  "priority": "High",
  "type": "Corrective",
  "assigneeId": "clx_user_004",
  "dueDate": "2025-09-30"
}
```

**Response:** `201 Created` with new CAPA object.

---

### Strategic Plans

---

#### GET /api/internal-audit/strategic-plans

List all strategic audit plans.

**Auth required:** Yes (AuditHead)

**Response:**
```json
{
  "plans": [
    {
      "id": "clx_sp_001",
      "name": "3-Year Strategic Audit Plan 2025-2027",
      "startYear": 2025,
      "endYear": 2027,
      "status": "Approved",
      "objective": "Achieve comprehensive coverage of all high-risk auditable entities",
      "approvedBy": { "id": "clx_user_001", "name": "Chief Audit Executive" },
      "approvedDate": "2024-12-15T00:00:00.000Z",
      "coveragePercent": 87
    }
  ]
}
```

---

#### POST /api/internal-audit/strategic-plans

Create a new strategic plan.

**Auth required:** Yes (AuditHead)

**Request body:**
```json
{
  "name": "3-Year Strategic Audit Plan 2025-2027",
  "startYear": 2025,
  "endYear": 2027,
  "objective": "Achieve comprehensive coverage of all high-risk auditable entities",
  "methodology": "Risk-based audit approach following IIA Standards"
}
```

---

### Operational Plans

---

#### GET /api/internal-audit/operational-plans

List all annual operational audit plans.

**Auth required:** Yes (AuditHead, AuditManager)

---

#### POST /api/internal-audit/operational-plans

Create a new annual operational plan.

**Request body:**
```json
{
  "name": "Annual Audit Plan 2025",
  "year": 2025,
  "strategicPlanId": "clx_sp_001",
  "totalBudgetHours": 2000,
  "q1Engagements": ["clx_eng_001", "clx_eng_002"],
  "q2Engagements": ["clx_eng_003"]
}
```

---

### Audit Reports

---

#### POST /api/internal-audit/report/[id]

Generate and issue the final audit report for an engagement.

**Auth required:** Yes (AuditHead)

**Path parameter:** `id` — engagement ID

**Request body:**
```json
{
  "executiveSummary": "The IT Security Audit identified 3 findings...",
  "overallOpinion": "Partially Satisfactory",
  "distributionList": ["clx_user_001", "clx_user_005"],
  "issueDate": "2025-08-01"
}
```

**Response:**
```json
{
  "report": {
    "id": "clx_report_001",
    "engagementId": "clx_eng_001",
    "reportCode": "RPT-2025-042",
    "status": "Issued",
    "issueDate": "2025-08-01T00:00:00.000Z",
    "pdfUrl": "/api/internal-audit/reports/clx_report_001/download"
  }
}
```

---

### Independence Declarations

---

#### GET /api/internal-audit/declarations

List all independence and objectivity declarations.

**Auth required:** Yes (AuditHead)

---

#### POST /api/internal-audit/declarations

Submit a new independence declaration.

**Request body:**
```json
{
  "engagementId": "clx_eng_001",
  "hasConflict": false,
  "conflictDetails": null,
  "declarationDate": "2025-07-01",
  "signatureConfirmed": true
}
```

---

## Compliance APIs

### Frameworks

---

#### GET /api/compliance/frameworks

List all compliance frameworks for the tenant.

**Auth required:** Yes

**Response:**
```json
{
  "frameworks": [
    {
      "id": "clx_fw_001",
      "name": "ISO 27001:2022",
      "version": "2022",
      "description": "Information Security Management System",
      "complianceScore": 72.4,
      "controlsCount": 93,
      "implementedControls": 67,
      "status": "Active",
      "lastAssessmentDate": "2025-06-01T00:00:00.000Z"
    }
  ]
}
```

---

#### POST /api/compliance/frameworks

Create a new custom framework or import a pre-built one.

**Request body:**
```json
{
  "name": "Custom Security Framework",
  "version": "1.0",
  "description": "Internal control framework for financial data handling",
  "isCustom": true
}
```

---

### Controls

---

#### GET /api/compliance/controls

List controls with optional filtering by framework, status, or maturity level.

**Auth required:** Yes

**Query parameters:** `frameworkId`, `status`, `maturityMin`, `maturityMax`, `ownerId`, `page`, `limit`

**Response:**
```json
{
  "controls": [
    {
      "id": "clx_ctrl_001",
      "controlCode": "CTRL-0042",
      "name": "Multi-Factor Authentication",
      "description": "All privileged accounts must use MFA",
      "maturityLevel": 3,
      "status": "Implemented",
      "owner": { "id": "clx_user_003", "name": "IT Security Manager" },
      "nextReviewDate": "2026-01-01T00:00:00.000Z",
      "evidenceCount": 5,
      "requirementsCount": 3
    }
  ],
  "total": 93
}
```

---

#### POST /api/compliance/controls

Create a new control.

**Request body:**
```json
{
  "name": "Multi-Factor Authentication",
  "description": "All privileged accounts must use MFA",
  "controlCode": "CTRL-0042",
  "frameworkId": "clx_fw_001",
  "requirementId": "clx_req_001",
  "ownerId": "clx_user_003",
  "maturityLevel": 3,
  "reviewFrequency": "Annual"
}
```

---

### Evidence

---

#### GET /api/compliance/evidence

List all evidence items.

**Auth required:** Yes

**Query parameters:** `controlId`, `status`, `assigneeId`, `overdue` (boolean), `page`, `limit`

**Response:**
```json
{
  "evidence": [
    {
      "id": "clx_evd_001",
      "evidenceCode": "EVD-0042",
      "name": "Q3 Access Review Results",
      "controlId": "clx_ctrl_001",
      "control": { "controlCode": "CTRL-0042", "name": "Multi-Factor Authentication" },
      "type": "Document",
      "status": "Approved",
      "dueDate": "2025-09-30T00:00:00.000Z",
      "assignee": { "id": "clx_user_004", "name": "Tom Wilson" },
      "reviewer": { "id": "clx_user_003", "name": "Sarah Chen" },
      "approvedDate": "2025-08-15T00:00:00.000Z",
      "attachmentsCount": 2
    }
  ],
  "total": 156
}
```

---

#### POST /api/compliance/evidence

Create a new evidence item.

**Request body:**
```json
{
  "name": "Q3 Access Review Results",
  "controlId": "clx_ctrl_001",
  "type": "Document",
  "dueDate": "2025-09-30",
  "assigneeId": "clx_user_004",
  "reviewerId": "clx_user_003",
  "description": "Quarterly access review spreadsheet showing all reviewed accounts"
}
```

---

## Risk Management APIs

---

#### GET /api/risks

List all risks for the tenant.

**Auth required:** Yes

**Query parameters:** `page`, `limit`, `search`, `categoryId`, `status`, `rating`, `departmentId`, `ownerId`, `sortBy`, `sortOrder`

**Response:**
```json
{
  "risks": [
    {
      "id": "clx_risk_001",
      "riskCode": "RSK-0042",
      "name": "Unauthorised Data Access",
      "description": "Risk that unauthorised users gain access to sensitive customer data",
      "category": { "id": "clx_cat_001", "name": "Information Security" },
      "type": { "name": "Cybersecurity" },
      "department": { "name": "IT" },
      "owner": { "name": "CISO" },
      "inherentLikelihood": 4,
      "inherentImpact": 5,
      "inherentScore": 20,
      "inherentRating": "Critical",
      "residualLikelihood": 2,
      "residualImpact": 5,
      "residualScore": 10,
      "residualRating": "Medium",
      "targetScore": 5,
      "targetRating": "Low",
      "responseStrategy": "Mitigate",
      "status": "Open",
      "nextAssessmentDate": "2025-10-01T00:00:00.000Z"
    }
  ],
  "total": 142
}
```

---

#### POST /api/risks

Create a new risk.

**Auth required:** Yes

**Request body:**
```json
{
  "name": "Unauthorised Data Access",
  "description": "Risk of unauthorised access to customer data",
  "categoryId": "clx_cat_001",
  "typeId": "clx_type_001",
  "departmentId": "clx_dept_001",
  "ownerId": "clx_user_003",
  "inherentLikelihoodId": "clx_like_004",
  "inherentImpactId": "clx_impact_005",
  "responseStrategy": "Mitigate",
  "targetLikelihoodId": "clx_like_001",
  "targetImpactId": "clx_impact_005"
}
```

**Response:** `201 Created` with new risk object.

---

#### GET /api/risks/[id]

Get a single risk with full details including assessments, responses, and linked controls.

**Auth required:** Yes

**Response:**
```json
{
  "risk": {
    "id": "clx_risk_001",
    "name": "Unauthorised Data Access",
    "inherentScore": 20,
    "residualScore": 10,
    "targetScore": 5,
    "assessments": [
      {
        "id": "clx_asm_001",
        "assessmentDate": "2025-06-01T00:00:00.000Z",
        "previousResidualScore": 12,
        "newResidualScore": 10,
        "assessedBy": { "name": "Sarah Chen" },
        "notes": "Additional MFA controls implemented; score reduced"
      }
    ],
    "linkedControls": [
      {
        "controlId": "clx_ctrl_001",
        "controlCode": "CTRL-0042",
        "name": "Multi-Factor Authentication",
        "maturityLevel": 3,
        "relationship": "Primary"
      }
    ]
  }
}
```

---

#### PATCH /api/risks/[id]

Update a risk.

**Auth required:** Yes

**Request body (partial):**
```json
{
  "residualLikelihoodId": "clx_like_002",
  "residualImpactId": "clx_impact_005",
  "status": "Under Treatment",
  "notes": "Mitigation controls being implemented"
}
```

---

#### GET /api/risks/[id]/controls

List controls linked to a specific risk in the Risk-Control Matrix.

**Auth required:** Yes

**Response:**
```json
{
  "controls": [
    {
      "id": "clx_rcm_001",
      "controlId": "clx_ctrl_001",
      "controlCode": "CTRL-0042",
      "controlName": "Multi-Factor Authentication",
      "relationship": "Primary",
      "effectiveness": "High",
      "maturityLevel": 3
    }
  ]
}
```

---

#### POST /api/risks/[id]/controls

Link a control to a risk in the Risk-Control Matrix.

**Request body:**
```json
{
  "controlId": "clx_ctrl_001",
  "relationship": "Primary",
  "effectiveness": "High"
}
```

---

#### GET /api/risks/stats

Get aggregate risk statistics for the dashboard.

**Auth required:** Yes

**Response:**
```json
{
  "stats": {
    "total": 142,
    "bySeverity": {
      "critical": 5,
      "high": 23,
      "medium": 67,
      "low": 47
    },
    "byStatus": {
      "open": 89,
      "underTreatment": 34,
      "accepted": 12,
      "closed": 7
    },
    "averageResidualScore": 8.4,
    "trendsLastQuarter": {
      "newRisks": 12,
      "closedRisks": 8,
      "scoreChange": -0.6
    }
  }
}
```

---

#### POST /api/risks/import

Bulk import risks from a CSV/Excel file.

**Auth required:** Yes (GRCAdministrator, CustomerAdministrator)

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` — CSV or XLSX file
- `overwriteExisting` — `"true"` or `"false"`

**Response:**
```json
{
  "imported": 45,
  "skipped": 3,
  "errors": [
    { "row": 12, "field": "categoryId", "error": "Category 'Finance' not found" }
  ]
}
```

---

#### GET /api/risks/export

Export the full risk register.

**Auth required:** Yes

**Query parameters:** `format=csv|xlsx`, `status`, `rating`, `categoryId`

**Response:** Binary file download (`application/vnd.ms-excel` or `text/csv`)

---

## Organisation APIs

---

#### GET /api/organization

Get the organisation profile for the tenant.

**Auth required:** Yes

**Response:**
```json
{
  "organization": {
    "id": "clx_org_001",
    "name": "Acme Corporation",
    "industry": "Financial Services",
    "description": "Leading financial services provider",
    "address": "123 Main Street, London, UK",
    "website": "https://acme.example.com",
    "logoUrl": "/uploads/logos/acme-logo.png"
  }
}
```

---

#### POST /api/organization/process/ai-risk

Use the AI backend to automatically identify risks associated with a business process.

**Auth required:** Yes

**Request body:**
```json
{
  "processId": "clx_process_001",
  "processName": "Invoice Approval",
  "processDescription": "Three-way matching of PO, GRN, and invoice before payment approval"
}
```

**Response:**
```json
{
  "suggestedRisks": [
    {
      "name": "Duplicate invoice payment",
      "description": "Same invoice paid twice due to insufficient duplicate detection controls",
      "suggestedCategory": "Financial",
      "suggestedLikelihood": 3,
      "suggestedImpact": 4
    },
    {
      "name": "Fraudulent invoice approval",
      "description": "Invoices from fictitious vendors approved without adequate verification",
      "suggestedCategory": "Fraud",
      "suggestedLikelihood": 2,
      "suggestedImpact": 5
    }
  ]
}
```

---

## Asset Management APIs

---

#### GET /api/assets

List all assets.

**Auth required:** Yes

**Query parameters:** `categoryId`, `groupId`, `departmentId`, `riskRating`, `page`, `limit`

**Response:**
```json
{
  "assets": [
    {
      "id": "clx_asset_001",
      "assetCode": "AST-0042",
      "name": "Customer Database Server",
      "category": { "name": "IT Infrastructure" },
      "department": { "name": "IT" },
      "owner": { "name": "DBA Team" },
      "lifecycleStatus": "Active",
      "confidentialityRating": 5,
      "integrityRating": 5,
      "availabilityRating": 4,
      "ciaScore": 14,
      "riskRating": "Critical"
    }
  ],
  "total": 283
}
```

---

## Notification APIs

---

#### GET /api/notifications

Fetch paginated notifications for the current user.

**Auth required:** Yes

**Query parameters:** `page`, `limit`, `unreadOnly` (boolean)

**Response:**
```json
{
  "notifications": [
    {
      "id": "clx_notif_001",
      "title": "Evidence Due Tomorrow",
      "message": "Access Review Q3 (EVD-0042) is due tomorrow.",
      "type": "EVIDENCE_DUE_REMINDER",
      "isRead": false,
      "entityType": "Evidence",
      "entityId": "clx_evd_001",
      "actionUrl": "/compliance/evidence/clx_evd_001",
      "createdAt": "2025-07-14T08:00:00.000Z"
    }
  ],
  "total": 24,
  "unreadCount": 7,
  "page": 1,
  "pageSize": 20
}
```

---

#### POST /api/notifications/read-all

Mark all unread notifications as read for the current user.

**Auth required:** Yes

**Request body:** (empty)

**Response:**
```json
{
  "updated": 7
}
```

---

#### GET /api/notifications/unread-count

Get the count of unread notifications for the current user (used for the bell icon badge).

**Auth required:** Yes

**Response:**
```json
{
  "count": 7
}
```

---

#### PATCH /api/notifications/[id]

Mark a single notification as read or unread.

**Auth required:** Yes

**Request body:**
```json
{
  "isRead": true
}
```

**Response:**
```json
{
  "notification": {
    "id": "clx_notif_001",
    "isRead": true
  }
}
```

---

## Translation APIs

---

#### POST /api/translations/bulk

Fetch existing translations for a batch of records. Does NOT trigger new translations — only reads what is already in the database.

**Auth required:** Yes

**Request body:**
```json
{
  "requests": [
    {
      "modelName": "Risk",
      "recordIds": ["clx_risk_001", "clx_risk_002", "clx_risk_003"],
      "fields": ["name", "description"]
    },
    {
      "modelName": "AuditCategory",
      "recordIds": ["clx_cat_001", "clx_cat_002"],
      "fields": ["name"]
    }
  ]
}
```

**Response:**
```json
{
  "translations": {
    "Risk": {
      "clx_risk_001": {
        "ar": { "name": "الوصول غير المصرح به للبيانات", "description": "مخاطر الوصول غير المصرح به..." },
        "lv": { "name": "Neatļauta piekļuve datiem", "description": "Risks no neatļautas piekļuves..." }
      }
    },
    "AuditCategory": {
      "clx_cat_001": {
        "ar": { "name": "تكنولوجيا المعلومات" },
        "lv": { "name": "Informācijas tehnoloģijas" }
      }
    }
  }
}
```

---

#### POST /api/translations/translate

Trigger translation of a specific record (called after create or edit operations).

**Auth required:** Yes

**Request body:**
```json
{
  "modelName": "Risk",
  "recordId": "clx_risk_001",
  "fields": {
    "name": "Unauthorised Data Access",
    "description": "Risk that unauthorised users gain access to sensitive customer data"
  },
  "sourceLocale": "en"
}
```

**Response:**
```json
{
  "success": true,
  "translatedLocales": ["ar", "lv"]
}
```

---

## Cron APIs

All cron endpoints accept GET requests. In production they require the `Authorization: Bearer <CRON_SECRET>` header.

---

#### GET /api/cron/due-reminders

Run the due date reminder cron job. Sends notifications for evidence, CAPAs, policy reviews, and TPRM items due within the next 24 hours.

**Schedule:** Daily at 08:00 UTC

**Auth required:** CRON_SECRET (in production)

**Response:**
```json
{
  "success": true,
  "message": "Due date reminders processed successfully",
  "counts": {
    "evidence": 3,
    "capa": 1,
    "review": 2,
    "tprmRemediation": 0,
    "tprmContract": 1,
    "tprmAssessment": 0,
    "tprmSme": 0
  },
  "errors": [],
  "runId": "clx_cron_run_001"
}
```

---

#### GET /api/cron/escalation

Run the risk and issue escalation job.

**Schedule:** Daily at 09:00 UTC

**Response:**
```json
{
  "success": true,
  "escalated": 4,
  "errors": []
}
```

---

#### GET /api/cron/plan-transitions

Advance audit plans to the next stage based on scheduled dates.

**Schedule:** Daily at 01:00 UTC

**Response:**
```json
{
  "success": true,
  "transitioned": 2,
  "archived": 1
}
```

---

#### GET /api/cron/remediation-reminders

Send TPRM vendor remediation reminder notifications.

**Schedule:** Daily at 08:00 UTC

**Response:**
```json
{
  "success": true,
  "sent": 5
}
```

---

#### GET /api/cron/subscription-alerts

Check subscription expiry dates and send alerts.

**Schedule:** Daily at 09:00 UTC

**Response:**
```json
{
  "success": true,
  "alerts": 2
}
```

---

#### GET /api/cron/ticket-sla

Check support ticket SLA deadlines.

**Schedule:** Every 15 minutes

**Response:**
```json
{
  "success": true,
  "breachesDetected": 1,
  "notificationsSent": 1
}
```

---

#### GET /api/cron/cadence-reassessment

Trigger periodic risk reassessment workflows.

**Schedule:** Daily at 07:00 UTC

**Response:**
```json
{
  "success": true,
  "reassessmentsTriggered": 12
}
```

---

## Authentication APIs

These routes are provided by NextAuth v5 and are not custom-built.

---

#### POST /api/auth/callback/credentials

Authenticate a user with username and password.

**Auth required:** No

**Request body:**
```json
{
  "username": "superadmin",
  "password": "1",
  "redirect": false,
  "callbackUrl": "/"
}
```

**Response on success:** Sets `next-auth.session-token` cookie, returns `{ "url": "/" }`.

**Response on failure:** `{ "error": "CredentialsSignin" }`

---

#### GET /api/auth/session

Get the current session information.

**Auth required:** No (returns null session if not authenticated)

**Response (authenticated):**
```json
{
  "user": {
    "id": "clx_user_001",
    "email": "superadmin@example.com",
    "name": "Super Admin",
    "role": "GRCAdministrator",
    "customerAccountId": "clx_tenant_001"
  },
  "expires": "2025-08-14T00:00:00.000Z"
}
```

---

## Admin APIs

---

#### GET /api/admin/users

List all users for the current tenant.

**Auth required:** Yes (GRCAdministrator, CustomerAdministrator)

**Response:**
```json
{
  "users": [
    {
      "id": "clx_user_001",
      "name": "Sarah Chen",
      "email": "sarah.chen@company.com",
      "role": "AuditHead",
      "department": { "name": "Internal Audit" },
      "isActive": true,
      "lastLoginAt": "2025-07-14T08:30:00.000Z",
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "total": 24
}
```

---

#### POST /api/admin/users/invite

Invite a new user to the platform.

**Auth required:** Yes (GRCAdministrator, CustomerAdministrator)

**Request body:**
```json
{
  "email": "newuser@company.com",
  "name": "New User",
  "role": "Auditor",
  "departmentId": "clx_dept_001"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "clx_user_new",
    "email": "newuser@company.com",
    "name": "New User",
    "role": "Auditor"
  },
  "invitationSent": true
}
```

---

#### POST /api/admin/email/test

Send a test email to verify SMTP configuration.

**Auth required:** Yes (CustomerAdministrator, GRCAdministrator)

**Request body:**
```json
{
  "to": "admin@company.com"
}
```

**Response on success:**
```json
{
  "success": true,
  "message": "Test email sent to admin@company.com"
}
```

**Response on failure:**
```json
{
  "success": false,
  "error": "SMTP connection failed: Authentication credentials invalid"
}
```
