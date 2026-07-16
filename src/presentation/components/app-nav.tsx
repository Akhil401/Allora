"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  GraduationCap,
  MessageCircle,
  Mic,
  Layers,
  BookMarked,
  Settings as SettingsIcon,
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

const links: NavLink[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/conversations", label: "Chat", icon: MessageCircle },
  { href: "/talk", label: "Talk", icon: Mic, highlight: true },
  { href: "/review", label: "Review", icon: Layers },
  { href: "/vocabulary", label: "Words", icon: BookMarked },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Responsive navigation:
 *  - Desktop (md+): fixed left sidebar with links + a single account menu.
 *  - Mobile: top bar (brand + account menu) and a bottom tab bar.
 * The "Talk" tab is highlighted (filled gradient / raised) as the flagship feature.
 */
export function AppNav({ email }: { email: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r bg-background/80 p-4 backdrop-blur md:flex">
        <Link
          href="/dashboard"
          className="mb-5 flex items-center gap-2 px-2 py-1 text-lg font-bold"
        >
          <span className="shadow-soft flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
            A
          </span>
          <span>
            All<span className="text-gradient">ora</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ href, label, icon: Icon, highlight }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform group-hover:scale-110",
                    active && "scale-110",
                  )}
                />
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
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
            A
          </span>
          <span>
            All<span className="text-gradient">ora</span>
          </span>
        </Link>
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
