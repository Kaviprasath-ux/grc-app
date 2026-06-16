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
  // Email configuration (GRCAdministrator only)
  'grc.email-settings': '/grc/email-settings',
  'grc.email-templates': '/grc/email-templates',
  // Subscription Management (GRCAdministrator only)
  'subscription.pricing': '/subscription/pricing',
  'subscription.bundle-discounts': '/subscription/bundle-discounts',
  'subscription.list': '/subscription/list',
  'subscription.detail': '/subscription/list',
  'subscription.customer-override': '/grc/customer-accounts',

  // Customer-side Subscription portal (CustomerAdministrator)
  'subscription.customer-portal': '/settings/subscription',

  // Organization Module (CustomerAdministrator territory)
  'organization.dashboard': '/organization',
  'organization.profile': '/organization/profile',
  'organization.context': '/organization/context',
  'organization.users': '/organization/users',
  'organization.department': '/organization/department',
  'organization.process': '/organization/process',
  'organization.settings': '/organization/settings',
  'organization.settings.departments': '/organization/settings/departments',
  'organization.settings.services': '/organization/settings/services',
  'organization.settings.bia-categories': '/organization/settings/bia-categories',
  'organization.settings.bia-methodology': '/organization/settings/bia-methodology',
  'organization.settings.bcp-labels': '/organization/settings/bcp-labels',
  'organization.bia': '/organization/settings/bia',

  // Compliance Module
  'compliance.dashboard': '/compliance',
  'compliance.regulatory-intelligence': '/compliance/regulatory-intelligence',
  'compliance.framework': '/compliance/framework',
  'compliance.controls': '/compliance/control',
  'compliance.governance': '/compliance/governance',
  'compliance.evidence': '/compliance/evidence',
  'technical-evidence.account-overview': '/technical-evidence/account-overview',
  'technical-evidence.dashboard': '/technical-evidence/dashboard',
  'technical-evidence.integration-credentials': '/technical-evidence/settings',
  'technical-evidence.organization-profile': '/technical-evidence/organization/profile',
  'technical-evidence.organization-subscription': '/technical-evidence/organization/subscription',
  'compliance.domain': '/compliance/domain',
  'compliance.artifacts': '/compliance/artifacts',
  'compliance.exceptions': '/compliance/exceptions',
  'compliance.kpi': '/compliance/kpi',
  'compliance.risk-matrix': '/compliance/risk-matrix',
  'compliance.settings': '/compliance/settings',

  // QPost Compliance Module
  'qpost-compliance.dashboard': '/qpost-compliance',
  'qpost-compliance.framework': '/qpost-compliance/framework',
  'qpost-compliance.controls': '/qpost-compliance/requirements',
  'qpost-compliance.governance': '/qpost-compliance/governance',
  'qpost-compliance.evidence': '/qpost-compliance/evidence',
  'qpost-compliance.artifacts': '/qpost-compliance/artifacts',
  'qpost-compliance.exceptions': '/qpost-compliance/exceptions',
  'qpost-compliance.kpi': '/qpost-compliance/kpi',
  'qpost-compliance.risk-matrix': '/qpost-compliance/risk-matrix',
  'qpost-compliance.settings': '/qpost-compliance/settings',
  'qpost-compliance.regulatory-intelligence': '/qpost-compliance/regulatory-intelligence',

  // Asset Management Module
  'asset.dashboard': '/asset-management',
  'asset.inventory': '/asset-management/inventory',
  'asset.my-inventory': '/asset-management/my-inventory',
  'asset.classification': '/asset-management/classification',
  'asset.settings': '/asset-management/settings',
  'asset.reports': '/asset-management/reports',

  // Risk Management Module
  'risk.dashboard': '/risk-management',
  'risk.register': '/risk-management/register',
  'risk.assessment': '/risk-management/assessment',
  'risk.response': '/risk-management/response',
  'risk.risk-matrix': '/risks/risk-control-matrix',
  'risk.settings': '/risk-management/settings',
  'risk.reports': '/risk-management/reports',

  // Internal Audit Module
  'audit.account-overview': '/internal-audit/account-overview',
  'audit.dashboard': '/internal-audit/dashboard',
  'audit.auditables': '/internal-audit/audit-universe',
  'audit.risk-identification': '/internal-audit/risk-identification',
  'audit.risk-register': '/internal-audit/risk-register',
  'audit.strategic-plan': '/internal-audit/strategic-plan',
  'audit.operational-plan': '/internal-audit/operational-plan',
  'audit.planning': '/internal-audit/audit-planning',
  'audit.fieldwork': '/internal-audit/fieldwork',
  'audit.reports': '/internal-audit/report',
  'audit.capa': '/internal-audit/capa-tracking',
  'audit.documents': '/internal-audit/document-library',
  'audit.settings': '/internal-audit/settings',
  'audit.risk-universe': '/internal-audit/risk-universe',
  'audit.process': '/internal-audit/organization/process',

  // TPRM Internal IT Team resources
  'tprm.it-issues': '/tprm/it-issues',

  // TPRM Module (Third-Party Risk Management)
  'tprm.account-overview': '/tprm/account-overview',
  'tprm.assessments': '/tprm/assessments',
  'tprm.task-queue': '/tprm/task-queue',
  'tprm.program-monitor': '/tprm/program-monitor',
  'tprm.control-center': '/tprm/control-center',
  'tprm.user-management': '/tprm/user-management',
  'tprm.vendor-management': '/tprm/vendor-management',
  'tprm.reports': '/tprm/reports',
  'tprm.monitoring': '/tprm/monitoring',
  'tprm.configurations': '/tprm/configurations',
  'tprm.master-data': '/tprm/master-data',
  'tprm.settings': '/tprm/settings',
  'tprm.support': '/tprm/support',

  // TPRM Business Owner specific resources
  'tprm.bo-dashboard': '/tprm/bo-dashboard',
  'tprm.bo-assessments': '/tprm/bo-assessments',
  'tprm.bo-user-management': '/tprm/bo-user-management',
  'tprm.bo-inventory': '/tprm/bo-inventory',
  'tprm.bo-reports': '/tprm/bo-reports',
  'tprm.bo-issues': '/tprm/bo-issues',
  'tprm.bo-contracts': '/tprm/bo-contracts',
  'tprm.bo-monitoring': '/tprm/bo-monitoring',
  'tprm.bo-support': '/tprm/bo-support',

  // TPRM Relationship Manager specific resources
  'tprm.rm-dashboard': '/tprm/rm-dashboard',
  'tprm.rm-assessments': '/tprm/rm-assessments',
  'tprm.rm-inventory': '/tprm/rm-inventory',
  'tprm.rm-reports': '/tprm/rm-reports',
  'tprm.rm-issues': '/tprm/rm-issues',
  'tprm.rm-contracts': '/tprm/rm-contracts',
  'tprm.rm-monitoring': '/tprm/rm-monitoring',
  'tprm.rm-support': '/tprm/rm-support',

  // TPRM Account Manager specific resources
  'tprm.am-assessments': '/tprm/am-assessments',
  'tprm.am-follow-ups': '/tprm/am-follow-ups',
  'tprm.am-sme-management': '/tprm/am-sme-management',
  'tprm.am-support': '/tprm/am-support',

  // TPRM Assessor specific resources
  'tprm.asr-dashboard': '/tprm/asr-dashboard',
  'tprm.asr-assessments': '/tprm/asr-assessments',
  'tprm.asr-inventory': '/tprm/asr-inventory',
  'tprm.asr-monitoring': '/tprm/asr-monitoring',
  'tprm.asr-follow-ups': '/tprm/asr-follow-ups',
  'tprm.asr-issue-register': '/tprm/asr-issue-register',
  'tprm.asr-assessment-factory': '/tprm/asr-assessment-factory',
  'tprm.asr-template': '/tprm/asr-template',
  'tprm.asr-support': '/tprm/asr-support',
  'tprm.asr-factory-reports': '/tprm/asr-factory-reports',
  'tprm.factory-user-management': '/tprm/factory-user-management',

  // Support Ticketing Module
  'support.console': '/support/console',
  'support.tickets': '/support/tickets',
  'support.dashboard': '/support/dashboard',
  'support.kb': '/support/kb',
  'support.settings': '/support/settings',
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
  AuditUser: {
    name: 'AuditUser',
    description: 'Basic audit module access',
  },
  AuditManager: {
    name: 'AuditManager',
    description: 'Full Internal Audit access except creating Strategic Plans (view-only); can edit Operational Plans',
  },
  Auditor: {
    name: 'Auditor',
    description: 'Manages audits, assigns auditors, reviews findings, conducts audits',
  },
  Auditee: {
    name: 'Auditee',
    description: 'Limited access to Fieldwork, CAPA Tracking, and Reports only',
  },
  Reviewer: {
    name: 'Reviewer',
    description: 'Reviews and approves compliance, risk, and asset content (no admin access)',
  },
  // NOTE: Contributor role is HIDDEN/DISABLED - not available for user selection in UI
  // Kept in code for backward compatibility with existing users who may have this role
  Contributor: {
    name: 'Contributor',
    description: 'Creates and edits content across modules (DISABLED - use DepartmentContributor instead)',
  },
  DepartmentReviewer: {
    name: 'DepartmentReviewer',
    description: 'Reviews content within own department',
  },
  DepartmentContributor: {
    name: 'DepartmentContributor',
    description: 'Creates/edits content within own department',
  },
  // TPRM Module roles
  // Note: TPRMCustomerAdmin was removed in Phase 7 cleanup. Customer-level
  // TPRM admins now use CustomerAdministrator + moduleCode="TPRM" (Phase 3).
  FactoryAdmin: {
    name: 'FactoryAdmin',
    description: 'Assessment Factory administrator, manages factory users and assessments',
  },
  FactoryAssessor: {
    name: 'FactoryAssessor',
    description: 'Assessment Factory assessor, performs factory assessments',
  },
  TPRMAdmin: {
    name: 'TPRMAdmin',
    description: 'TPRM super administrator, full TPRM module access across all accounts',
  },
  BusinessOwner: {
    name: 'BusinessOwner',
    description: 'Business Owner role in TPRM, manages relationship managers and vendor assessments',
  },
  RelationshipManager: {
    name: 'RelationshipManager',
    description: 'Relationship Manager role in TPRM, manages vendor relationships',
  },
  TPRMAssessor: {
    name: 'TPRMAssessor',
    description: 'Assessor role in TPRM, performs vendor assessments and reviews task queue',
  },
  TPRMApprover: {
    name: 'TPRMApprover',
    description: 'Approver role in TPRM, reviews and approves vendor assessments',
  },
  TPRMAuditor: {
    name: 'TPRMAuditor',
    description: 'Auditor role in TPRM, audits vendor assessments and compliance',
  },
  InternalITTeam: {
    name: 'InternalITTeam',
    description: 'Internal IT Team role in TPRM, manages IT-assigned issue remediations',
  },
  AccountManager: {
    name: 'AccountManager',
    description: 'Vendor-side Account Manager, responds to assessments and manages SMEs',
  },
  TPRMSME: {
    name: 'TPRMSME',
    description: 'Vendor-side Subject Matter Expert, responds to delegated assessment questions',
  },
  // Support Ticketing roles (SOW tiered support: L1 -> L2 -> L3, plus manager)
  SupportAgentL1: {
    name: 'SupportAgentL1',
    description: 'Level 1 support agent — handles and triages tickets assigned to them, escalates to L2',
  },
  SupportSpecialistL2: {
    name: 'SupportSpecialistL2',
    description: 'Level 2 functional/domain specialist — picks up escalations, full ticket access',
  },
  SupportEngineerL3: {
    name: 'SupportEngineerL3',
    description: 'Level 3 engineering support — resolves code/API/infra issues, full ticket access',
  },
  SupportManager: {
    name: 'SupportManager',
    description: 'Support manager — full ticket access, reassignment, and routing-rule settings',
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
    // Email configuration - GRCAdministrator manages email settings for all customers
    { resource: 'grc.email-settings', actions: ['*'], scope: 'all' },
    { resource: 'grc.email-templates', actions: ['*'], scope: 'all' },
    // Subscription Management — GRCAdministrator owns pricing, discounts, all customer subscriptions
    { resource: 'subscription.pricing', actions: ['*'], scope: 'all' },
    { resource: 'subscription.bundle-discounts', actions: ['*'], scope: 'all' },
    { resource: 'subscription.list', actions: ['*'], scope: 'all' },
    { resource: 'subscription.detail', actions: ['*'], scope: 'all' },
    { resource: 'subscription.customer-override', actions: ['*'], scope: 'all' },
    // Compliance module - specific resources only (Frameworks, Controls, Governance, Evidence, Domain)
    { resource: 'compliance.framework', actions: ['*'], scope: 'all' },
    { resource: 'compliance.controls', actions: ['*'], scope: 'all' },
    { resource: 'compliance.governance', actions: ['*'], scope: 'all' },
    { resource: 'compliance.evidence', actions: ['*'], scope: 'all' },
    // Technical Evidence — superadmin sees the cross-tenant account overview only.
    // Customer-facing Dashboard + Credential Vault are intentionally OMITTED:
    // those are per-customer workflow pages, not admin views.
    { resource: 'technical-evidence.account-overview', actions: ['*'], scope: 'all' },
    { resource: 'compliance.domain', actions: ['*'], scope: 'all' },
    // TPRM module - GRCAdministrator only has access to admin-level pages
    { resource: 'tprm.account-overview', actions: ['*'], scope: 'all' },
    { resource: 'tprm.vendor-management', actions: ['view', 'delete'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.task-queue', actions: ['*'], scope: 'all' },
    // Internal Audit module - GRCAdministrator only sees the customer overview
    // (tenant list filtered by isInternalAuditEnabled). They do NOT see the
    // customer-side audit workflow pages — those stay scoped to AuditHead etc.
    { resource: 'audit.account-overview', actions: ['*'], scope: 'all' },
    // NOTE: GRCAdministrator does NOT have access to: Configuration, Master Data, Organization, Asset Management, Risk Management, Internal Audit workflow pages
  ],

  // Customer Administrator - Full access to organization and all other modules (except audit)
  // NOTE: Per UAT, Customer Admin does NOT have approve capability for Risk Response
  // Note: asset.my-inventory is excluded - it's only for DepartmentReviewer/DepartmentContributor
  CustomerAdministrator: [
    { resource: 'organization.*', actions: ['*'], scope: 'all' },
    { resource: 'compliance.*', actions: ['*'], scope: 'all' },
    { resource: 'qpost-compliance.*', actions: ['*'], scope: 'all' },
    // Technical Evidence — its own platform, gated by customer's isTechnicalEvidenceEnabled flag.
    { resource: 'technical-evidence.*', actions: ['*'], scope: 'all' },
    // Customer-side Subscription portal — view and act on own subscription
    { resource: 'subscription.customer-portal', actions: ['*'], scope: 'all' },
    // Asset Management - explicit resources (excluding asset.my-inventory)
    { resource: 'asset.dashboard', actions: ['*'], scope: 'all' },
    { resource: 'asset.inventory', actions: ['*'], scope: 'all' },
    { resource: 'asset.classification', actions: ['*'], scope: 'all' },
    { resource: 'asset.settings', actions: ['*'], scope: 'all' },
    { resource: 'asset.reports', actions: ['*'], scope: 'all' },
    // Risk Management - all actions EXCEPT approve (per UAT: only Reviewers can approve)
    { resource: 'risk.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'risk.register', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.assessment', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.response', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.risk-matrix', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.settings', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.reports', actions: ['view'], scope: 'all' },
    { resource: 'audit.risk-register', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'audit.process', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    // CustomerAdmin can manage audit settings (types, categories, etc.) but NOT access User Management
    { resource: 'audit.settings', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    // TPRM module — gated by moduleCode="TPRM" assignment + customer's isTprmAdded flag
    { resource: 'tprm.program-monitor', actions: ['view'], scope: 'all' },
    { resource: 'tprm.control-center', actions: ['*'], scope: 'all' },
    { resource: 'tprm.user-management', actions: ['*'], scope: 'all' },
    { resource: 'tprm.vendor-management', actions: ['*'], scope: 'all' },
    { resource: 'tprm.reports', actions: ['view'], scope: 'all' },
    { resource: 'tprm.monitoring', actions: ['*'], scope: 'all' },
    { resource: 'tprm.configurations', actions: ['*'], scope: 'all' },
    { resource: 'tprm.master-data', actions: ['*'], scope: 'all' },
    { resource: 'tprm.settings', actions: ['*'], scope: 'all' },
    { resource: 'tprm.support', actions: ['view'], scope: 'all' },
    // Support Ticketing — customer admin manages the whole support function
    { resource: 'support.console', actions: ['*'], scope: 'all' },
    { resource: 'support.tickets', actions: ['*'], scope: 'all' },
    { resource: 'support.dashboard', actions: ['*'], scope: 'all' },
    { resource: 'support.kb', actions: ['*'], scope: 'all' },
    { resource: 'support.settings', actions: ['*'], scope: 'all' },
  ],

  // Audit Head - Full access to Internal Audit module EXCEPT Settings (view-only)
  // Also needs organization.department:view to see department dropdowns in CAPA, Fieldwork, etc.
  AuditHead: [
    { resource: 'audit.dashboard', actions: ['*'], scope: 'all' },
    { resource: 'audit.auditables', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-identification', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-register', actions: ['*'], scope: 'all' },
    { resource: 'audit.process', actions: ['*'], scope: 'all' },
    // Strategic Plan: Head of Audit is the ONLY role that can create strategic plans
    { resource: 'audit.strategic-plan', actions: ['*'], scope: 'all' },
    { resource: 'audit.operational-plan', actions: ['*'], scope: 'all' },
    { resource: 'audit.planning', actions: ['*'], scope: 'all' },
    { resource: 'audit.fieldwork', actions: ['*'], scope: 'all' },
    { resource: 'audit.reports', actions: ['*'], scope: 'all' },
    { resource: 'audit.capa', actions: ['*'], scope: 'all' },
    { resource: 'audit.documents', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-universe', actions: ['*'], scope: 'all' },
    { resource: 'audit.settings', actions: ['view'], scope: 'all' },
    { resource: 'organization.department', actions: ['view'], scope: 'all' },
  ],

  // Audit Manager - Same as Head of Audit, EXCEPT cannot create Strategic Plans (view-only).
  // Can fully edit Operational Plans. Per MOF requirements.
  AuditManager: [
    { resource: 'audit.dashboard', actions: ['*'], scope: 'all' },
    { resource: 'audit.auditables', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-identification', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-register', actions: ['*'], scope: 'all' },
    { resource: 'audit.process', actions: ['*'], scope: 'all' },
    // Strategic Plan: VIEW ONLY (cannot create a new strategic audit plan)
    { resource: 'audit.strategic-plan', actions: ['view'], scope: 'all' },
    // Operational Plan: full edit access
    { resource: 'audit.operational-plan', actions: ['*'], scope: 'all' },
    { resource: 'audit.planning', actions: ['*'], scope: 'all' },
    { resource: 'audit.fieldwork', actions: ['*'], scope: 'all' },
    { resource: 'audit.reports', actions: ['*'], scope: 'all' },
    { resource: 'audit.capa', actions: ['*'], scope: 'all' },
    { resource: 'audit.documents', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-universe', actions: ['*'], scope: 'all' },
    { resource: 'audit.settings', actions: ['view'], scope: 'all' },
    { resource: 'organization.department', actions: ['view'], scope: 'all' },
  ],

  // Audit User - Basic audit access (view-only, NO Dashboard/Settings/Risk Universe per UAT)
  AuditUser: [
    // NO audit.dashboard - only AuditHead and Auditor have dashboard access
    { resource: 'audit.auditables', actions: ['view'], scope: 'all' },
    { resource: 'audit.risk-identification', actions: ['view'], scope: 'all' },
    { resource: 'audit.risk-register', actions: ['view'], scope: 'all' },
    { resource: 'audit.process', actions: ['view'], scope: 'all' },
    { resource: 'audit.planning', actions: ['view'], scope: 'all' },
    { resource: 'audit.fieldwork', actions: ['view'], scope: 'all' },
    { resource: 'audit.reports', actions: ['view'], scope: 'all' },
    { resource: 'audit.capa', actions: ['view'], scope: 'all' },
    { resource: 'audit.documents', actions: ['view'], scope: 'all' },
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
  ],

  // Auditor - Conducts audits (NO Dashboard/Settings/Risk Universe per UAT)
  // Auditor - Same access as former Auditor: full access EXCEPT Settings
  Auditor: [
    { resource: 'audit.dashboard', actions: ['*'], scope: 'all' },
    { resource: 'audit.auditables', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-identification', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-register', actions: ['*'], scope: 'all' },
    { resource: 'audit.process', actions: ['*'], scope: 'all' },
    // Plans: Auditor can VIEW strategic & operational plans (per MOF: view all plans, download MoM)
    { resource: 'audit.strategic-plan', actions: ['view'], scope: 'all' },
    { resource: 'audit.operational-plan', actions: ['view'], scope: 'all' },
    { resource: 'audit.planning', actions: ['*'], scope: 'all' },
    { resource: 'audit.fieldwork', actions: ['*'], scope: 'all' },
    { resource: 'audit.reports', actions: ['*'], scope: 'all' },
    { resource: 'audit.capa', actions: ['*'], scope: 'all' },
    { resource: 'audit.documents', actions: ['*'], scope: 'all' },
    { resource: 'audit.risk-universe', actions: ['*'], scope: 'all' },
    { resource: 'audit.settings', actions: ['view'], scope: 'all' },
    { resource: 'organization.department', actions: ['view'], scope: 'all' },
  ],

  // Auditee - Responds to audits (department-scoped access)
  // STRICT ACCESS: Only Fieldwork, CAPA Tracking, and Reports
  // NO access to: Dashboard, Audit Universe, Risk Identification, Risk Register,
  //               Audit Planning, Document Library, Settings, Risk Universe,
  //               or any other modules (Organization, Compliance, Asset, Risk)
  // Note: organization.department:view is needed for department name lookups in UI
  Auditee: [
    { resource: 'organization.department', actions: ['view'], scope: 'department' },
    { resource: 'audit.fieldwork', actions: ['view', 'edit'], scope: 'department' },
    { resource: 'audit.reports', actions: ['view'], scope: 'department' },
    { resource: 'audit.capa', actions: ['view', 'edit'], scope: 'department' },
  ],

  // Reviewer - Full CRUD same as CustomerAdministrator, but NO access to settings pages
  // Excluded: organization.profile, organization.users, organization.settings,
  //           compliance.settings (Master Data), asset.settings, risk.settings, audit.* (entire module)
  // Note: risk.settings/asset.settings have view-only for dropdown data (categories, groups, etc.)
  Reviewer: [
    // Organization - only dashboard, context, process, departments (NO profile, users, settings)
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'organization.context', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'organization.process', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'organization.department', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    // Compliance - full CRUD (NO settings/Master Data page access)
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'compliance.framework', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'compliance.controls', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'compliance.governance', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'compliance.evidence', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'technical-evidence.dashboard', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'technical-evidence.integration-credentials', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'technical-evidence.organization-profile', actions: ['view', 'edit'], scope: 'all' },
    { resource: 'technical-evidence.organization-subscription', actions: ['view'], scope: 'all' },
    { resource: 'compliance.artifacts', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'compliance.exceptions', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'compliance.kpi', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'compliance.risk-matrix', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    // QPost Compliance - full CRUD
    { resource: 'qpost-compliance.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'qpost-compliance.framework', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'qpost-compliance.controls', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'qpost-compliance.governance', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'qpost-compliance.evidence', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'qpost-compliance.artifacts', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'qpost-compliance.exceptions', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'qpost-compliance.kpi', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'qpost-compliance.risk-matrix', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    // compliance.settings (Master Data) - EXCLUDED from nav, but NO page access
    // Asset Management - full CRUD (NO settings page, but view for dropdown data)
    { resource: 'asset.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'asset.inventory', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'asset.classification', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'asset.reports', actions: ['view'], scope: 'all' },
    { resource: 'asset.settings', actions: ['view'], scope: 'all' }, // View-only for dropdown data (asset groups, types, etc.)
    // Risk Management - full CRUD (NO settings page, but view for dropdown data)
    { resource: 'risk.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'risk.register', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.assessment', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.response', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.risk-matrix', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'risk.settings', actions: ['view'], scope: 'all' }, // View-only for dropdown data (categories, threats, etc.)
    { resource: 'risk.reports', actions: ['view'], scope: 'all' },
    // Internal Audit - NO ACCESS (entire module excluded)
  ],

  // Contributor - Creates and edits across modules
  // NOTE: This role is HIDDEN/DISABLED - not available for selection in UI
  // Permissions kept for backward compatibility with existing users
  Contributor: [
    { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'organization.process', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'compliance.framework', actions: ['view'], scope: 'all' },
    { resource: 'compliance.controls', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.governance', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.evidence', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'technical-evidence.dashboard', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.artifacts', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.exceptions', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.kpi', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'compliance.risk-matrix', actions: ['view'], scope: 'all' },
    // QPost Compliance - create/edit
    { resource: 'qpost-compliance.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'qpost-compliance.framework', actions: ['view'], scope: 'all' },
    { resource: 'qpost-compliance.controls', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'qpost-compliance.governance', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'qpost-compliance.evidence', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'qpost-compliance.artifacts', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'qpost-compliance.exceptions', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'qpost-compliance.kpi', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'qpost-compliance.risk-matrix', actions: ['view'], scope: 'all' },
    { resource: 'risk.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'risk.register', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'risk.assessment', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'risk.response', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'risk.risk-matrix', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'risk.settings', actions: ['view'], scope: 'all' }, // Needed for risk category/threat/vulnerability/cause dropdowns
    { resource: 'asset.dashboard', actions: ['view'], scope: 'all' },
    { resource: 'asset.classification', actions: ['view', 'create', 'edit'], scope: 'all' },
  ],

  // Department Reviewer - Reviews within own department (matches UAT exactly)
  // Has same pages as Reviewer but scoped to department
  // Key workflow: Can APPROVE items submitted for approval (governance, risks, etc.)
  DepartmentReviewer: [
    // Organization - Dashboard, Context, Users, Process, Reports (NO Profile, NO Settings)
    { resource: 'organization.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'organization.context', actions: ['view'], scope: 'department' },
    { resource: 'organization.users', actions: ['view'], scope: 'department' },
    { resource: 'organization.department', actions: ['view'], scope: 'all' }, // Needed for department dropdowns
    { resource: 'organization.process', actions: ['view', 'approve'], scope: 'department' },
    { resource: 'organization.bia', actions: ['view', 'edit', 'approve'], scope: 'department' },
    // Compliance - Framework, Control, Governance, Evidence, Exception, KPI, Reports (NO Domain, NO Settings/Master Data, NO Risk Matrix)
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'compliance.framework', actions: ['view'], scope: 'department' },
    { resource: 'compliance.controls', actions: ['view', 'edit', 'approve'], scope: 'department' },
    { resource: 'compliance.governance', actions: ['view', 'approve'], scope: 'department' },
    { resource: 'compliance.evidence', actions: ['view', 'approve'], scope: 'department' },
    { resource: 'technical-evidence.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'compliance.exceptions', actions: ['view', 'edit', 'approve'], scope: 'department' },
    { resource: 'compliance.kpi', actions: ['view'], scope: 'department' },
    // QPost Compliance - mirrors compliance permissions (only active when isQpostComplianceEnabled=true via module flag filtering)
    { resource: 'qpost-compliance.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'qpost-compliance.framework', actions: ['view'], scope: 'department' },
    { resource: 'qpost-compliance.controls', actions: ['view', 'edit', 'approve'], scope: 'department' },
    { resource: 'qpost-compliance.governance', actions: ['view', 'create', 'edit', 'approve'], scope: 'department' },
    { resource: 'qpost-compliance.evidence', actions: ['view', 'create', 'edit', 'approve'], scope: 'department' },
    { resource: 'qpost-compliance.exceptions', actions: ['view', 'edit', 'approve'], scope: 'department' },
    { resource: 'qpost-compliance.kpi', actions: ['view'], scope: 'department' },
    // Asset Management - My Inventory, Classification, Reports only (NO full Inventory, NO Settings)
    { resource: 'asset.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'asset.my-inventory', actions: ['view', 'create', 'edit', 'delete'], scope: 'own' },
    { resource: 'asset.classification', actions: ['view'], scope: 'department' },
    { resource: 'asset.reports', actions: ['view'], scope: 'department' },
    // Risk Management - Dashboard, Register, Assessment, Response, Reports (NO Settings)
    // Per UAT: Approval workflow exists ONLY in Risk Response Strategy, NOT in Risk Assessment
    // Risk Register/Assessment/Response scoped to 'own' — show only risks where ownerId matches logged-in user
    { resource: 'risk.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'risk.register', actions: ['view', 'create', 'edit', 'delete'], scope: 'own' },
    { resource: 'risk.assessment', actions: ['view', 'create', 'edit', 'delete'], scope: 'own' },
    // DepartmentReviewer can create risk responses since they can create/edit assessments
    // When completing an assessment with non-low risk, a response strategy must be provided
    { resource: 'risk.response', actions: ['view', 'create', 'approve'], scope: 'own' },
    { resource: 'risk.risk-matrix', actions: ['view', 'create', 'edit', 'delete'], scope: 'department' },
    { resource: 'risk.settings', actions: ['view'], scope: 'all' }, // Needed for risk category/threat/vulnerability/cause dropdowns
    { resource: 'risk.reports', actions: ['view'], scope: 'department' },
    // Internal Audit - ONLY RiskRegister page (NO Settings, NO other audit pages)
    { resource: 'audit.risk-register', actions: ['view'], scope: 'department' },
  ],

  // Department Contributor - Creates/edits within own department (matches UAT exactly)
  DepartmentContributor: [
    // Organization - Dashboard, Context, Process, Reports (NO Profile, NO Users, NO Settings)
    { resource: 'organization.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'organization.context', actions: ['view'], scope: 'department' },
    { resource: 'organization.department', actions: ['view'], scope: 'all' }, // Needed for department dropdowns
    { resource: 'organization.process', actions: ['view', 'create', 'edit'], scope: 'department' },
    // Compliance - Framework, Control, Governance, Evidence, Exception, KPI, Reports (NO Domain, NO Risk Matrix, NO Settings)
    { resource: 'compliance.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'compliance.framework', actions: ['view', 'create', 'edit', 'delete'], scope: 'department' },
    { resource: 'compliance.controls', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.governance', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.evidence', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'technical-evidence.dashboard', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.exceptions', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'compliance.kpi', actions: ['view'], scope: 'department' },
    // QPost Compliance - mirrors compliance permissions (only active when isQpostComplianceEnabled=true via module flag filtering)
    { resource: 'qpost-compliance.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'qpost-compliance.framework', actions: ['view', 'create', 'edit', 'delete'], scope: 'department' },
    { resource: 'qpost-compliance.controls', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'qpost-compliance.governance', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'qpost-compliance.evidence', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'qpost-compliance.exceptions', actions: ['view', 'create', 'edit'], scope: 'department' },
    { resource: 'qpost-compliance.kpi', actions: ['view'], scope: 'department' },
    // Asset Management - My Inventory, Classification, Reports only (NO full Inventory, NO Settings)
    { resource: 'asset.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'asset.my-inventory', actions: ['view', 'create', 'edit', 'delete'], scope: 'own' },
    { resource: 'asset.classification', actions: ['view'], scope: 'department' },
    { resource: 'asset.reports', actions: ['view'], scope: 'department' },
    // Risk Management - Same as CustomerAdmin but scoped to department (NO Risk Control Matrix, NO Settings)
    { resource: 'risk.dashboard', actions: ['view'], scope: 'department' },
    { resource: 'risk.register', actions: ['view', 'create', 'edit', 'delete'], scope: 'department' },
    { resource: 'risk.assessment', actions: ['view', 'create', 'edit', 'delete'], scope: 'department' },
    { resource: 'risk.response', actions: ['view', 'create', 'edit', 'delete'], scope: 'department' },
    { resource: 'risk.settings', actions: ['view'], scope: 'all' }, // Needed for risk category/threat/vulnerability/cause dropdowns
    { resource: 'risk.reports', actions: ['view'], scope: 'department' },
    // Internal Audit - ONLY RiskRegister (NO Settings)
    { resource: 'audit.risk-register', actions: ['view'], scope: 'department' },
  ],

  // Factory Admin - Assessment Factory + user management (can create FactoryAssessor users)
  FactoryAdmin: [
    { resource: 'tprm.factory-user-management', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-assessment-factory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-factory-reports', actions: ['*'], scope: 'all' },
  ],

  // Factory Assessor - Assessment Factory + reports (no user management)
  FactoryAssessor: [
    { resource: 'tprm.asr-assessment-factory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-factory-reports', actions: ['view'], scope: 'all' },
  ],

  // TPRM Admin - Super admin level, only admin-level pages (not customer admin pages)
  TPRMAdmin: [
    { resource: 'tprm.account-overview', actions: ['*'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.task-queue', actions: ['*'], scope: 'all' },
  ],

  // Business Owner - Business Owner role with 9 dedicated BO pages
  // Also needs tprm.user-management for the BO User Management page (reuses same API)
  BusinessOwner: [
    { resource: 'tprm.bo-dashboard', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-user-management', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-inventory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-reports', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-issues', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-contracts', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-monitoring', actions: ['*'], scope: 'all' },
    { resource: 'tprm.bo-support', actions: ['*'], scope: 'all' },
    { resource: 'tprm.master-data', actions: ['view'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['view', 'create', 'edit'], scope: 'all' },
  ],

  // Relationship Manager - Same menu as BusinessOwner except User Management
  RelationshipManager: [
    { resource: 'tprm.rm-dashboard', actions: ['*'], scope: 'all' },
    { resource: 'tprm.rm-assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.rm-inventory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.rm-reports', actions: ['*'], scope: 'all' },
    { resource: 'tprm.rm-issues', actions: ['*'], scope: 'all' },
    { resource: 'tprm.rm-contracts', actions: ['*'], scope: 'all' },
    { resource: 'tprm.rm-monitoring', actions: ['*'], scope: 'all' },
    { resource: 'tprm.rm-support', actions: ['*'], scope: 'all' },
    { resource: 'tprm.master-data', actions: ['view'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['view', 'create', 'edit'], scope: 'all' },
  ],

  // TPRM Assessor - Full assessor role with dashboard, assessments, inventory, monitoring, etc.
  TPRMAssessor: [
    { resource: 'tprm.asr-dashboard', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-inventory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-monitoring', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-follow-ups', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-issue-register', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-assessment-factory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-template', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-support', actions: ['*'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['view', 'edit'], scope: 'all' },
  ],

  // TPRM Approver - Same workspace as Assessor (no task-queue/assessments workspace)
  TPRMApprover: [
    { resource: 'tprm.asr-dashboard', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-inventory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-monitoring', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-follow-ups', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-issue-register', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-assessment-factory', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-template', actions: ['*'], scope: 'all' },
    { resource: 'tprm.asr-support', actions: ['*'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['view', 'edit', 'approve'], scope: 'all' },
  ],

  // TPRM Auditor - Read-only access to all assessor workspace pages
  TPRMAuditor: [
    { resource: 'tprm.asr-dashboard', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-assessments', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-inventory', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-monitoring', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-follow-ups', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-issue-register', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-template', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-support', actions: ['view'], scope: 'all' },
    { resource: 'tprm.asr-factory-reports', actions: ['view'], scope: 'all' },
    { resource: 'tprm.reports', actions: ['view'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['view'], scope: 'all' },
  ],

  // Internal IT Team - IT-assigned issue management
  InternalITTeam: [
    { resource: 'tprm.it-issues', actions: ['*'], scope: 'all' },
  ],

  // Account Manager - Vendor-side role with 4 dedicated pages
  AccountManager: [
    { resource: 'tprm.am-assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.am-follow-ups', actions: ['*'], scope: 'all' },
    { resource: 'tprm.am-sme-management', actions: ['*'], scope: 'all' },
    { resource: 'tprm.am-support', actions: ['*'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['view', 'edit'], scope: 'all' },
  ],

  // SME - Same as Account Manager but without SME Management page
  TPRMSME: [
    { resource: 'tprm.am-assessments', actions: ['*'], scope: 'all' },
    { resource: 'tprm.am-follow-ups', actions: ['*'], scope: 'all' },
    { resource: 'tprm.am-support', actions: ['*'], scope: 'all' },
    { resource: 'tprm.assessments', actions: ['view'], scope: 'all' },
  ],

  // ===== Support Ticketing roles =====
  // L1 — works their own queue: sees the console and tickets, can create/edit
  // but only the ones assigned to / reported by them (scope 'own').
  SupportAgentL1: [
    { resource: 'support.console', actions: ['view'], scope: 'all' },
    { resource: 'support.tickets', actions: ['view', 'create', 'edit'], scope: 'own' },
    { resource: 'support.dashboard', actions: ['view'], scope: 'all' },
  ],
  // L2 — full ticket access across the tenant (handles escalations).
  SupportSpecialistL2: [
    { resource: 'support.console', actions: ['view'], scope: 'all' },
    { resource: 'support.tickets', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'support.dashboard', actions: ['view'], scope: 'all' },
  ],
  // L3 — full ticket access; engineering tier.
  SupportEngineerL3: [
    { resource: 'support.console', actions: ['view'], scope: 'all' },
    { resource: 'support.tickets', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'support.dashboard', actions: ['view'], scope: 'all' },
  ],
  // Manager — everything, including KB authoring, routing-rule settings and deletes.
  SupportManager: [
    { resource: 'support.console', actions: ['*'], scope: 'all' },
    { resource: 'support.tickets', actions: ['*'], scope: 'all' },
    { resource: 'support.dashboard', actions: ['*'], scope: 'all' },
    { resource: 'support.kb', actions: ['*'], scope: 'all' },
    { resource: 'support.settings', actions: ['*'], scope: 'all' },
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
 * Module flag options for filtering permissions.
 * When provided, TPRM resources are excluded if isTprmAdded=false,
 * and GRC/organization resources are excluded if isGrcAdded=false.
 * GRCAdministrator and TPRMAdmin roles ignore these flags (system-level roles).
 *
 * Four-platform model: audit.* gates on isInternalAuditEnabled, organization/
 * compliance/asset/risk.* gate on isGrcAdded, tprm.* gates on isTprmAdded,
 * technical-evidence.* gates on isTechnicalEvidenceEnabled.
 */
interface ModuleFlags {
  isGrcAdded?: boolean;
  isTprmAdded?: boolean;
  isQpostComplianceEnabled?: boolean;
  isInternalAuditEnabled?: boolean;
  isTechnicalEvidenceEnabled?: boolean;
}

/**
 * Check if a resource belongs to the TPRM module
 */
function isTprmResource(resource: string): boolean {
  return resource.startsWith('tprm.');
}

/**
 * Check if a resource belongs to the Internal Audit module
 */
function isInternalAuditResource(resource: string): boolean {
  return resource.startsWith('audit.');
}

/**
 * Check if a resource belongs to the Technical Evidence module (4th platform).
 */
function isTechnicalEvidenceResource(resource: string): boolean {
  return resource.startsWith('technical-evidence.');
}

/**
 * GRC-only resources (excluding audit.*, which is gated separately via
 * isInternalAuditEnabled, AND excluding organization.*, which is now
 * cross-cutting per the BA spec for the four-platform model — TPRM-only,
 * IA-only, and TECHNICAL_EVIDENCE-only customers also need access to
 * Organization).
 */
function isGrcOnlyResource(resource: string): boolean {
  return (
    resource.startsWith('compliance.') ||
    resource.startsWith('qpost-compliance.') ||
    resource.startsWith('asset.') ||
    resource.startsWith('risk.')
  );
}

/**
 * Expand role permissions to flat permission list.
 * Optionally filters by module flags (isGrcAdded / isTprmAdded) for CustomerAdministrator.
 */
export function expandRolePermissions(
  roleNames: string[],
  moduleFlags?: ModuleFlags
): UserPermission[] {
  const permissions: UserPermission[] = [];
  const seen = new Set<string>();

  // System-level roles are not filtered by module flags
  const isSystemRole = roleNames.some(r =>
    r === 'GRCAdministrator' || r === 'TPRMAdmin' || r === 'FactoryAdmin' || r === 'FactoryAssessor' || r === 'BusinessOwner' || r === 'RelationshipManager' || r === 'TPRMAssessor' || r === 'TPRMApprover' || r === 'TPRMAuditor' || r === 'AccountManager' || r === 'TPRMSME' || r === 'InternalITTeam'
  );

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
        // Apply module flag filtering for non-system roles.
        // Four-platform model: each module gated by its own flag.
        if (!isSystemRole && moduleFlags) {
          if (!moduleFlags.isTprmAdded && isTprmResource(resource)) continue;
          if (!moduleFlags.isInternalAuditEnabled && isInternalAuditResource(resource)) continue;
          if (!moduleFlags.isTechnicalEvidenceEnabled && isTechnicalEvidenceResource(resource)) continue;
          if (!moduleFlags.isGrcAdded && isGrcOnlyResource(resource)) continue;

          if (!moduleFlags.isQpostComplianceEnabled && resource.startsWith('qpost-compliance.')) continue;
          if (moduleFlags.isQpostComplianceEnabled && resource.startsWith('compliance.')) continue;
        }

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
        } else {
          // If no ownership context provided, allow access (for navigation filtering)
          return true;
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
