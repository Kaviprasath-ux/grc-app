/**
 * V2 contract enforcement rules.
 *
 * The 2-year lock-in is the headline policy: customers cannot cancel a module
 * subscription before contractEndDate. They CAN queue a cancellation by
 * setting cancellationRequestedAt; the plan-transitions cron processes those
 * once the contract ends.
 *
 * V1 rows have contractEndDate=null and are unaffected — these helpers all
 * return permissive answers for V1 (no contract → no lock-in).
 *
 * Pure functions, no DB calls.
 */

import { isInLockInPeriod, type ContractBearer } from "@/lib/subscription-status";

export interface CancelEligibility {
  /** True if the customer can cancel right now and have it take effect. */
  canCancelNow: boolean;
  /**
   * True if cancellation cannot happen yet but can be queued (V2 lock-in).
   * Mutually exclusive with canCancelNow when contractEndDate is set.
   */
  canQueueCancellation: boolean;
  /** Date when cancellation will be available — null when canCancelNow=true. */
  availableOn: Date | null;
  /** UI-friendly reason string. */
  reason: string;
}

/**
 * Decide what cancellation operation is permitted for a ModuleSubscription
 * right now. V1 rows always return canCancelNow=true (no contract dates).
 */
export function getCancelEligibility(
  ms: ContractBearer & { cancelledAt?: Date | null; cancellationRequestedAt?: Date | null },
  now: Date = new Date(),
): CancelEligibility {
  if (ms.cancelledAt) {
    return {
      canCancelNow: false,
      canQueueCancellation: false,
      availableOn: null,
      reason: "Already cancelled",
    };
  }
  if (ms.cancellationRequestedAt) {
    return {
      canCancelNow: false,
      canQueueCancellation: false,
      availableOn: ms.contractEndDate ?? null,
      reason: "Cancellation already queued — will process at contract end",
    };
  }
  if (isInLockInPeriod(ms, now)) {
    return {
      canCancelNow: false,
      canQueueCancellation: true,
      availableOn: ms.contractEndDate ?? null,
      reason: "2-year contract lock-in — cancellation can be queued",
    };
  }
  return {
    canCancelNow: true,
    canQueueCancellation: false,
    availableOn: null,
    reason: "Eligible",
  };
}

/**
 * Whether queued-cancellation processing should fire NOW for this module.
 * Returns true only when the customer queued cancellation AND the contract
 * has ended AND the module isn't already cancelled. Used by the cron.
 */
export function shouldProcessQueuedCancellation(
  ms: ContractBearer & { cancelledAt?: Date | null; cancellationRequestedAt?: Date | null },
  now: Date = new Date(),
): boolean {
  if (!ms.cancellationRequestedAt) return false;
  if (ms.cancelledAt) return false;
  if (!ms.contractEndDate) return false; // safeguard: V1 rows don't queue
  return now >= ms.contractEndDate;
}
