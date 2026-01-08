/**
 * Role-Based Access Control (RBAC) Permission Configuration
 *
 * This file defines all resources, actions, and role permissions for the GRC application.
 */

// ==================== ACTIONS ====================
export const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'] as const;
export type Action = typeof ACTIONS[number];

// ==================== SCOPES ====================
export const SCOPES = ['all', 'department', 'own'] as const;
export type Scope = typeof SCOPES[number];

// ==================== RESOURCES ====================
// Resources map to routes/features in the application
export const RESOURCES = {
  // GRC Administrator Module (System-level management)
  'grc': '/grc',
  'grc.customer-accounts': '/grc/customer-accounts',
  'grc.customers': '/grc/customers',
  'grc.configuration': '/grc/configuration',
  'grc.configuration.reflection': '/grc/configuration/reflection',
  'grc.configuration.excel-import': '/grc/configuration/excel-import',
  'grc.configuration.excel-export': '/grc/configuration/excel-export',
  'grc.configuration.email': '/grc/configuration/email',
  'grc.configuration.pdf-report': '/grc/configuration/pdf-report',
  'grc.configuration.sso': '/grc/configuration/sso',

  // Organization Module (CustomerAdministrator territory)
  'organization.dashboard': '/organization',
  'organization.profile': '/organization/profile',
  'organization.context': '/organization/context',
  'organization.users': '/organization/users',
  'organization.process': '/organization/process',
  'organization.settings': '/organization/settings',
  'organization.settings.departments': '/organization/settings/departments',
  'organization.settings.services': '/organization/settings/services',
  'organization.settings.bia-categories': '/organization/settings/bia-categories',
  'organization.settings.bia-methodology': '/organization/settings/bia-methodology',
  'organization.settings.bcp-labels': '/organization/settings/bcp-labels',

  // Compliance Module
  'compliance.dashboard': '/compliance',
  'compliance.framework': '/compliance/framework',
  'compliance.controls': '/compliance/control',
  'compliance.governance': '/compliance/governance',
  'compliance.evidence': '/compliance/evidence',
  'compliance.domain': '/compliance/domain',
  'compliance.artifacts': '/compliance/artifacts',
  'compliance.exceptions': '/compliance/exceptions',
  'compliance.kpi': '/compliance/kpi',
  'compliance.risk-matrix': '/compliance/risk-matrix',
  'compliance.settings': '/compliance/settings',

  // Asset Management Module
  'asset.dashboard': '/asset-management',
  'asset.inventory': '/asset-management/inventory',
  'asset.classification': '/asset-management/classification',
  'asset.settings': '/asset-management/settings',
  'asset.reports': '/asset-management/reports',

  // Risk Management Module
  'risk.dashboard': '/risk-management',
  'risk.register': '/risk-management/register',
  'risk.assessment': '/risk-management/assessment',
  'risk.response': '/risk-management/response',
  'risk.settings': '/risk-management/settings',
  'risk.reports': '/risk-management/reports',

  // Internal Audit Module
  'audit.dashboard': '/internal-audit/dashboard',
  'audit.auditables': '/internal-audit/audit-universe',
  'audit.risk-identification': '/internal-audit/risk-identification',
  'audit.risk-register': '/internal-audit/risk-register',
  'audit.planning': '/internal-audit/audit-planning',
  'audit.fieldwork': '/internal-audit/fieldwork',
  'audit.reports': '/internal-audit/report',
  'audit.capa': '/internal-audit/capa-tracking',
  'audit.documents': '/internal-audit/document-library',
  'audit.settings': '/internal-audit/settings',
  'audit.risk-universe': '/internal-audit/risk-universe',
} as const;

export type Resource = keyof typeof RESOURCES;

// ==================== ROLE DEFINITIONS ====================
export const ROLES = {
  GRCAdministrator: {
    name: 'GRCAdministrator',
    description: 'Full system access, all modules, all data',
  },
  CustomerAdministrator: {
    name: 'CustomerAdministrator',
    description: 'Organization-level admin, manages users and settings',
  },
  AuditHead: {
    name: 'AuditHead',
    description: 'Full access to Internal Audit module, all audit data',
  },
  AuditManager: {
    name: 'AuditManager',
    description: 'Manages audits, assigns auditors, reviews findings',
  },
  AuditUser: {
    name: 'AuditUser',
    description: 'Basic audit module access',
  },
  Auditor: {
    name: 'Auditor',
    description: 'Conducts audits, creates findings',
  },
  Auditee: {
    name: 'Auditee',
    description: 'Receives audit requests, responds to findings',
  },
  Reviewer: {
    name: 'Reviewer',
    description: 'Reviews and approves compliance, risk, and asset content (no admin access)',
  },
  Contributor: {
    name: 'Contributor',
    description: 'Creates and edits content across modules',
  },
  DepartmentReviewer: {
    name: 'DepartmentReviewer',
    description: 'Reviews content within own department',
  },
  DepartmentContributor: {
    name: 'DepartmentContributor',
    description: 'Creates/edits content within own department',
  },
} as const;

export type RoleName = keyof typeof ROLES;

// ==================== ROLE PERMISSION MATRIX ====================
// Defines what each role can do
interface RolePermissionDef {
  resource: string; // Can use wildcards like 'organization.*' or '*'
  actions: Action[] | ['*'];
  scope: Scope;
}

export const ROLE_PERMISSIONS: Record<RoleName, RolePermissionDef[]> = {
  // GRC Administrator - System-level management only
  // Has access to: Customer Accounts, Customers, Compliance (Framework, Controls, Governance, Evidence, Domain), Configuration
  // Does NOT have access to: Organization, Asset Management, Risk Management, Internal Audit
  GRCAdministrator: [
    // GRC-specific pages
    { resource: 'grc', actions: ['*'], scope: 'all' },
    { resource: 'grc.customer-accounts', actions: ['*'], scope: 'all' },
    { resource: 'grc.customers', actions: ['*'], scope: 'all' },
    // Compliance module - specific resources only
    { resource: 'compliance.framework', actions: ['*'], scope: 'all' },
    { resource: 'compliance.controls', actions: ['*'], scope: 'all' },
    { resource: 'compliance.governance', actions: ['*'], scope: 'all' },
    { resource: 'compliance.evidence', actions: ['*'], scope: 'all' },
    { resource: 'compliance.domain', actions: ['*'], scope: 'all' },
    { resource: 'compliance.settings', actions: ['*'], scope: 'all' },
  ],

  // Customer Administrator - Full access to organization, view access to other modules
  CustomerAdministrator: [
    { resource: 'organization.*', actions: ['*'], scope: 'all' },
    { resource: 'compliance.*', actions: ['view'], scope: 'all' },
    { resource: 'asset.*', actions: ['view'], scope: 'all' },
    { resource: 'risk.*', actions: ['view'], scope: 'all' },
    { resource: 'audit.*', actions: ['view'], scope: 'all' },
  ],

  // Audit Head - Full access to Internal Audit module ONLY
  AuditHead: [
    { resource: 'audit.*', actions: ['*'], scope: 'all' },
  ],

  // Audit Manager - Manage audits, limited settings access
  AuditManager: [
    { resource: 'audit.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'audit.auditables', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'audit.planning', actions: ['*'], scope: 'all' },
    { resource: 'audit.execution', actions: ['view', 'create', 'edit', 'approve'], scope: 'all' },
    { resource: 'audit.reporting', actions: ['*'], scope: 'all' },
    { resource: 'audit.followup', actions: ['*'], scope: 'all' },
    { resource: 'audit.settings', actions: ['view'], scope: 'all' },
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'organization.process', actions: ['view'], scope: 'all' },
    { resource: 'organization.users', actions: ['view'], scope: 'all' },
  ],

  // Audit User - Basic audit access
  AuditUser: [
    { resource: 'audit.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'audit.auditables', actions: ['view'], scope: 'all' },
    { resource: 'audit.planning', actions: ['view'], scope: 'all' },
    { resource: 'audit.execution', actions: ['view'], scope: 'all' },
    { resource: 'audit.reporting', actions: ['view'], scope: 'all' },
    { resource: 'audit.followup', actions: ['view'], scope: 'all' },
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
  ],

  // Auditor - Conducts audits
  Auditor: [
    { resource: 'audit.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'audit.auditables', actions: ['view'], scope: 'all' },
    { resource: 'audit.planning', actions: ['view'], scope: 'all' },
    { resource: 'audit.execution', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'audit.reporting', actions: ['view', 'create'], scope: 'all' },
    { resource: 'audit.followup', actions: ['view', 'edit'], scope: 'all' },
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'organization.process', actions: ['view'], scope: 'all' },
    { resource: 'compliance.controls', actions: ['view'], scope: 'all' },
  ],

  // Auditee - Responds to audits (permanent role)
  Auditee: [
    { resource: 'audit.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'audit.execution', actions: ['view'], scope: 'department' },
    { resource: 'audit.followup', actions: ['view', 'edit'], scope: 'department' },
    { resource: 'organization.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'organization.process', actions: ['view'], scope: 'department' },
  ],

  // Reviewer - View access to compliance, risk, asset (no admin, settings, or audit access)
  // Excluded: organization.profile, organization.users, organization.settings,
  //           compliance.settings (Master Data), asset.settings, risk.settings, audit.* (entire module)
  Reviewer: [
    // Organization - only dashboard, context, and process (NO profile, users, settings)
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'organization.context', actions: ['view'], scope: 'all' },
    { resource: 'organization.process', actions: ['view'], scope: 'all' },
    // Compliance - view only (NO settings/Master Data)
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'compliance.framework', actions: ['view'], scope: 'all' },
    { resource: 'compliance.controls', actions: ['view'], scope: 'all' },
    { resource: 'compliance.governance', actions: ['view'], scope: 'all' },
    { resource: 'compliance.evidence', actions: ['view'], scope: 'all' },
    { resource: 'compliance.artifacts', actions: ['view'], scope: 'all' },
    { resource: 'compliance.exceptions', actions: ['view'], scope: 'all' },
    { resource: 'compliance.kpi', actions: ['view'], scope: 'all' },
    { resource: 'compliance.risk-matrix', actions: ['view'], scope: 'all' },
    // compliance.settings (Master Data) - EXCLUDED
    // Asset Management - view only (NO settings)
    { resource: 'asset.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'asset.inventory', actions: ['view'], scope: 'all' },
    { resource: 'asset.classification', actions: ['view'], scope: 'all' },
    { resource: 'asset.reports', actions: ['view'], scope: 'all' },
    // Risk Management - view only (NO settings)
    { resource: 'risk.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'risk.register', actions: ['view'], scope: 'all' },
    { resource: 'risk.assessment', actions: ['view'], scope: 'all' },
    { resource: 'risk.response', actions: ['view'], scope: 'all' },
    { resource: 'risk.reports', actions: ['view'], scope: 'all' },
    // Internal Audit - NO ACCESS (entire module excluded)
  ],

  // Contributor - Creates and edits across modules
  Contributor: [
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'organization.process', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'compliance.framework', actions: ['view'], scope: 'all' },
    { resource: 'compliance.controls', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.governance', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.evidence', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.artifacts', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.exceptions', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.kpi', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.risk-matrix', actions: ['view'], scope: 'all' },
    { resource: 'risk.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'risk.register', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'risk.assessment', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'risk.response', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'asset.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'asset.inventory', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'asset.classification', actions: ['view', 'create', 'edit'], scope: 'all' },
  ],

  // Department Reviewer - Reviews within own department (matches UAT exactly)
  // Has same pages as Reviewer but scoped to department
  DepartmentReviewer: [
    // Organization - Dashboard, Context, Users, Process, Reports (NO Profile, NO Settings)
    { resource: 'organization.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'organization.context', actions: ['view'], scope: 'department' },
    { resource: 'organization.users', actions: ['view'], scope: 'department' },
    { resource: 'organization.process', actions: ['view', 'approve'], scope: 'department' },
    // Compliance - Framework, Control, Governance, Evidence, Exception, KPI, Reports (NO Domain, NO Settings/Master Data, NO Risk Matrix)
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'compliance.framework', actions: ['view'], scope: 'department' },
    { resource: 'compliance.controls', actions: ['view', 'approve'], scope: 'department' },
    { resource: 'compliance.governance', actions: ['view'], scope: 'department' },
    { resource: 'compliance.evidence', actions: ['view', 'approve'], scope: 'department' },
    { resource: 'compliance.exceptions', actions: ['view'], scope: 'department' },
    { resource: 'compliance.kpi', actions: ['view'], scope: 'department' },
    // Asset Management - Inventory, Classification, Reports (NO Settings)
    { resource: 'asset.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'asset.inventory', actions: ['view', 'approve'], scope: 'department' },
    { resource: 'asset.classification', actions: ['view'], scope: 'department' },
    { resource: 'asset.reports', actions: ['view'], scope: 'department' },
    // Risk Management - Dashboard, Register, Assessment, Response, Reports (NO Settings)
    { resource: 'risk.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'risk.register', actions: ['view', 'approve'], scope: 'department' },
    { resource: 'risk.assessment', actions: ['view'], scope: 'department' },
    { resource: 'risk.response', actions: ['view'], scope: 'department' },
    { resource: 'risk.reports', actions: ['view'], scope: 'department' },
    // Internal Audit - ONLY RiskRegister page (NO Settings, NO other audit pages)
    { resource: 'audit.risk-register', actions: ['view'], scope: 'department' },
  ],

  // Department Contributor - Creates/edits within own department (matches UAT exactly)
  DepartmentContributor: [
    // Organization - Dashboard, Context, Users, Process, Reports (NO Profile, NO Settings)
    { resource: 'organization.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'organization.context', actions: ['view'], scope: 'department' },
    { resource: 'organization.users', actions: ['view'], scope: 'department' },
    { resource: 'organization.process', actions: ['view', 'create', 'edit'], scope: 'department' },
    // Compliance - Framework, Control, Governance, Evidence, Exception, KPI, Reports (NO Domain, NO Risk Matrix, NO Settings)
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'compliance.framework', actions: ['view'], scope: 'department' },
    { resource: 'compliance.controls', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.governance', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.evidence', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.exceptions', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.kpi', actions: ['view'], scope: 'department' },
    // Asset Management - Inventory, Classification, Reports (NO Settings)
    { resource: 'asset.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'asset.inventory', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'asset.classification', actions: ['view'], scope: 'department' },
    { resource: 'asset.reports', actions: ['view'], scope: 'department' },
    // Risk Management - Dashboard, Register, Assessment, Response, Reports (NO Settings)
    { resource: 'risk.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'risk.register', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'risk.assessment', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'risk.response', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'risk.reports', actions: ['view'], scope: 'department' },
    // Internal Audit - ONLY RiskRegister (NO Settings)
    { resource: 'audit.risk-register', actions: ['view'], scope: 'department' },
  ],
};

// ==================== ROUTE TO RESOURCE MAPPING ====================
// Maps URL paths to resource identifiers for middleware checks
export function getResourceFromPath(path: string): string | null {
  // Remove trailing slash
  const normalizedPath = path.replace(/\/$/, '');

  // Direct match first
  for (const [resource, resourcePath] of Object.entries(RESOURCES)) {
    if (normalizedPath === resourcePath) {
      return resource;
    }
  }

  // For dynamic routes (e.g., /compliance/framework/[id]),
  // find the LONGEST matching resource path (most specific match)
  let bestMatch: { resource: string; length: number } | null = null;

  for (const [resource, resourcePath] of Object.entries(RESOURCES)) {
    const pathParts = normalizedPath.split('/');
    const resourceParts = resourcePath.split('/');

    // If resource path is shorter, check if it's a parent path
    if (resourceParts.length < pathParts.length) {
      const basePath = pathParts.slice(0, resourceParts.length).join('/');
      if (basePath === resourcePath) {
        // Keep track of the longest (most specific) match
        if (!bestMatch || resourceParts.length > bestMatch.length) {
          bestMatch = { resource, length: resourceParts.length };
        }
      }
    }
  }

  return bestMatch?.resource || null;
}

// ==================== PERMISSION CHECKING HELPERS ====================

export interface UserPermission {
  resource: string;
  action: Action;
  scope: Scope;
}

/**
 * Check if a resource matches a pattern (supports wildcards)
 */
function resourceMatches(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;
  if (pattern === resource) return true;

  // Handle wildcard patterns like 'organization.*'
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return resource.startsWith(prefix + '.');
  }

  return false;
}

/**
 * Expand role permissions to flat permission list
 */
export function expandRolePermissions(roleNames: string[]): UserPermission[] {
  const permissions: UserPermission[] = [];
  const seen = new Set<string>();

  for (const roleName of roleNames) {
    const rolePerms = ROLE_PERMISSIONS[roleName as RoleName];
    if (!rolePerms) continue;

    for (const perm of rolePerms) {
      // Expand wildcard resources
      const resources = perm.resource === '*' || perm.resource.endsWith('.*')
        ? Object.keys(RESOURCES).filter(r => resourceMatches(perm.resource, r))
        : [perm.resource];

      // Expand wildcard actions
      const actions = (perm.actions as string[]).includes('*')
        ? [...ACTIONS]
        : perm.actions as Action[];

      for (const resource of resources) {
        for (const action of actions) {
          const key = `${resource}:${action}:${perm.scope}`;
          if (!seen.has(key)) {
            seen.add(key);
            permissions.push({ resource, action, scope: perm.scope });
          }
        }
      }
    }
  }

  return permissions;
}

/**
 * Check if user has permission for a resource and action
 * Also considers scope (all, department, own)
 */
export function hasPermission(
  userPermissions: UserPermission[],
  resource: string,
  action: Action,
  options?: {
    userDepartmentId?: string;
    resourceDepartmentId?: string;
    resourceOwnerId?: string;
    userId?: string;
  }
): boolean {
  for (const perm of userPermissions) {
    // Check if resource and action match
    if (!resourceMatches(perm.resource, resource)) continue;
    if (perm.action !== action) continue;

    // Check scope
    switch (perm.scope) {
      case 'all':
        return true;
      case 'department':
        if (options?.userDepartmentId && options?.resourceDepartmentId) {
          if (options.userDepartmentId === options.resourceDepartmentId) {
            return true;
          }
        } else {
          // If no department context provided, allow access (for views without specific resource)
          return true;
        }
        break;
      case 'own':
        if (options?.userId && options?.resourceOwnerId) {
          if (options.userId === options.resourceOwnerId) {
            return true;
          }
        }
        break;
    }
  }

  return false;
}

/**
 * Get the most permissive scope for a resource and action
 */
export function getPermissionScope(
  userPermissions: UserPermission[],
  resource: string,
  action: Action
): Scope | null {
  let scope: Scope | null = null;

  for (const perm of userPermissions) {
    if (!resourceMatches(perm.resource, resource)) continue;
    if (perm.action !== action) continue;

    // 'all' is most permissive, then 'department', then 'own'
    if (perm.scope === 'all') return 'all';
    if (perm.scope === 'department' && scope !== 'department') scope = 'department';
    if (perm.scope === 'own' && !scope) scope = 'own';
  }

  return scope;
}

/**
 * Check if user can access a route (for navigation filtering and middleware)
 */
export function canAccessRoute(userPermissions: UserPermission[], path: string): boolean {
  const resource = getResourceFromPath(path);
  if (!resource) return false;

  return hasPermission(userPermissions, resource, 'view');
}
