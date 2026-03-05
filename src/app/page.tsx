import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  // If not authenticated, redirect to login page
  if (!session?.user) {
    redirect("/login");
  }

  // Redirect GRCAdmin users to GRC landing page
  if (session?.user?.roles?.includes("GRCAdministrator")) {
    redirect("/grc");
  }

  // Redirect AuditHead users to Internal Audit dashboard
  if (session?.user?.roles?.includes("AuditHead")) {
    redirect("/internal-audit/dashboard");
  }

  // Redirect Auditee users to Fieldwork (they don't have dashboard access)
  if (session?.user?.roles?.includes("Auditee")) {
    redirect("/internal-audit/fieldwork");
  }

  // Redirect AccountManager users to AM Assessments page
  if (session?.user?.roles?.includes("AccountManager")) {
    redirect("/tprm/am-assessments");
  }

  // Redirect BusinessOwner users to BO Dashboard
  if (session?.user?.roles?.includes("BusinessOwner")) {
    redirect("/tprm/bo-dashboard");
  }

  // Redirect RelationshipManager users to RM Dashboard
  if (session?.user?.roles?.includes("RelationshipManager")) {
    redirect("/tprm/rm-dashboard");
  }

  // Redirect TPRM-only users (isTprmAdded=true, isGrcAdded=false) to Program Monitor
  if (session?.user?.isTprmAdded && !session?.user?.isGrcAdded) {
    redirect("/tprm/program-monitor");
  }

  redirect("/dashboard");
}
