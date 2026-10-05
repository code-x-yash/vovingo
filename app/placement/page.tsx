import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { PlacementQuiz } from "./placement-quiz";

export default async function PlacementPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/placement");
  return <PlacementQuiz />;
}
