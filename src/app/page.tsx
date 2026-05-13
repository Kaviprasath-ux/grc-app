import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { moduleHomeForRoles, type ModuleCode } from "@/lib/url-module-map";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];

  // GRCAdministrator always lands on the super-admin home — they don't use
  // the workspace picker.
  if (roles.includes("GRCAdministrator")) {
    redirect("/grc");
  }

  // Compute available workspaces — subscription ∩ user-has-role-in-module.
  // Route by count: 0 → subscription-required, 1 → role-specific home,
  // 2+ → picker.
  const subscribed = new Set<ModuleCode>();
  if (session.user.isGrcAdded) subscribed.add("GRC");
  if (session.user.isInternalAuditEnabled) subscribed.add("INTERNAL_AUDIT");
  if (session.user.isTprmAdded) subscribed.add("TPRM");
  const userRoleModules = new Set(session.user.roleModules ?? []);
  const available = (["GRC", "INTERNAL_AUDIT", "TPRM"] as ModuleCode[]).filter(
    (m) => subscribed.has(m) && userRoleModules.has(m),
  );

  if (available.length === 0) {
    redirect("/subscription-required");
  }
  if (available.length === 1) {
    redirect(moduleHomeForRoles(available[0], roles));
  }
  redirect("/select-module");
}
