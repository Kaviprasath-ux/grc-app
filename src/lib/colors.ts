/**
 * GRC Enterprise Design Tokens
 * Source: grc-design-tokens.json
 *
 * This file provides TypeScript constants for all design tokens used in the GRC application.
 * Use these constants for programmatic access to colors (e.g., in charts, dynamic styling).
 *
 * Tailwind CSS Classes Available:
 * - Primary: bg-primary-indigo-50 to bg-primary-indigo-950
 * - Neutral: bg-neutral-slate-50 to bg-neutral-slate-950
 * - Risk: bg-risk-critical, bg-risk-critical-bg, bg-risk-high, bg-risk-high-bg, etc.
 * - Compliance: bg-compliance-compliant, bg-compliance-compliant-bg, etc.
 * - Semantic: bg-semantic-success, bg-semantic-success-light, bg-semantic-success-dark, etc.
 * - Chart: bg-chart-1 to bg-chart-8
 * - Surface: bg-surface-primary, bg-surface-secondary, bg-surface-tertiary
 * - Border: border-border-light, border-border-default, border-border-dark, border-border-focus
 * - Text: text-text-primary, text-text-secondary, text-text-muted, text-text-inverted, text-text-link
 * - Shadows: shadow-card, shadow-card-hover, shadow-elevated, shadow-modal
 */

// ============================================
// PRIMARY - Indigo (Sophisticated & Authoritative)
// ============================================
export const primary = {
  indigo: {
    50: '#EEF2FF',   // Lightest - backgrounds, hover states
    100: '#E0E7FF',  // Light backgrounds
    200: '#C7D2FE',  // Borders, dividers
    300: '#A5B4FC',  // Disabled states
    400: '#818CF8',  // Icons, secondary elements
    500: '#6366F1',  // Default primary
    600: '#4F46E5',  // Buttons, links (recommended)
    700: '#4338CA',  // Hover states
    800: '#3730A3',  // Active/pressed states
    900: '#312E81',  // Dark text on light backgrounds
    950: '#1E1B4B',  // Darkest - rare use
  },
} as const;

// ============================================
// NEUTRAL - Slate (UI Elements)
// ============================================
export const neutral = {
  slate: {
    50: '#F8FAFC',   // Page background
    100: '#F1F5F9',  // Card backgrounds, secondary surfaces
    200: '#E2E8F0',  // Borders, dividers
    300: '#CBD5E1',  // Disabled borders
    400: '#94A3B8',  // Placeholder text, muted icons
    500: '#64748B',  // Secondary text
    600: '#475569',  // Body text
    700: '#334155',  // Headings
    800: '#1E293B',  // Primary text
    900: '#0F172A',  // High emphasis text
    950: '#020617',  // Maximum contrast
  },
} as const;

// ============================================
// RISK LEVELS
// ============================================
export const risk = {
  critical: '#DC2626',
  'critical-bg': '#FEE2E2',
  high: '#EA580C',
  'high-bg': '#FFEDD5',
  medium: '#F59E0B',
  'medium-bg': '#FEF3C7',
  low: '#3B82F6',
  'low-bg': '#DBEAFE',
  minimal: '#10B981',
  'minimal-bg': '#D1FAE5',
} as const;

// Risk colors grouped by level
export const riskColors = {
  critical: { main: '#DC2626', bg: '#FEE2E2', text: '#B91C1C' },
  high: { main: '#EA580C', bg: '#FFEDD5', text: '#C2410C' },
  medium: { main: '#F59E0B', bg: '#FEF3C7', text: '#B45309' },
  low: { main: '#3B82F6', bg: '#DBEAFE', text: '#1D4ED8' },
  minimal: { main: '#10B981', bg: '#D1FAE5', text: '#047857' },
} as const;

// ============================================
// COMPLIANCE STATUS
// ============================================
export const compliance = {
  compliant: '#059669',
  'compliant-bg': '#D1FAE5',
  'non-compliant': '#DC2626',
  'non-compliant-bg': '#FEE2E2',
  pending: '#F59E0B',
  'pending-bg': '#FEF3C7',
  'in-progress': '#3B82F6',
  'in-progress-bg': '#DBEAFE',
  'not-applicable': '#6B7280',
  'not-applicable-bg': '#F3F4F6',
} as const;

// Compliance colors grouped by status
export const complianceColors = {
  compliant: { main: '#059669', bg: '#D1FAE5', text: '#047857' },
  'non-compliant': { main: '#DC2626', bg: '#FEE2E2', text: '#B91C1C' },
  pending: { main: '#F59E0B', bg: '#FEF3C7', text: '#B45309' },
  'in-progress': { main: '#3B82F6', bg: '#DBEAFE', text: '#1D4ED8' },
  'not-applicable': { main: '#6B7280', bg: '#F3F4F6', text: '#4B5563' },
} as const;

// ============================================
// SEMANTIC COLORS
// ============================================
export const semantic = {
  success: {
    default: '#10B981',
    light: '#D1FAE5',
    dark: '#047857',
  },
  warning: {
    default: '#F59E0B',
    light: '#FEF3C7',
    dark: '#B45309',
  },
  error: {
    default: '#EF4444',
    light: '#FEE2E2',
    dark: '#B91C1C',
  },
  info: {
    default: '#3B82F6',
    light: '#DBEAFE',
    dark: '#1D4ED8',
  },
} as const;

// ============================================
// CHART / DATA VISUALIZATION
// ============================================
export const chart = {
  1: '#6366F1',  // Indigo (Primary data)
  2: '#8B5CF6',  // Purple
  3: '#06B6D4',  // Cyan
  4: '#10B981',  // Emerald
  5: '#F59E0B',  // Amber
  6: '#EF4444',  // Red
  7: '#EC4899',  // Pink
  8: '#14B8A6',  // Teal
} as const;

// Chart colors as array for easy iteration
export const chartColors = [
  '#6366F1',
  '#8B5CF6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#14B8A6',
] as const;

// ============================================
// SURFACE & BACKGROUND
// ============================================
export const surface = {
  primary: '#FFFFFF',    // White - cards, modals
  secondary: '#F8FAFC',  // Off-white - page background
  tertiary: '#F1F5F9',   // Light gray - nested sections
} as const;

// ============================================
// BORDER COLORS
// ============================================
export const border = {
  light: '#E2E8F0',    // Subtle borders
  default: '#CBD5E1',  // Default borders
  dark: '#94A3B8',     // Emphasized borders
  focus: '#6366F1',    // Focus rings
} as const;

// ============================================
// TEXT COLORS
// ============================================
export const text = {
  primary: '#1E293B',    // Primary text color
  secondary: '#64748B',  // Secondary text color
  muted: '#94A3B8',      // Muted/placeholder text
  inverted: '#FFFFFF',   // Text on dark backgrounds
  link: '#4F46E5',       // Link text color
  'link-hover': '#4338CA', // Link hover color
} as const;

// ============================================
// SHADOWS
// ============================================
export const shadow = {
  card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  elevated: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  modal: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
} as const;

// ============================================
// BORDER RADIUS
// ============================================
export const radius = {
  sm: '0.25rem',      // 4px
  default: '0.375rem', // 6px
  md: '0.5rem',       // 8px
  lg: '0.75rem',      // 12px
  xl: '1rem',         // 16px
  '2xl': '1.5rem',    // 24px
  full: '9999px',     // Fully rounded
} as const;

// ============================================
// TYPOGRAPHY
// ============================================
export const typography = {
  fontFamily: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get risk color based on risk level string
 */
export function getRiskColor(level: string): string {
  const normalizedLevel = level.toLowerCase().replace(/\s+/g, '-');
  const key = normalizedLevel as keyof typeof riskColors;
  return riskColors[key]?.main || riskColors.medium.main;
}

/**
 * Get risk colors with background variant
 */
export function getRiskColors(level: string) {
  const normalizedLevel = level.toLowerCase().replace(/\s+/g, '-');
  const key = normalizedLevel as keyof typeof riskColors;
  return riskColors[key] || riskColors.medium;
}

/**
 * Get compliance color based on status string
 */
export function getComplianceColor(status: string): string {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
  const key = normalizedStatus as keyof typeof complianceColors;
  return complianceColors[key]?.main || complianceColors['not-applicable'].main;
}

/**
 * Get compliance colors with background variant
 */
export function getComplianceColors(status: string) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
  const key = normalizedStatus as keyof typeof complianceColors;
  return complianceColors[key] || complianceColors['not-applicable'];
}

/**
 * Get chart color by index (cycles through available colors)
 */
export function getChartColor(index: number): string {
  return chartColors[index % chartColors.length];
}

/**
 * Get risk level from score
 */
export function getRiskLevelFromScore(score: number): keyof typeof riskColors {
  if (score >= 20) return 'critical';
  if (score >= 15) return 'high';
  if (score >= 10) return 'medium';
  if (score >= 5) return 'low';
  return 'minimal';
}

/**
 * Get risk color from score
 */
export function getRiskColorFromScore(score: number): string {
  return riskColors[getRiskLevelFromScore(score)].main;
}

/**
 * Get compliance level from percentage
 */
export function getComplianceLevelFromPercentage(percentage: number): keyof typeof complianceColors {
  if (percentage >= 70) return 'compliant';
  if (percentage >= 40) return 'pending';
  return 'non-compliant';
}

/**
 * Get compliance color from percentage
 */
export function getComplianceColorFromPercentage(percentage: number): string {
  return complianceColors[getComplianceLevelFromPercentage(percentage)].main;
}

// ============================================
// TAILWIND CLASS MAPPINGS
// ============================================

/**
 * Get Tailwind classes for risk badge
 */
export function getRiskBadgeClasses(level: string): string {
  const normalizedLevel = level.toLowerCase().replace(/\s+/g, '-');
  const classMap: Record<string, string> = {
    critical: 'bg-risk-critical-bg text-semantic-error-dark',
    high: 'bg-risk-high-bg text-[#C2410C]',
    medium: 'bg-risk-medium-bg text-semantic-warning-dark',
    low: 'bg-risk-low-bg text-semantic-info-dark',
    minimal: 'bg-risk-minimal-bg text-semantic-success-dark',
  };
  return classMap[normalizedLevel] || classMap.medium;
}

/**
 * Get Tailwind classes for compliance badge
 */
export function getComplianceBadgeClasses(status: string): string {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
  const classMap: Record<string, string> = {
    compliant: 'bg-compliance-compliant-bg text-semantic-success-dark',
    'non-compliant': 'bg-compliance-non-compliant-bg text-semantic-error-dark',
    pending: 'bg-compliance-pending-bg text-semantic-warning-dark',
    'in-progress': 'bg-compliance-in-progress-bg text-semantic-info-dark',
    'not-applicable': 'bg-compliance-not-applicable-bg text-neutral-slate-600',
  };
  return classMap[normalizedStatus] || classMap['not-applicable'];
}

// ============================================
// EXPORT ALL TOKENS AS SINGLE OBJECT
// ============================================
export const designTokens = {
  primary,
  neutral,
  risk,
  riskColors,
  compliance,
  complianceColors,
  semantic,
  chart,
  chartColors,
  surface,
  border,
  text,
  shadow,
  radius,
  typography,
} as const;

export default designTokens;
