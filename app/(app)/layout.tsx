import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infrastructure/db/supabase/server";
import { AppNav } from "@/presentation/components/app-nav";
import { ActivityTracker } from "@/presentation/components/activity-tracker";

/**
 * Authenticated area layout. Responsive: a left sidebar reserves space on
 * desktop (md:pl-56); the content column is centered and widened. Middleware
 * already redirects unauthenticated users; this is defense-in-depth.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-dvh md:pl-56">
      <ActivityTracker />
      <AppNav email={user.email ?? ""} />
      <main className="animate-fade-in w-full px-4 pb-24 pt-4 sm:px-6 md:pb-10 md:pt-6 lg:px-10 xl:px-16 2xl:px-24">
        {children}
      </main>
    </div>
  );
}
