import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/infrastructure/db/supabase/server";
import { SupabaseConversationRepository } from "@/infrastructure/db/repositories/conversation-repository";

export interface RequestContext {
  supabase: SupabaseClient;
  userId: string;
  repo: SupabaseConversationRepository;
}

/**
 * Resolve the authenticated request context (Supabase client + user + repo) for
 * a Route Handler. Returns null when there is no valid session.
 */
export async function getRequestContext(): Promise<RequestContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    supabase,
    userId: user.id,
    repo: new SupabaseConversationRepository(supabase, user.id),
  };
}
