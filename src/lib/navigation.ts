import {
  LayoutDashboard,
  Building2,
  User,
  Users,
  Briefcase,
  Settings,
  FileText,
  Shield,
  GitBranch,
  Link,
  FileCheck,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Package,
  Layers,
  Settings2,
  PieChart,
  ClipboardCheck,
  Search,
  CheckSquare,
  LogOut,
  UserPlus,
  Globe,
  Mail,
  FileSpreadsheet,
  Download,
  Upload,
  Key,
  Network,
  Brain,
  Calendar,
  Clipboard,
  FileOutput,
  FolderOpen,
  CircleDot,
  ShieldCheck,
  ListChecks,
  Inbox,
  Activity,
  Sliders,
  Radar,
  Database,
  HelpCircle,
  UserCog,
  FileBarChart,
  Factory,
  IndianRupee,
  Tag,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { UserPermission, hasPermission, Action } from "@/lib/permissions";

export interface NavItem {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavItem[];
  /**
   * Permission required to view this nav item.
   * Format: "resource:action" (e.g., "organization.dashboard:view")
   * If not specified, the item is visible to all authenticated users.
   */
  permission?: string;
  /**
   * If true, this item is always visible regardless of permissions.
   * Used for items like Log Out.
   */
  alwaysVisible?: boolean;
  /**
   * Phase 5a — module this top-level section belongs to.
   *   - "GRC" / "TPRM" / "INTERNAL_AUDIT": shown when currentModule matches
   *   - "SYSTEM": super-admin only; hidden when a customer-module workspace is active
   *   - undefined: cross-cutting (Log Out, Subscription & Billing) — always visible
   *
   * Only meaningful on top-level sections; ignored on children.
   */
  module?: "GRC" | "TPRM" | "INTERNAL_AUDIT" | "SYSTEM";
}

export const navigation: NavItem[] = [
  // ==================== GRC Module Section (GRCAdministrator) ====================
  {
    name: "GRC",
    module: "SYSTEM",
    icon: Shield,
    permission: "grc.customer-accounts:view",
    children: [
      {
        name: "GRC Administration",
        href: "/grc",
        icon: LayoutDashboard,
        permission: "grc.customer-accounts:view",
      },
      {
        name: "Customer Accounts",
        href: "/grc/customer-accounts",
        icon: UserPlus,
        permission: "grc.customer-accounts:view",
      },
      {
        name: "Customers",
        href: "/grc/customers",
        icon: Users,
        permission: "grc.customers:view",
      },
      {
        name: "Compliance",
        icon: Shield,
        children: [
          { name: "Frameworks", href: "/compliance/framework", icon: Layers, permission: "compliance.framework:view" },
          { name: "Controls", href: "/compliance/control", icon: Link, permission: "compliance.controls:view" },
          { name: "Governance", href: "/compliance/governance", icon: FileCheck, permission: "compliance.governance:view" },
          { name: "Evidence", href: "/compliance/evidence", icon: ClipboardList, permission: "compliance.evidence:view" },
          { name: "Technical Evidence", href: "/compliance/technical-evidence", icon: Database, permission: "compliance.technical-evidence:view" },
        ],
      },
    ],
  },
  // ==================== End GRC Module Section ====================

  // ==================== Organization Section (CustomerAdministrator) ====================
  {
    name: "Organization",
    module: "GRC",
    icon: Building2,
    permission: "organization.dashboard:view",
    children: [
      { name: "Organization Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "organization.dashboard:view" },
      { name: "Profile", href: "/organization/profile", icon: User, permission: "organization.profile:view" },
      { name: "Context", href: "/organization/context", icon: Briefcase, permission: "organization.context:view" },
      { name: "Users", href: "/organization/users", icon: Users, permission: "organization.users:view" },
      { name: "Process", href: "/organization/process", icon: GitBranch, permission: "organization.process:view" },
      { name: "Organization Settings", href: "/organization/settings", icon: Settings, permission: "organization.settings:view" },
      { name: "Reports", href: "/organization/reports", icon: FileText, permission: "organization.dashboard:view" },
      // Subscription & Billing — moved here from the top-level per BA spec.
      { name: "Subscription & Billing", href: "/settings/subscription", icon: CreditCard, permission: "subscription.customer-portal:view" },
    ],
  },
  // ==================== End Organization Section ====================

  // ==================== Internal Audit > Organization Section ====================
  // BA feedback: customers with only the Internal Audit module also need an
  // Organization area to manage company profile, departments, users, etc.
  // This is a trimmed parallel to the GRC Organization:
  //   - no Dashboard (GRC charts only)
  //   - no Process (different IA workflow planned later)
  //   - Profile shows only Company Info + Departments tabs (URL-aware in page)
  //   - Settings hides BIA / Implementation / Process Frequency / Translations
  //   - Reports hides Management Report + process-by-* reports
  // Routes live under /internal-audit/organization/* and mostly re-export the
  // GRC pages with URL-aware filtering.
  {
    name: "Organization",
    module: "INTERNAL_AUDIT",
    icon: Building2,
    permission: "organization.profile:view",
    children: [
      { name: "Profile", href: "/internal-audit/organization/profile", icon: User, permission: "organization.profile:view" },
      { name: "Context", href: "/internal-audit/organization/context", icon: Briefcase, permission: "organization.context:view" },
      { name: "Users", href: "/internal-audit/organization/users", icon: Users, permission: "organization.users:view" },
      { name: "Organization Settings", href: "/internal-audit/organization/settings", icon: Settings, permission: "organization.settings:view" },
      { name: "Reports", href: "/internal-audit/organization/reports", icon: FileText, permission: "organization.dashboard:view" },
      { name: "Subscription & Billing", href: "/settings/subscription", icon: CreditCard, permission: "subscription.customer-portal:view" },
    ],
  },
  // ==================== End Internal Audit > Organization Section ====================

  // ==================== TPRM > Organization Section ====================
  // BA feedback: TPRM customers also need an Organization area, with a few
  // tweaks vs IA:
  //   - Dashboard link points at the existing TPRM Program Monitor (TPRM has
  //     its own dashboard pages; we don't build a separate org dashboard)
  //   - No Context tab (not needed for TPRM)
  //   - Users links to the existing /tprm/user-management (TPRM-specific UI)
  //   - Vendor Management surfaced inside Organization too
  //   - Profile / Settings / Reports use the same URL-aware re-exports
  //     as IA (Company Info + Departments, trimmed settings, trimmed reports)
  {
    name: "Organization",
    module: "TPRM",
    icon: Building2,
    permission: "organization.profile:view",
    children: [
      { name: "Dashboard", href: "/tprm/program-monitor", icon: LayoutDashboard, permission: "tprm.program-monitor:view" },
      { name: "Profile", href: "/tprm/organization/profile", icon: User, permission: "organization.profile:view" },
      { name: "Users", href: "/tprm/user-management", icon: Users, permission: "tprm.user-management:view" },
      { name: "Vendor Management", href: "/tprm/vendor-management", icon: Building2, permission: "tprm.vendor-management:view" },
      { name: "Organization Settings", href: "/tprm/organization/settings", icon: Settings, permission: "organization.settings:view" },
      { name: "Reports", href: "/tprm/organization/reports", icon: FileText, permission: "organization.dashboard:view" },
      { name: "Subscription & Billing", href: "/settings/subscription", icon: CreditCard, permission: "subscription.customer-portal:view" },
    ],
  },
  // ==================== End TPRM > Organization Section ====================

  // ==================== Compliance Section ====================
  {
    name: "Compliance",
    module: "GRC",
    icon: Shield,
    children: [
      { name: "Regulatory Intelligence Hub", href: "/compliance/regulatory-intelligence", icon: Radar, permission: "compliance.regulatory-intelligence:view" },
      { name: "Frameworks", href: "/compliance/framework", icon: Layers, permission: "compliance.framework:view" },
      { name: "Controls", href: "/compliance/control", icon: Link, permission: "compliance.controls:view" },
      { name: "Governance", href: "/compliance/governance", icon: FileCheck, permission: "compliance.governance:view" },
      { name: "Evidence", href: "/compliance/evidence", icon: ClipboardList, permission: "compliance.evidence:view" },
      { name: "Technical Evidence", href: "/compliance/technical-evidence", icon: Database, permission: "compliance.technical-evidence:view" },

      // Below items are for CustomerAdministrator and other roles, not GRCAdministrator
      { name: "Exception Management", href: "/compliance/exceptions", icon: AlertTriangle, permission: "compliance.exceptions:view" },
      { name: "KPI", href: "/compliance/kpis", icon: BarChart3, permission: "compliance.kpi:view" },
      { name: "Reports", href: "/compliance/reports", icon: FileText, permission: "compliance.dashboard:view" },
      { name: "Compliance settings", href: "/compliance/master-data", icon: Settings2, permission: "compliance.settings:view" },
    ],
  },
  // ==================== End Compliance Section ====================

  // ==================== QPost Compliance Section ====================
  {
    name: "QPost Compliance",
    module: "GRC",
    icon: Shield,
    children: [
      // { name: "Regulatory Intelligence Hub", href: "/qpost-compliance/regulatory-intelligence", icon: Radar, permission: "qpost-compliance.regulatory-intelligence:view" }, // HIDDEN for QPost — kept for future use
      { name: "Frameworks", href: "/qpost-compliance/framework", icon: Layers, permission: "qpost-compliance.framework:view" },
      { name: "Controls", href: "/qpost-compliance/requirements", icon: Link, permission: "qpost-compliance.controls:view" },
      { name: "Governance", href: "/qpost-compliance/governance", icon: FileCheck, permission: "qpost-compliance.governance:view" },
      { name: "Evidence", href: "/qpost-compliance/evidence", icon: ClipboardList, permission: "qpost-compliance.evidence:view" },

      // Below items are for CustomerAdministrator and other roles, not GRCAdministrator
      { name: "Exception Management", href: "/qpost-compliance/exceptions", icon: AlertTriangle, permission: "qpost-compliance.exceptions:view" },
      { name: "KPI", href: "/qpost-compliance/kpis", icon: BarChart3, permission: "qpost-compliance.kpi:view" },
      { name: "Reports", href: "/qpost-compliance/reports", icon: FileText, permission: "qpost-compliance.dashboard:view" },
      { name: "Compliance settings", href: "/qpost-compliance/master-data", icon: Settings2, permission: "qpost-compliance.settings:view" },
    ],
  },
  // ==================== End QPost Compliance Section ====================

  // ==================== Asset Management Section ====================
  {
    name: "Asset Management",
    module: "GRC",
    icon: Package,
    permission: "asset.dashboard:view",
    children: [
      { name: "Asset Inventory", href: "/assets/inventory", icon: Package, permission: "asset.inventory:view" },
      { name: "Asset Classification", href: "/assets/classification", icon: Layers, permission: "asset.classification:view" },
      { name: "Asset Settings", href: "/assets/settings", icon: Settings2, permission: "asset.settings:create" },
      { name: "Reports", href: "/assets/reports", icon: FileText, permission: "asset.reports:view" },
    ],
  },
  // ==================== End Asset Management Section ====================

  // ==================== Risk Management Section ====================
  {
    name: "Risk Management",
    module: "GRC",
    icon: AlertTriangle,
    permission: "risk.dashboard:view",
    children: [
      { name: "Risk Dashboard", href: "/risks/dashboard", icon: PieChart, permission: "risk.dashboard:view" },
      { name: "Risk Register", href: "/risks/register", icon: ClipboardList, permission: "risk.register:view" },
      { name: "Risk Assessment", href: "/risks/assessment", icon: Search, permission: "risk.assessment:view" },
      { name: "Risk Response Strategy", href: "/risks/response", icon: CheckSquare, permission: "risk.response:view" },
      { name: "Risk Control Matrix", href: "/risks/risk-control-matrix", icon: AlertTriangle, permission: "risk.risk-matrix:view" },
      { name: "Risk Settings", href: "/risks/settings", icon: Settings2, permission: "risk.settings:create" },
      { name: "Reports", href: "/risks/reports", icon: FileText, permission: "risk.reports:view" },
    ],
  },
  // ==================== End Risk Management Section ====================

  // ==================== Internal Audit Section ====================
  // Note: No parent permission — visibility determined by children's permissions.
  // CustomerAdministrator sees: Audit Settings, Risk Register
  // Auditees see: Fieldwork, Report, CAPA Tracking
  {
    name: "Internal Audit",
    module: "INTERNAL_AUDIT",
    icon: ClipboardCheck,
    children: [
      { name: "Dashboard", href: "/internal-audit/dashboard", icon: LayoutDashboard, permission: "audit.dashboard:view" },
      { name: "Audit Universe", href: "/internal-audit/audit-universe", icon: Network, permission: "audit.auditables:view" },
      { name: "Risk Identification", href: "/internal-audit/risk-identification", icon: Brain, permission: "audit.risk-identification:view" },
      { name: "RiskRegister", href: "/internal-audit/risk-register", icon: ClipboardList, permission: "audit.risk-register:view" },
      { name: "Audit Planning", href: "/internal-audit/audit-planning", icon: Calendar, permission: "audit.planning:view" },
      { name: "FieldWork", href: "/internal-audit/fieldwork", icon: Clipboard, permission: "audit.fieldwork:view" },
      { name: "Report", href: "/internal-audit/report", icon: FileOutput, permission: "audit.reports:view" },
      { name: "CAPA Tracking", href: "/internal-audit/capa-tracking", icon: CheckSquare, permission: "audit.capa:view" },
      { name: "Document Library", href: "/internal-audit/document-library", icon: FolderOpen, permission: "audit.documents:view" },
      { name: "Audit Settings", href: "/internal-audit/settings", icon: Settings2, permission: "audit.settings:view" },
      { name: "Risk Universe", href: "/internal-audit/risk-universe", icon: CircleDot, permission: "audit.risk-universe:view" },
    ],
  },
  // ==================== End Internal Audit Section ====================

  // ==================== TPRM Section ====================
  // Grouped under TPRM parent. Visible to CustomerAdministrator when isTprmAdded=true.
  // Module flag filtering controls whether GRC and/or TPRM sections appear in the sidebar.
  {
    name: "TPRM",
    module: "TPRM",
    icon: ShieldCheck,
    children: [
      { name: "Customer Accounts", href: "/tprm/account-overview", icon: LayoutDashboard, permission: "tprm.account-overview:view" },
      { name: "Program Monitor", href: "/tprm/program-monitor", icon: Activity, permission: "tprm.program-monitor:view" },
      { name: "Control Center", href: "/tprm/control-center", icon: Sliders, permission: "tprm.control-center:view" },
      { name: "User Management", href: "/tprm/user-management", icon: Users, permission: "tprm.user-management:view" },
      { name: "Vendor Management", href: "/tprm/vendor-management", icon: Building2, permission: "tprm.vendor-management:view" },
      { name: "Report", href: "/tprm/reports", icon: BarChart3, permission: "tprm.reports:view" },
      { name: "Monitoring", href: "/tprm/monitoring", icon: Radar, permission: "tprm.monitoring:view" },
      { name: "Configurations", href: "/tprm/configurations", icon: Settings, permission: "tprm.configurations:view" },
      { name: "Master Data", href: "/tprm/master-data", icon: Database, permission: "tprm.master-data:create" },
      { name: "Assessment Workspace", href: "/tprm/assessments", icon: ListChecks, permission: "grc.customer-accounts:view" },
      { name: "Task Queue", href: "/tprm/task-queue", icon: Inbox, permission: "tprm.task-queue:view" },
      // ---- Business Owner menu items ----
      { name: "Dashboard", href: "/tprm/bo-dashboard", icon: LayoutDashboard, permission: "tprm.bo-dashboard:view" },
      { name: "Assessments", href: "/tprm/bo-assessments", icon: ClipboardCheck, permission: "tprm.bo-assessments:view" },
      { name: "User Management", href: "/tprm/bo-user-management", icon: UserCog, permission: "tprm.bo-user-management:view" },
      { name: "Vendor Inventory", href: "/tprm/bo-inventory", icon: Package, permission: "tprm.bo-inventory:view" },
      { name: "Reports", href: "/tprm/bo-reports", icon: FileBarChart, permission: "tprm.bo-reports:view" },
      { name: "Issue Management", href: "/tprm/bo-issues", icon: AlertTriangle, permission: "tprm.bo-issues:view" },
      { name: "Contracts", href: "/tprm/bo-contracts", icon: FileText, permission: "tprm.bo-contracts:view" },
      { name: "Monitoring", href: "/tprm/bo-monitoring", icon: Radar, permission: "tprm.bo-monitoring:view" },
      { name: "Support", href: "/tprm/bo-support", icon: HelpCircle, permission: "tprm.bo-support:view" },
      // ---- Relationship Manager menu items (same as BO except User Management) ----
      { name: "Dashboard", href: "/tprm/rm-dashboard", icon: LayoutDashboard, permission: "tprm.rm-dashboard:view" },
      { name: "Assessments", href: "/tprm/rm-assessments", icon: ClipboardCheck, permission: "tprm.rm-assessments:view" },
      { name: "Vendor Inventory", href: "/tprm/rm-inventory", icon: Package, permission: "tprm.rm-inventory:view" },
      { name: "Reports", href: "/tprm/rm-reports", icon: FileBarChart, permission: "tprm.rm-reports:view" },
      { name: "Issue Management", href: "/tprm/rm-issues", icon: AlertTriangle, permission: "tprm.rm-issues:view" },
      { name: "Contracts", href: "/tprm/rm-contracts", icon: FileText, permission: "tprm.rm-contracts:view" },
      { name: "Monitoring", href: "/tprm/rm-monitoring", icon: Radar, permission: "tprm.rm-monitoring:view" },
      { name: "Support", href: "/tprm/rm-support", icon: HelpCircle, permission: "tprm.rm-support:view" },
      // ---- Account Manager menu items ----
      { name: "Assessments", href: "/tprm/am-assessments", icon: ClipboardCheck, permission: "tprm.am-assessments:view" },
      { name: "Follow-Ups", href: "/tprm/am-follow-ups", icon: ClipboardList, permission: "tprm.am-follow-ups:view" },
      { name: "SME Management", href: "/tprm/am-sme-management", icon: UserCog, permission: "tprm.am-sme-management:view" },
      { name: "Support", href: "/tprm/am-support", icon: HelpCircle, permission: "tprm.am-support:view" },
      // ---- Assessor menu items ----
      { name: "Dashboard", href: "/tprm/asr-dashboard", icon: LayoutDashboard, permission: "tprm.asr-dashboard:view" },
      { name: "Assessments", href: "/tprm/asr-assessments", icon: ClipboardCheck, permission: "tprm.asr-assessments:view" },
      { name: "Inventory", href: "/tprm/asr-inventory", icon: Package, permission: "tprm.asr-inventory:view" },
      { name: "Monitoring", href: "/tprm/asr-monitoring", icon: Radar, permission: "tprm.asr-monitoring:view" },
      { name: "Follow-ups", href: "/tprm/asr-follow-ups", icon: ClipboardList, permission: "tprm.asr-follow-ups:view" },
      { name: "Issue Register", href: "/tprm/asr-issue-register", icon: AlertTriangle, permission: "tprm.asr-issue-register:view" },
      { name: "Assessment Factory", href: "/tprm/asr-assessment-factory", icon: Factory, permission: "tprm.asr-assessment-factory:view" },
      { name: "Assessment History", href: "/tprm/asr-factory-reports", icon: FileBarChart, permission: "tprm.asr-factory-reports:view" },
      { name: "Reports", href: "/tprm/reports", icon: FileBarChart, permission: "tprm.reports:view" },
      { name: "Template", href: "/tprm/asr-template", icon: FileText, permission: "tprm.asr-template:view" },
      { name: "Support", href: "/tprm/asr-support", icon: HelpCircle, permission: "tprm.asr-support:view" },
      // ---- Internal IT Team menu items ----
      { name: "Issue Management", href: "/tprm/it-issues", icon: AlertTriangle, permission: "tprm.it-issues:view" },
      // ---- Factory Admin / Factory Assessor menu items ----
      { name: "User Management", href: "/tprm/factory-user-management", icon: Users, permission: "tprm.factory-user-management:view" },
      // Subscription & Billing for TPRM lives inside the TPRM > Organization
      // section above (see TPRM > Organization Section).
    ],
  },
  // ==================== End TPRM Section ====================

  // ==================== Subscription Section (GRCAdministrator) ====================
  {
    name: "Subscription",
    module: "SYSTEM",
    icon: CreditCard,
    children: [
      {
        name: "Plan Pricing",
        href: "/subscription/plan-pricing",
        icon: IndianRupee,
        permission: "subscription.pricing:view",
      },
      {
        name: "Bundle Discounts",
        href: "/subscription/bundle-discounts",
        icon: Tag,
        permission: "subscription.bundle-discounts:view",
      },
      {
        name: "All Subscriptions",
        href: "/subscription/list",
        icon: CreditCard,
        permission: "subscription.list:view",
      },
    ],
  },
  // ==================== End Subscription Section ====================

  // ==================== Email Section (separate module) ====================
  {
    name: "Email",
    module: "SYSTEM",
    icon: Mail,
    children: [
      {
        name: "Email Settings",
        href: "/grc/email-settings",
        icon: Settings,
        permission: "grc.email-settings:view",
      },
      {
        name: "Email Templates",
        href: "/grc/email-templates",
        icon: FileText,
        permission: "grc.email-templates:view",
      },
    ],
  },
  // ==================== End Email Section ====================

  {
    name: "Log Out",
    href: "/login",
    icon: LogOut,
    alwaysVisible: true,
  },
];

/**
 * Parse a permission string into resource and action
 * Format: "resource:action" (e.g., "organization.dashboard:view")
 */
function parsePermission(permissionString: string): { resource: string; action: Action } | null {
  const parts = permissionString.split(':');
  if (parts.length !== 2) return null;

  const [resource, action] = parts;
  if (!['view', 'create', 'edit', 'delete', 'approve'].includes(action)) {
    return null;
  }

  return { resource, action: action as Action };
}

/**
 * Check if a user can access a nav item based on their permissions
 */
function canAccessNavItem(item: NavItem, userPermissions: UserPermission[]): boolean {
  // Always visible items don't need permission checks
  if (item.alwaysVisible) return true;

  // If no permission is specified, the item is visible to all authenticated users
  if (!item.permission) return true;

  const parsed = parsePermission(item.permission);
  if (!parsed) return true; // Invalid permission format, default to visible

  return hasPermission(userPermissions, parsed.resource, parsed.action);
}

/**
 * Filter navigation items based on user permissions.
 * Items without permissions are always visible.
 * Parent items are visible if at least one child is visible.
 */
export function filterNavigationByPermissions(
  items: NavItem[],
  userPermissions: UserPermission[]
): NavItem[] {
  return items
    .map(item => {
      // If item has children, filter them first
      if (item.children && item.children.length > 0) {
        // Check parent's own permission first — if specified and user lacks it, hide entirely
        if (item.permission && !canAccessNavItem(item, userPermissions)) {
          return null;
        }

        const filteredChildren = filterNavigationByPermissions(item.children, userPermissions);

        // Only include parent if it has visible children or is always visible
        if (filteredChildren.length > 0 || item.alwaysVisible) {
          return {
            ...item,
            children: filteredChildren,
          };
        }

        return null;
      }

      // Leaf item - check if user can access it
      if (canAccessNavItem(item, userPermissions)) {
        return item;
      }

      return null;
    })
    .filter((item): item is NavItem => item !== null);
}

/**
 * Get all accessible routes for a user based on their permissions
 */
export function getAccessibleRoutes(userPermissions: UserPermission[]): string[] {
  const routes: string[] = [];

  function collectRoutes(items: NavItem[]) {
    for (const item of items) {
      if (item.href && canAccessNavItem(item, userPermissions)) {
        routes.push(item.href);
      }
      if (item.children) {
        collectRoutes(item.children);
      }
    }
  }

  collectRoutes(navigation);
  return routes;
}

/**
 * Role name to kebab-case folder name mapping for role-specific pages
 */
const ROLE_PATH_MAP: Record<string, string> = {
  "GRCAdministrator": "grc-administrator",
  "CustomerAdministrator": "customer-administrator",
  "AuditHead": "audit-head",
  "Auditor": "auditor",
  "AuditUser": "audit-user",
  "Auditee": "auditee",
  "Reviewer": "reviewer",
  "Contributor": "contributor",
  "DepartmentReviewer": "department-reviewer",
  "DepartmentContributor": "department-contributor",
  "FactoryAdmin": "factory-admin",
  "FactoryAssessor": "factory-assessor",
  "TPRMAdmin": "tprm-admin",
  "BusinessOwner": "business-owner",
  "RelationshipManager": "relationship-manager",
  "InternalITTeam": "internal-it-team",
  "AccountManager": "account-manager",
};

/**
 * Paths that have role-specific versions with genuinely different UI.
 *
 * IMPORTANT: Only add paths here if the role-specific page has fundamentally
 * different UI/functionality that cannot be achieved with permission-based
 * rendering (e.g., completely different layout, not just hidden buttons).
 *
 * For most pages, use the base path with permission-based rendering instead
 * of creating duplicate role-specific pages.
 *
 * Maps path -> role -> target folder name (from ROLE_PATH_MAP).
 * Multiple roles can map to the same folder to share the same page.
 *
 * @see src/hooks/usePermissions.ts for permission-based rendering
 * @see src/components/ui/permission-gate.tsx for conditional rendering
 */
const ROLE_SPECIFIC_PATHS: Record<string, Record<string, string>> = {
  // CustomerAdministrator has unique card-grid UI with subscription management
  // (vs table view for GRC admin) - all customer-level roles use the same card view
  "/compliance/framework": {
    "CustomerAdministrator": "customer-administrator",
    "DepartmentReviewer": "customer-administrator",
    "DepartmentContributor": "customer-administrator",
    "Reviewer": "customer-administrator",
    "Contributor": "customer-administrator",
  },
  // GRCAdministrator has separate Controls page with broader scope (all customers)
  "/compliance/control": {
    "GRCAdministrator": "grc-administrator",
  },
  // GRCAdministrator has separate Governance page with broader scope (all customers)
  "/compliance/governance": {
    "GRCAdministrator": "grc-administrator",
  },
  // GRCAdministrator has separate Evidence page with broader scope (all customers)
  "/compliance/evidence": {
    "GRCAdministrator": "grc-administrator",
  },
  // GRCAdministrator has separate Master Data page with GRC-specific card routes
  "/compliance/master-data": {
    "GRCAdministrator": "grc-administrator",
  },
};

/**
 * Get the role-specific path for a given original path and user role
 */
function getRoleSpecificPath(originalPath: string, userRole: string): string {
  const roleMapping = ROLE_SPECIFIC_PATHS[originalPath];

  // If no role-specific version exists for this path, return original
  if (!roleMapping) return originalPath;

  // If this role has a specific version of the page, use the target folder
  const targetFolder = roleMapping[userRole];
  if (targetFolder) {
    return `/roles/${targetFolder}${originalPath}`;
  }

  return originalPath;
}

/**
 * Determine the primary role to use for navigation paths
 * Priority: AuditHead > Auditor > Auditor > AuditUser > Auditee >
 *           GRCAdministrator > CustomerAdministrator >
 *           Reviewer > DepartmentReviewer > Contributor > DepartmentContributor
 */
function getPrimaryRole(roles: string[]): string {
  const rolePriority = [
    "AuditHead",
    "Auditor",
    "AuditUser",
    "Auditee",
    "GRCAdministrator",
    "CustomerAdministrator",
    "Reviewer",
    "DepartmentReviewer",
    "Contributor",
    "DepartmentContributor",
    "FactoryAdmin",
    "FactoryAssessor",
    "TPRMAdmin",
    "BusinessOwner",
    "RelationshipManager",
    "InternalITTeam",
    "TPRMAuditor",
    "AccountManager",
  ];

  for (const role of rolePriority) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return roles[0] || "Contributor";
}

/**
 * Transform navigation items to use role-specific paths
 */
function transformNavItemsForRole(items: NavItem[], userRole: string): NavItem[] {
  return items.map(item => {
    const transformed = { ...item };

    // Transform href if it exists
    if (transformed.href) {
      transformed.href = getRoleSpecificPath(transformed.href, userRole);
    }

    // Transform children recursively
    if (transformed.children && transformed.children.length > 0) {
      transformed.children = transformNavItemsForRole(transformed.children, userRole);
    }

    return transformed;
  });
}

/**
 * Module flags for conditional navigation rendering.
 * Controls whether GRC and TPRM modules appear in navigation.
 */
interface NavModuleFlags {
  isGrcAdded?: boolean;
  isTprmAdded?: boolean;
  isInternalAuditEnabled?: boolean;
  isQpostComplianceEnabled?: boolean;
}

/**
 * Filter and transform navigation items based on user permissions, role, and module flags.
 * Returns navigation with role-specific paths.
 *
 * Module flag behavior:
 * - If customer has ONLY TPRM (isTprmAdded=true, isGrcAdded=false):
 *   TPRM children are promoted to top-level (flat, no "TPRM" parent group)
 * - If customer has BOTH (isTprmAdded=true, isGrcAdded=true):
 *   TPRM stays grouped under "TPRM" parent alongside other modules
 * - System roles (GRCAdministrator, TPRMAdmin, FactoryAdmin) are not affected by flags
 */
export function filterNavigationByPermissionsAndRole(
  items: NavItem[],
  userPermissions: UserPermission[],
  userRoles: string[],
  moduleFlags?: NavModuleFlags,
  /**
   * Phase 5a — when set, only top-level sections tagged with this module
   * (or untagged cross-cutting sections) are kept. SYSTEM-tagged sections
   * are also kept for users with isGRCAdministrator role.
   * Pass `null` (or omit) to keep legacy behaviour: show everything that
   * passes permission/role checks.
   */
  currentModule?: "GRC" | "TPRM" | "INTERNAL_AUDIT" | null
): NavItem[] {
  const primaryRole = getPrimaryRole(userRoles);

  // System roles ignore module flags
  const isSystemRole = userRoles.some(r =>
    r === 'GRCAdministrator' || r === 'TPRMAdmin' || r === 'FactoryAdmin' || r === 'FactoryAssessor' || r === 'InternalITTeam' || r === 'TPRMAuditor'
  );
  const isGRCAdministrator = userRoles.includes('GRCAdministrator');

  let navItems = items;

  // Phase 5a — workspace scoping. When the user has picked a current module,
  // hide top-level sections belonging to other modules. SYSTEM sections stay
  // for GRCAdministrator only. Untagged sections (Subscription & Billing,
  // Log Out) are cross-cutting and always show.
  // GRCAdministrator: skip the filter entirely so super-admin always sees
  // their full tree (they don't use the picker).
  if (currentModule && !isGRCAdministrator) {
    navItems = navItems.filter((item) => {
      if (!item.module) return true;
      if (item.module === "SYSTEM") return false;
      return item.module === currentModule;
    });
  }

  // Factory roles and IT roles always get flattened TPRM nav (their items should be top-level)
  const isFactoryRole = userRoles.some(r => r === 'FactoryAdmin' || r === 'FactoryAssessor');
  const isITRole = userRoles.some(r => r === 'InternalITTeam');
  const isTPRMAuditor = userRoles.some(r => r === 'TPRMAuditor');
  if (isFactoryRole || isITRole || isTPRMAuditor) {
    // Use navItems (post-currentModule filter), not items (raw input), so the
    // workspace scoping isn't undone here. Bug fix discovered when TPRM-only
    // customer admin saw all 3 Organization sections instead of only TPRM's.
    navItems = flattenTprmNavigation(navItems);
    if (isTPRMAuditor) {
      navItems = reorderForTPRMAuditor(navItems);
    }
  }
  // For non-system roles with ONLY TPRM (no GRC), flatten TPRM children to top-level
  else if (!isSystemRole && moduleFlags?.isTprmAdded && !moduleFlags?.isGrcAdded) {
    navItems = flattenTprmNavigation(navItems);
  }

  // Toggle between Compliance and QPost Compliance based on module flag
  if (!isSystemRole && moduleFlags?.isQpostComplianceEnabled) {
    navItems = navItems.filter(item => item.name !== 'Compliance');
  } else {
    navItems = navItems.filter(item => item.name !== 'QPost Compliance');
  }

  // GRCAdministrator sees Compliance nested under GRC, so hide the standalone Compliance group and QPost Compliance
  const isGrcAdmin = userRoles.includes('GRCAdministrator');
  if (isGrcAdmin) {
    navItems = navItems.filter(item => item.name !== 'Compliance' && item.name !== 'QPost Compliance');
  }

  // First filter by permissions
  const filteredItems = filterNavigationByPermissions(navItems, userPermissions);

  // Then transform to role-specific paths
  return transformNavItemsForRole(filteredItems, primaryRole);
}

/**
 * Flatten TPRM navigation: replace the "TPRM" parent group with its children as top-level items.
 * All non-TPRM groups (Organization, Compliance, etc.) are kept as-is (they'll be filtered out
 * by permissions since the user won't have GRC permissions).
 */
function flattenTprmNavigation(items: NavItem[]): NavItem[] {
  const result: NavItem[] = [];

  for (const item of items) {
    if (item.name === 'TPRM' && item.children && item.children.length > 0) {
      // Promote TPRM children to top level
      result.push(...item.children);
    } else {
      result.push(item);
    }
  }

  return result;
}

/**
 * Reorder and rename nav items specifically for TPRMAuditor role.
 * Custom order: Dashboard, Assessments, Inventory, Issue Register, Follow-ups,
 * Assessment Factory History, Reports, Template, Support
 */
function reorderForTPRMAuditor(items: NavItem[]): NavItem[] {
  // Rename "Assessment History" to "Assessment Factory History"
  const renamed = items.map(item =>
    item.name === 'Assessment History' ? { ...item, name: 'Assessment Factory History' } : item
  );

  // Define desired order by href
  const order = [
    '/tprm/asr-dashboard',
    '/tprm/asr-assessments',
    '/tprm/asr-inventory',
    '/tprm/asr-issue-register',
    '/tprm/asr-follow-ups',
    '/tprm/asr-monitoring',
    '/tprm/asr-factory-reports',
    '/tprm/reports',
    '/tprm/asr-template',
    '/tprm/asr-support',
  ];

  const ordered: NavItem[] = [];
  for (const href of order) {
    const found = renamed.find(i => i.href === href);
    if (found) ordered.push(found);
  }
  // Append any remaining items not in the explicit order
  for (const item of renamed) {
    if (!order.includes(item.href || '')) ordered.push(item);
  }
  return ordered;
}

/**
 * Get the primary role from user roles array
 */
export function getUserPrimaryRole(roles: string[]): string {
  return getPrimaryRole(roles);
}

/**
 * Get role-specific path for a given path and role
 */
export function getRoleBasedPath(path: string, role: string): string {
  return getRoleSpecificPath(path, role);
}
