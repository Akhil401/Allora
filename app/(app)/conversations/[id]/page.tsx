import { redirect } from "next/navigation";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { ChatScreen } from "@/presentation/components/chat-screen";
import type { ChatMessage } from "@/presentation/hooks/use-tutor-stream";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) redirect("/sign-in");

  const { id } = await params;
  const [data, { data: profile }] = await Promise.all([
    ctx.repo.get(id),
    ctx.supabase.from("profiles").select("display_name").maybeSingle(),
  ]);
  if (!data) redirect("/conversations");

  const initialMessages: ChatMessage[] = data.messages
    .filter((m) => m.role === "user" || m.role === "tutor")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "tutor",
      contentIt: m.contentIt,
      contentEn: m.contentEn,
      createdAt: m.createdAt,
      correction: m.correction ?? undefined,
    }));

  return (
    <ChatScreen
      conversationId={id}
      initialMessages={initialMessages}
      userName={profile?.display_name ?? undefined}
      title={data.conversation.title}
    />
  );
}
