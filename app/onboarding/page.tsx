import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/onboarding");
  if (user.onboardedAt) redirect("/dashboard");
  return <OnboardingWizard />;
}
