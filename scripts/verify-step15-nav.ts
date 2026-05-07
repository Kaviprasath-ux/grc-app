/**
 * Verifies Step 15 wiring:
 *   - GRCAdministrator has the 5 subscription.* permissions
 *   - Nav contains the 3 new sub-items under "GRC"
 *   - filterNavigationByPermissions surfaces them for a GRCAdministrator
 *
 * Run: npx tsx scripts/verify-step15-nav.ts
 */

import { expandRolePermissions, RESOURCES } from "@/lib/permissions";
import { navigation, filterNavigationByPermissionsAndRole } from "@/lib/navigation";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

// ── Resources registered ──
console.log("Resources");
const expectedResources = [
  "subscription.pricing",
  "subscription.bundle-discounts",
  "subscription.list",
  "subscription.detail",
  "subscription.customer-override",
];
for (const r of expectedResources) {
  assert(r in RESOURCES, `${r} registered in RESOURCES`);
}

// ── GRCAdministrator permissions ──
console.log("\nGRCAdministrator permission expansion");
const perms = expandRolePermissions(["GRCAdministrator"], {
  isGrcAdded: true, isTprmAdded: false, isInternalAuditEnabled: false, isQpostComplianceEnabled: false,
});
const subscriptionPerms = perms.filter((p) => p.resource.startsWith("subscription."));
assert(subscriptionPerms.length >= 5, `at least 5 subscription perms (got ${subscriptionPerms.length})`);

const hasView = (resource: string) =>
  subscriptionPerms.some((p) => p.resource === resource && p.action === "view");
assert(hasView("subscription.pricing"), "GRCAdmin can view pricing");
assert(hasView("subscription.bundle-discounts"), "GRCAdmin can view bundle discounts");
assert(hasView("subscription.list"), "GRCAdmin can view all subscriptions");
assert(hasView("subscription.detail"), "GRCAdmin can view subscription detail");
assert(hasView("subscription.customer-override"), "GRCAdmin can view customer override");

const hasEdit = (resource: string) =>
  subscriptionPerms.some((p) => p.resource === resource && p.action === "edit");
assert(hasEdit("subscription.pricing"), "GRCAdmin can edit pricing");
assert(hasEdit("subscription.detail"), "GRCAdmin can edit subscription detail (extend, cancel, grant comp)");

// ── Navigation tree ──
console.log("\nNavigation tree");
const grcSection = navigation.find((n) => n.name === "GRC");
assert(grcSection !== undefined, "GRC section exists in navigation");
const subscriptionSection = navigation.find((n) => n.name === "Subscription");
assert(subscriptionSection !== undefined, "Subscription section exists in navigation");
const subPricing = subscriptionSection?.children?.find((c) => c.name === "Subscription Pricing");
const bundleDiscounts = subscriptionSection?.children?.find((c) => c.name === "Bundle Discounts");
const allSubs = subscriptionSection?.children?.find((c) => c.name === "All Subscriptions");
assert(subPricing !== undefined, "Subscription Pricing nav item present");
assert(subPricing?.href === "/subscription/pricing", "Subscription Pricing href correct");
assert(bundleDiscounts !== undefined, "Bundle Discounts nav item present");
assert(bundleDiscounts?.href === "/subscription/bundle-discounts", "Bundle Discounts href correct");
assert(allSubs !== undefined, "All Subscriptions nav item present");
assert(allSubs?.href === "/subscription/list", "All Subscriptions href correct");

// ── filterNavigationByPermissionsAndRole shows them for GRCAdmin ──
console.log("\nFilter for GRCAdministrator");
const filtered = filterNavigationByPermissionsAndRole(
  navigation,
  perms,
  ["GRCAdministrator"],
  { isGrcAdded: true, isTprmAdded: false, isInternalAuditEnabled: false, isQpostComplianceEnabled: false }
);
const grcNav = filtered.find((n) => n.name === "GRC");
assert(grcNav !== undefined, "GRC section visible to GRCAdmin");
const visibleNames = (grcNav?.children ?? []).map((c) => c.name);
assert(visibleNames.includes("Subscription Pricing"), "Subscription Pricing visible to GRCAdmin");
assert(visibleNames.includes("Bundle Discounts"), "Bundle Discounts visible to GRCAdmin");
assert(visibleNames.includes("All Subscriptions"), "All Subscriptions visible to GRCAdmin");

// ── A regular CustomerAdministrator should NOT see the subscription items ──
console.log("\nFilter for CustomerAdministrator (should NOT see subscription admin pages)");
const custPerms = expandRolePermissions(["CustomerAdministrator"], {
  isGrcAdded: true, isTprmAdded: true, isInternalAuditEnabled: true, isQpostComplianceEnabled: false,
});
const custFiltered = filterNavigationByPermissionsAndRole(
  navigation,
  custPerms,
  ["CustomerAdministrator"],
  { isGrcAdded: true, isTprmAdded: true, isInternalAuditEnabled: true, isQpostComplianceEnabled: false }
);
const custGrc = custFiltered.find((n) => n.name === "GRC");
const custVisible = custGrc?.children?.map((c) => c.name) ?? [];
assert(!custVisible.includes("Subscription Pricing"), "CustomerAdmin does NOT see Subscription Pricing");
assert(!custVisible.includes("Bundle Discounts"), "CustomerAdmin does NOT see Bundle Discounts");
assert(!custVisible.includes("All Subscriptions"), "CustomerAdmin does NOT see All Subscriptions");

console.log(`\n${pass} passed · ${fail} failed`);
if (fail > 0) process.exit(1);
