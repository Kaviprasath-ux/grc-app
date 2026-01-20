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
}

export const navigation: NavItem[] = [
  // ==================== GRC Administrator Section ====================
  // These items are only visible to GRCAdministrator role
  {
    name: "Customer Accounts",
    href: "/grc/customer-accounts",
    icon: UserPlus,
    permission: "grc.customer-accounts:view",
  },
  {
    name: "Customer",
    href: "/grc/customers",
    icon: Users,
    permission: "grc.customers:view",
  },
  // ==================== End GRC Administrator Section ====================

  // ==================== Organization Section (CustomerAdministrator) ====================
  {
    name: "Organization",
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
    ],
  },
  // ==================== End Organization Section ====================

  // ==================== Compliance Section ====================
  {
    name: "Compliance",
    icon: Shield,
    children: [
      { name: "Frameworks", href: "/compliance/framework", icon: Layers, permission: "compliance.framework:view" },
      { name: "Controls", href: "/compliance/control", icon: Link, permission: "compliance.controls:view" },
      { name: "Governance", href: "/compliance/governance", icon: FileCheck, permission: "compliance.governance:view" },
      { name: "Evidence", href: "/compliance/evidence", icon: ClipboardList, permission: "compliance.evidence:view" },
      // Below items are for CustomerAdministrator and other roles, not GRCAdministrator
      { name: "Exception Management", href: "/compliance/exceptions", icon: AlertTriangle, permission: "compliance.exceptions:view" },
      { name: "KPI", href: "/compliance/kpis", icon: BarChart3, permission: "compliance.kpi:view" },
      { name: "Reports", href: "/compliance/reports", icon: FileText, permission: "compliance.dashboard:view" },
      { name: "Master Data", href: "/compliance/master-data", icon: Settings2, permission: "compliance.settings:view" },
    ],
  },
  // ==================== End Compliance Section ====================

  // Configuration Section removed from GRCAdministrator navigation per user request

  // ==================== Asset Management Section ====================
  {
    name: "Asset Management",
    icon: Package,
    permission: "asset.dashboard:view",
    children: [
      { name: "Asset Inventory", href: "/assets/inventory", icon: Package, permission: "asset.inventory:view" },
      { name: "Asset Classification", href: "/assets/classification", icon: Layers, permission: "asset.classification:view" },
      { name: "Asset Settings", href: "/assets/settings", icon: Settings2, permission: "asset.settings:view" },
      { name: "Reports", href: "/assets/reports", icon: FileText, permission: "asset.reports:view" },
    ],
  },
  // ==================== End Asset Management Section ====================

  // ==================== Risk Management Section ====================
  {
    name: "Risk Management",
    icon: AlertTriangle,
    permission: "risk.dashboard:view",
    children: [
      { name: "Risk Dashboard", href: "/risks/dashboard", icon: PieChart, permission: "risk.dashboard:view" },
      { name: "Risk Register", href: "/risks/register", icon: ClipboardList, permission: "risk.register:view" },
      { name: "Risk Assessment", href: "/risks/assessment", icon: Search, permission: "risk.assessment:view" },
      { name: "Risk Response Strategy", href: "/risks/response", icon: CheckSquare, permission: "risk.response:view" },
      { name: "Risk Control Matrix", href: "/risks/risk-control-matrix", icon: AlertTriangle, permission: "risk.risk-matrix:view" },
      { name: "Risk Settings", href: "/risks/settings", icon: Settings2, permission: "risk.settings:view" },
      { name: "Reports", href: "/risks/reports", icon: FileText, permission: "risk.reports:view" },
    ],
  },
  // ==================== End Risk Management Section ====================

  // ==================== Internal Audit Section ====================
  // Note: Parent permission uses audit.fieldwork:view to allow Auditees to see the menu
  // Auditees only have access to: Fieldwork, Report, CAPA Tracking
  {
    name: "Internal Audit",
    icon: ClipboardCheck,
    permission: "audit.fieldwork:view",
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
      { name: "Settings", href: "/internal-audit/settings", icon: Settings2, permission: "audit.settings:view" },
      { name: "Risk Universe", href: "/internal-audit/risk-universe", icon: CircleDot, permission: "audit.risk-universe:view" },
    ],
  },
  // ==================== End Internal Audit Section ====================

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
  "AuditManager": "audit-manager",
  "AuditUser": "audit-user",
  "Auditor": "auditor",
  "Auditee": "auditee",
  "Reviewer": "reviewer",
  "Contributor": "contributor",
  "DepartmentReviewer": "department-reviewer",
  "DepartmentContributor": "department-contributor",
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
 * @see src/hooks/usePermissions.ts for permission-based rendering
 * @see src/components/ui/permission-gate.tsx for conditional rendering
 */
const ROLE_SPECIFIC_PATHS: Record<string, string[]> = {
  // CustomerAdministrator has unique card-grid UI with subscription management
  // (vs table view for other roles) - keep as exception
  "/compliance/framework": ["CustomerAdministrator"],
  // GRCAdministrator has separate Controls page with broader scope (all customers)
  "/compliance/control": ["GRCAdministrator"],
  // GRCAdministrator has separate Governance page with broader scope (all customers)
  "/compliance/governance": ["GRCAdministrator"],
};

/**
 * Get the role-specific path for a given original path and user role
 */
function getRoleSpecificPath(originalPath: string, userRole: string): string {
  const rolesForPath = ROLE_SPECIFIC_PATHS[originalPath];

  // If no role-specific version exists for this path, return original
  if (!rolesForPath) return originalPath;

  // If this role has a specific version of the page
  if (rolesForPath.includes(userRole)) {
    const rolePath = ROLE_PATH_MAP[userRole];
    if (rolePath) {
      return `/roles/${rolePath}${originalPath}`;
    }
  }

  return originalPath;
}

/**
 * Determine the primary role to use for navigation paths
 * Priority: AuditHead > AuditManager > Auditor > AuditUser > Auditee >
 *           GRCAdministrator > CustomerAdministrator >
 *           Reviewer > DepartmentReviewer > Contributor > DepartmentContributor
 */
function getPrimaryRole(roles: string[]): string {
  const rolePriority = [
    "AuditHead",
    "AuditManager",
    "Auditor",
    "AuditUser",
    "Auditee",
    "GRCAdministrator",
    "CustomerAdministrator",
    "Reviewer",
    "DepartmentReviewer",
    "Contributor",
    "DepartmentContributor",
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
 * Filter and transform navigation items based on user permissions and role.
 * Returns navigation with role-specific paths.
 */
export function filterNavigationByPermissionsAndRole(
  items: NavItem[],
  userPermissions: UserPermission[],
  userRoles: string[]
): NavItem[] {
  const primaryRole = getPrimaryRole(userRoles);

  // First filter by permissions
  const filteredItems = filterNavigationByPermissions(items, userPermissions);

  // Then transform to role-specific paths
  return transformNavItemsForRole(filteredItems, primaryRole);
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
