import { redirect } from "next/navigation";

/**
 * TPRM Organization landing — there's no dedicated organization dashboard
 * for TPRM (per BA spec: use the existing TPRM dashboard). Redirect to the
 * Program Monitor which is the customer-admin's TPRM home.
 */
export default function TprmOrganizationLanding() {
  redirect("/tprm/program-monitor");
}
