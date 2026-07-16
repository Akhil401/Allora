import { redirect } from "next/navigation";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseLessonsRepository } from "@/infrastructure/db/repositories/lessons-repository";
import { LearnBrowser } from "@/presentation/components/learn-browser";
import { isAdminEmail } from "@/lib/config/admin";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const ctx = await getRequestContext();
  if (!ctx) redirect("/sign-in");

  const repo = new SupabaseLessonsRepository(ctx.supabase, ctx.userId);
  const [completed, user] = await Promise.all([
    repo.getCompletedIds(),
    ctx.supabase.auth.getUser().then((r) => r.data.user),
  ]);

  return <LearnBrowser completed={completed} isAdmin={isAdminEmail(user?.email)} />;
}
