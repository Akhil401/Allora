import { redirect } from "next/navigation";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { ConversationsList } from "@/presentation/components/conversations-list";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const ctx = await getRequestContext();
  if (!ctx) redirect("/sign-in");

  const conversations = await ctx.repo.list();
  return <ConversationsList initial={conversations} />;
}
