import { redirect } from "next/navigation";

/**
 * V1 Signup page - now redirects to V2
 * The V2 signup flow at /signup/v2 handles all signup functionality
 */
export default function SignupPage() {
  redirect("/signup/v2");
}
