import { redirect } from "next/navigation";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { isAdminEmail } from "@/lib/config/admin";
import { AdminUsage } from "@/presentation/components/admin-usage";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await getRequestContext();
  if (!ctx) redirect("/sign-in");
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) redirect("/dashboard");

  return <AdminUsage />;
}
