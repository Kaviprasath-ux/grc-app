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
      { name: "Domain", href: "/compliance/domain", icon: Globe, permission: "compliance.domain:view" },
      // Below items are for CustomerAdministrator and other roles, not GRCAdministrator
      { name: "Exception Management", href: "/compliance/exceptions", icon: AlertTriangle, permission: "compliance.exceptions:view" },
      { name: "KPI", href: "/compliance/kpis", icon: BarChart3, permission: "compliance.kpi:view" },
      { name: "Risk Compliance Matrix", href: "/compliance/risk-matrix", icon: AlertTriangle, permission: "compliance.dashboard:view" },
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
      { name: "Risk Settings", href: "/risks/settings", icon: Settings2, permission: "risk.settings:view" },
      { name: "Reports", href: "/risks/reports", icon: FileText, permission: "risk.reports:view" },
    ],
  },
  // ==================== End Risk Management Section ====================

  // ==================== Internal Audit Section ====================
  {
    name: "Internal Audit",
    icon: ClipboardCheck,
    permission: "audit.dashboard:view",
    children: [
      { name: "Dashboard", href: "/internal-audit/dashboard", icon: LayoutDashboard, permission: "audit.dashboard:view" },
      { name: "Audit Universe", href: "/internal-audit/audit-universe", icon: Network, permission: "audit.auditables:view" },
      { name: "Risk Identification", href: "/internal-audit/risk-identification", icon: Brain, permission: "audit.risk-identification:view" },
      { name: "RiskRegister", href: "/internal-audit/risk-register", icon: ClipboardList, permission: "audit.auditables:view" },
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
