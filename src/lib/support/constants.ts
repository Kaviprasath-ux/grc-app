/**
 * Support Ticketing — shared constants.
 *
 * Single source of truth for the allowed string values (priority, severity,
 * tier, status, channel) and the SLA targets per priority. Kept as plain
 * string unions to match the schema convention (String columns with inline
 * allowed-value comments rather than Prisma enums).
 *
 * SLA targets are derived from the SOW §10 "SLA Summary" matrix.
 */

export const TICKET_PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];

export const TICKET_TIERS = ['L1', 'L2', 'L3', 'L4'] as const;
export type TicketTier = (typeof TICKET_TIERS)[number];

export const TICKET_STATUSES = [
  'New',
  'Open',
  'In Progress',
  'Pending Customer',
  'Resolved',
  'Closed',
  'Reopened',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Statuses that count as "still needs work" for SLA / queue purposes. */
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  'New',
  'Open',
  'In Progress',
  'Pending Customer',
  'Reopened',
];

export const TICKET_CHANNELS = ['InApp', 'Chatbot', 'Email', 'WhatsApp', 'Phone'] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export const ESCALATION_REASONS = ['low_confidence', 'max_exchanges', 'user_requested'] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

/**
 * SLA targets in MINUTES per priority.
 *   - ackMinutes:     time to first acknowledgement
 *   - resolveMinutes: time to resolution / RCA
 * Business-day notions in the SOW are approximated as fixed minute windows so
 * the (later) SLA cron can compare against stored timestamps deterministically.
 */
export const SLA_TARGETS: Record<TicketPriority, { ackMinutes: number; resolveMinutes: number }> = {
  P1: { ackMinutes: 60, resolveMinutes: 4 * 60 }, // 1h ack / 4h resolve
  P2: { ackMinutes: 4 * 60, resolveMinutes: 24 * 60 }, // 4h ack / 24h resolve
  P3: { ackMinutes: 8 * 60, resolveMinutes: 72 * 60 }, // 1 business day ack / 72h resolve
  P4: { ackMinutes: 8 * 60, resolveMinutes: 72 * 60 }, // self-service / 72h resolve
};

/** Default severity implied by a priority (overridable by routing rules / agents). */
export const PRIORITY_TO_SEVERITY: Record<TicketPriority, TicketSeverity> = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

export function isTicketPriority(v: string): v is TicketPriority {
  return (TICKET_PRIORITIES as readonly string[]).includes(v);
}
export function isTicketTier(v: string): v is TicketTier {
  return (TICKET_TIERS as readonly string[]).includes(v);
}
export function isTicketStatus(v: string): v is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(v);
}
export function isTicketChannel(v: string): v is TicketChannel {
  return (TICKET_CHANNELS as readonly string[]).includes(v);
}

/** The next tier up, for escalation. L4 is the ceiling. */
export function nextTier(tier: string): TicketTier {
  switch (tier) {
    case 'L1':
      return 'L2';
    case 'L2':
      return 'L3';
    case 'L3':
      return 'L4';
    default:
      return 'L4';
  }
}
