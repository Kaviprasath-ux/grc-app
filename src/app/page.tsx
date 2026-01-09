import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  // Redirect GRCAdmin users to GRC landing page
  if (session?.user?.roles?.includes("GRCAdministrator")) {
    redirect("/grc");
  }

  // Redirect AuditHead users to Internal Audit dashboard
  if (session?.user?.roles?.includes("AuditHead")) {
    redirect("/internal-audit/dashboard");
  }

  redirect("/dashboard");
}
