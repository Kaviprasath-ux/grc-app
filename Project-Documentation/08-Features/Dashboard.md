# Dashboard

## Table of Contents

1. [Overview](#overview)
2. [Role-Based Routing](#role-based-routing)
3. [GRC Dashboard](#grc-dashboard)
4. [GRC Dashboard Metrics](#grc-dashboard-metrics)
5. [Charts and Visualizations](#charts-and-visualizations)
6. [Internal Audit Dashboard](#internal-audit-dashboard)
7. [Data Source and Refresh Behavior](#data-source-and-refresh-behavior)
8. [Performance Considerations](#performance-considerations)
9. [API Reference](#api-reference)
10. [Permissions](#permissions)

---

## Overview

The Dashboard is the landing page of the GRC application after login. It provides an at-a-glance summary of the organization's GRC posture: how many risks are open, what is the compliance status across frameworks, how many audit findings need attention, and what the overall health of governance documents is.

Because different users have different responsibilities, the dashboard is role-aware: a GRC Administrator sees the full GRC picture, while an Audit Head is routed directly to the Internal Audit dashboard. This ensures every user immediately sees what is most relevant to them.

---

## Role-Based Routing

When a user logs in, the application inspects their session roles and routes them to the appropriate starting page. This routing happens server-side in the Next.js middleware before the dashboard page is rendered.

### Routing Logic

```
Login successful
  │
  ├── Has role: GRCAdministrator, CustomerAdministrator, Reviewer, Contributor
  │     → Redirect to /grc (GRC Dashboard)
  │
  ├── Has role: AuditHead, AuditManager, Auditor, Auditee
  │     → Redirect to /internal-audit/dashboard
  │
  └── Has role: AccountManager, BusinessOwner (TPRM module)
        → Redirect to /tprm/dashboard
```

Users with multiple roles are routed to the highest-priority dashboard. A user who is both an Auditor and a Contributor is routed to the GRC dashboard, because the GRC roles take precedence.

### Manual Navigation

After landing on their default dashboard, users can navigate to other sections of the application using the sidebar. The sidebar itself is permission-filtered: menu items a user does not have permission to see are not rendered.

---

## GRC Dashboard

### Who Sees It

The GRC Dashboard is the primary view for:

- **GRCAdministrator** — full organization-wide view
- **CustomerAdministrator** — full organization-wide view
- **Reviewer** — read-only view of all metrics
- **Contributor** — read-only view of metrics relevant to their modules
- **DepartmentReviewer / DepartmentContributor** — same layout, data filtered to their departments

### Layout

The dashboard uses a card-based grid layout with:

- **Top summary bar** — four key metric counters (Departments, Stakeholders, Regulations, Issues/Risks)
- **Middle row** — compliance progress and evidence status
- **Bottom section** — exceptions, KPIs, governance documents, and framework heat maps

All cards are responsive and collapse gracefully on smaller screens.

---

## GRC Dashboard Metrics

### Departments and Stakeholders

**Departments Count:**
The total number of active departments defined in the Organization module. This is a simple count used to give context to other numbers (e.g., "7 departments, 3 have open high risks").

Clicking on the departments count navigates to the Department management page.

**Stakeholders Count:**
The total number of stakeholders (internal + external) in the organization's stakeholder registry.

### Regulations Tracked

The number of compliance regulations or standards currently being tracked in the Compliance module. This is the count of active compliance frameworks or regulatory requirements in scope.

Examples: ISO 27001, SOC 2 Type II, UAE PDPL, GDPR, PCI DSS.

### Issues and Risks

**Open Issues Count:**
Issues are compliance gaps, audit findings that are awaiting resolution, or process deficiencies that have been logged. The dashboard shows the count of open issues, with a color coding based on severity:

- Red badge: one or more Critical issues open
- Orange badge: Significant issues open, no critical
- Grey badge: Only minor/informational issues

**Open Risks Count:**
The total number of risks in the Risk Register that are in an active status (not mitigated or accepted). Broken down by inherent risk severity (Critical, High, Medium, Low).

Clicking on the risk count navigates to the Risk Register with appropriate filters applied.

### Compliance Progress by Framework

For each active compliance framework, the dashboard shows:

- **Framework name and version** (e.g., ISO 27001:2022, SOC 2 Type II)
- **Implementation progress** — the percentage of applicable controls that are implemented and effective
- **Control counts** — total applicable controls, implemented, partially implemented, not implemented, not applicable
- **Progress bar** — visual representation of overall control coverage

This section uses the `ComplianceProgressBar` component (see Charts section).

**Status categories for controls:**

| Status | Meaning |
|---|---|
| Implemented | Control is fully implemented and verified |
| Partially Implemented | Control exists but has gaps |
| Not Implemented | No implementation exists |
| Not Applicable | Control is formally excluded from scope (with justification) |

### Evidence Status

The Evidence Status widget shows the current state of compliance evidence collection:

- **Total evidence items** in scope
- **Collected** — evidence submitted and accepted
- **Pending** — evidence items awaiting submission by assignee
- **Overdue** — evidence items past their due date
- **Under Review** — evidence submitted, awaiting reviewer approval

This widget uses a `DonutChart` showing the proportion of evidence items in each status.

When the "Overdue" count is above zero, it is highlighted in red to draw immediate attention. Clicking the widget navigates to the Evidence management page filtered to overdue items.

### Exceptions

Exceptions are formal, documented instances where a control cannot be implemented as required, and a risk acceptance decision has been made. The dashboard shows:

- **Total active exceptions** — all exceptions that have been approved and are within their validity period
- **Expiring soon** — exceptions whose expiry date is within the next 30 days (highlighted amber)
- **Expired** — exceptions that have passed their expiry date and need renewal or closure (highlighted red)

Expired exceptions represent a compliance gap: the original issue that required the exception has not been resolved, and the formal acceptance has lapsed.

### Process KPI Tracking

A summary of business process KPI health across the organization:

- **Green** — KPIs meeting their targets
- **Amber** — KPIs below target but above the minimum threshold
- **Red** — KPIs below the minimum acceptable threshold

Displayed as a horizontal stacked bar showing the proportion of KPIs in each status. Clicking navigates to the Organization KPI management page.

### Governance Document Status

The governance documents widget shows the status of policies, procedures, standards, and guidelines in the system:

- **Current** — document is approved, in force, and not due for review
- **Due for Review** — document is still valid but its review date is approaching (within 30 days)
- **Overdue for Review** — review date has passed; document may be outdated
- **Draft** — document is under development, not yet approved
- **Expired** — document has passed its expiry date; must be renewed or retired

This widget uses a `DonutChart`. An expired or overdue-for-review count highlighted in red indicates governance documents that need immediate attention.

---

## Charts and Visualizations

### DonutChart

**What it displays:** Proportional distribution of items across categories, shown as a ring (donut) chart. Each segment represents a category, and the size of the segment represents the proportion of the total.

**Usage in the dashboard:**
- Evidence status distribution (Collected / Pending / Overdue / Under Review)
- Governance document status (Current / Draft / Due for Review / Expired)
- Risk severity distribution (Critical / High / Medium / Low)
- Asset criticality distribution (Tier 1 through Tier 5)

**Component:** `src/components/charts/DonutChart.tsx`

**Props:**
```typescript
interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  title?: string;
  centerText?: string;  // Text displayed in the center of the donut
  size?: 'sm' | 'md' | 'lg';
}
```

**Design notes:** Uses color-coded segments with a legend below the chart. Each segment is clickable and navigates to the filtered list view. Hovering displays a tooltip with the exact count and percentage.

### StackedBarChart

**What it displays:** A horizontal or vertical bar where each bar is divided into color-coded segments representing sub-categories. Useful for showing how a total is composed across multiple dimensions.

**Usage in the dashboard:**
- Process KPI health (Green / Amber / Red)
- Risk distribution by department (each department's bar shows its risk severity breakdown)
- Control implementation status by framework
- Evidence completion by department or time period

**Component:** `src/components/charts/StackedBarChart.tsx`

**Props:**
```typescript
interface StackedBarChartProps {
  data: Array<{
    label: string;        // The bar label (e.g., department name)
    segments: Array<{ label: string; value: number; color: string }>;
  }>;
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;   // Show numbers inside segments
  showLegend?: boolean;
}
```

**Design notes:** Each segment within a bar is labeled with its count when large enough. Small segments are shown in the tooltip. Clicking a bar navigates to the filtered view for that category.

### ComplianceProgressBar

**What it displays:** A labeled progress bar showing implementation progress for a specific compliance framework. Includes the framework name, percentage complete, and a color-coded bar (green when above 80%, amber when 50–79%, red when below 50%).

**Usage in the dashboard:**
- One ComplianceProgressBar is rendered for each active compliance framework
- The bars are stacked vertically to allow comparison across frameworks

**Component:** `src/components/charts/ComplianceProgressBar.tsx`

**Props:**
```typescript
interface ComplianceProgressBarProps {
  frameworkName: string;
  frameworkVersion?: string;
  totalControls: number;
  implementedControls: number;
  partiallyImplemented?: number;
  showBreakdown?: boolean;  // Show exact counts below the bar
}
```

**Calculated percentage:**
```typescript
percentage = ((implemented + (partially * 0.5)) / total) * 100
```

Partially implemented controls count as half credit toward the overall percentage.

---

## Internal Audit Dashboard

### Who Sees It

The Internal Audit Dashboard is the entry point for:

- **AuditHead** — full access; sees all engagements, all teams, all findings
- **AuditManager** — sees engagements they manage
- **Auditor** — sees engagements they are assigned to
- **Auditee** — sees engagements that involve their department

### Metrics Displayed

**Active Engagements:**
The count of audit engagements currently in progress (status: Planning, Fieldwork, or Reporting). Each engagement card shows the engagement name, target department, planned completion date, and current status.

**Upcoming Engagements:**
Engagements scheduled to start within the next 30 days.

**Open Findings:**
Audit findings that have been raised but not yet resolved. Broken down by severity (Critical, High, Medium, Low, Informational) and by status (Open, In Progress, Resolved, Closed).

**CAPA Overdue:**
Corrective Action and Preventive Action items that have passed their due date without being completed.

**Audit Universe Coverage:**
A visual showing what percentage of auditable entities in the Audit Universe have been audited within the current audit cycle (typically annual).

**Recent Activity:**
A chronological log of the most recent audit trail events across all active engagements: new findings raised, CAPAs updated, fieldwork completed, reports issued.

### Layout Differences from GRC Dashboard

The Internal Audit dashboard does not show:

- Compliance framework progress bars
- Evidence collection status
- Process KPI widget
- Governance documents widget

It adds instead:

- Audit engagement timeline (Gantt-style view of upcoming/active engagements)
- Finding severity distribution (DonutChart)
- CAPA completion rate trend (line chart showing monthly CAPA closure rates)

---

## Data Source and Refresh Behavior

### API Endpoint

All dashboard statistics are served by a single aggregation endpoint:

```
GET /api/dashboard/stats
```

This endpoint performs multiple database queries in parallel using `Promise.all()` and returns a single JSON object containing all metrics.

**Response structure:**
```json
{
  "organization": {
    "departments": 12,
    "stakeholders": 87,
    "processes": 34,
    "kpiStatus": { "green": 18, "amber": 9, "red": 3 }
  },
  "compliance": {
    "regulationsTracked": 5,
    "frameworks": [
      {
        "id": "...",
        "name": "ISO 27001:2022",
        "totalControls": 93,
        "implemented": 71,
        "partial": 12,
        "notImplemented": 8,
        "notApplicable": 2
      }
    ],
    "evidenceStatus": { "collected": 234, "pending": 45, "overdue": 12, "underReview": 8 },
    "exceptions": { "active": 6, "expiringSoon": 2, "expired": 1 }
  },
  "risk": {
    "openRisks": 23,
    "bySeverity": { "critical": 2, "high": 7, "medium": 11, "low": 3 }
  },
  "governance": {
    "documents": { "current": 42, "dueForReview": 8, "overdueForReview": 3, "draft": 5, "expired": 1 }
  }
}
```

### Data Freshness

The dashboard data is fetched when the dashboard page loads and is not automatically refreshed. To get the latest data:

- **Manually refresh** — use the browser refresh button or the refresh icon in the dashboard header
- **Navigate away and back** — Next.js route changes trigger a fresh data fetch

**Caching behavior:**

The dashboard API route uses short-lived caching (30–60 seconds) to prevent excessive database load when multiple users view the dashboard simultaneously. This means the displayed data may be up to 60 seconds old.

For environments where real-time accuracy is critical, the cache TTL can be reduced or disabled by modifying the cache configuration in the API route handler.

### Internal Audit Dashboard Data

The Internal Audit dashboard fetches from:

```
GET /api/internal-audit/dashboard/stats
```

This endpoint is separate from the GRC dashboard endpoint and is scoped to the audit modules.

---

## Performance Considerations

### Avoiding N+1 Queries

The dashboard aggregation query uses a single Prisma query with nested `_count` aggregations rather than making separate queries for each metric. This is important because the dashboard is loaded on every login — it must be fast.

```typescript
// Efficient: single query with aggregations
const stats = await prisma.risk.groupBy({
  by: ['severity'],
  _count: true,
  where: { customerAccountId, status: 'OPEN' }
});

// Inefficient: N+1 pattern (do not do this)
const risks = await prisma.risk.findMany({ where: { customerAccountId } });
const critical = risks.filter(r => r.severity === 'CRITICAL').length; // Should use DB aggregation
```

### Large Organizations

For organizations with thousands of assets, risks, or controls, dashboard aggregation queries can be slow. If the dashboard load time exceeds 2 seconds:

1. Check that the `customerAccountId` field has a database index (it should by default)
2. Consider adding composite indexes for frequently filtered combinations
3. Consider introducing a materialized view or a scheduled job that pre-computes dashboard stats

---

## API Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/dashboard/stats` | GRC dashboard statistics | Required |
| GET | `/api/internal-audit/dashboard/stats` | Audit dashboard statistics | Required (Audit roles) |

---

## Permissions

| Permission | Required Role | Notes |
|---|---|---|
| View GRC Dashboard | CustomerAdministrator, GRCAdministrator, Reviewer, Contributor | Department-scoped users see filtered data |
| View Internal Audit Dashboard | AuditHead, AuditManager, Auditor, Auditee | Auditee sees only their department's engagements |
| View TPRM Dashboard | AccountManager, BusinessOwner | TPRM module subscription required |

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*
