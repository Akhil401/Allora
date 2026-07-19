"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  GraduationCap,
  MessageCircle,
  Mic,
  Layers,
  BookMarked,
  Settings as SettingsIcon,
  Car,
  BookOpen,
  ListChecks,
  ClipboardCheck,
  BarChart3,
  Languages,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
}

const ITALIAN_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/conversations", label: "Chat", icon: MessageCircle },
  { href: "/talk", label: "Talk", icon: Mic, highlight: true },
  { href: "/review", label: "Review", icon: Layers },
  { href: "/vocabulary", label: "Words", icon: BookMarked },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const PATENTE_LINKS: NavLink[] = [
  { href: "/patente", label: "Home", icon: Home },
  { href: "/patente/theory", label: "Theory", icon: BookOpen },
  { href: "/patente/practice", label: "Practice", icon: ListChecks },
  { href: "/patente/exam", label: "Exam", icon: ClipboardCheck },
  { href: "/patente/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Responsive navigation with a top-level MODE switch: the app runs as two
 * "apps" under one login — Italian tutor (Allora) and Patente (driving-licence
 * quizzes). The current mode is derived from the path (/patente/* = patente).
 */
export function AppNav({ email }: { email: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/patente" ? pathname === "/patente" : pathname === href || pathname.startsWith(`${href}/`);

  const patenteMode = pathname.startsWith("/patente");
  const links = patenteMode ? PATENTE_LINKS : ITALIAN_LINKS;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r bg-background/80 p-4 backdrop-blur md:flex">
        <Link href={patenteMode ? "/patente" : "/dashboard"} className="mb-3 flex items-center gap-2 px-2 py-1 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-soft">
            {patenteMode ? <Car className="h-4 w-4" /> : "A"}
          </span>
          <span>{patenteMode ? "Patente" : <>All<span className="text-gradient">ora</span></>}</span>
        </Link>

        <ModeSwitch patenteMode={patenteMode} />

        <nav className="mt-3 flex flex-1 flex-col gap-1">
          {links.map(({ href, label, icon: Icon, highlight }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", active && "scale-110")} />
                {label}
                {highlight && !active ? (
                  <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                    Try
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-2 border-t pt-3">
          <UserMenu email={email} variant="sidebar" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link href={patenteMode ? "/patente" : "/dashboard"} className="flex items-center gap-2 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
            {patenteMode ? <Car className="h-4 w-4" /> : "A"}
          </span>
        </Link>
        <ModeSwitch patenteMode={patenteMode} compact />
        <UserMenu email={email} variant="bar" />
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {links.map(({ href, label, icon: Icon, highlight }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "press relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-primary/10",
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                {highlight && !active ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 py-px text-[7px] font-bold uppercase leading-none text-primary-foreground">
                    Try
                  </span>
                ) : null}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Segmented Italian ↔ Patente switch. Navigates to the chosen mode's home. */
function ModeSwitch({ patenteMode, compact }: { patenteMode: boolean; compact?: boolean }) {
  const router = useRouter();
  return (
    <div className={cn("inline-flex rounded-xl border bg-muted p-0.5", compact ? "text-[11px]" : "w-full text-xs")}>
      <button
        onClick={() => router.push("/dashboard")}
        className={cn(
          "press flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 font-medium transition-colors",
          !patenteMode ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Languages className="h-3.5 w-3.5" /> Italian
      </button>
      <button
        onClick={() => router.push("/patente")}
        className={cn(
          "press flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 font-medium transition-colors",
          patenteMode ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Car className="h-3.5 w-3.5" /> Patente
      </button>
    </div>
  );
}
