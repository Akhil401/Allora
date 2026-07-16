"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, Sun, Moon, Monitor, LogOut, ChevronsUpDown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@app/(auth)/actions";
import { usePreferences, type Theme } from "@/presentation/stores/preferences";
import { isAdminEmail } from "@/lib/config/admin";

function initialsOf(name: string, email: string): string {
  const src = name.trim() || email;
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

/**
 * Consolidated account menu (avatar → dropdown with name, Profile, Theme,
 * Sign out). Replaces the cramped row of icons. `variant` controls where the
 * dropdown opens: "sidebar" opens upward, "bar" opens downward-right.
 */
export function UserMenu({ email, variant }: { email: string; variant: "sidebar" | "bar" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = usePreferences();

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setName(d.displayName ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const applyTheme = (key: Theme) => {
    setTheme(key); // instant local apply
    // Persist so the Settings page (server-backed) stays in sync everywhere.
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: key }),
    }).catch(() => {});
  };

  const initials = initialsOf(name, email);

  const themes: { key: Theme; icon: typeof Sun; label: string }[] = [
    { key: "light", icon: Sun, label: "Light" },
    { key: "dark", icon: Moon, label: "Dark" },
    { key: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className={cn(
          "press flex items-center gap-2 rounded-full outline-none transition-colors",
          variant === "sidebar" && "w-full rounded-lg p-1.5 hover:bg-muted",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>
        {variant === "sidebar" ? (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">{name || "Your account"}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          className={cn(
            "shadow-soft-lg animate-scale-in absolute z-30 w-60 origin-top overflow-hidden rounded-xl border bg-card",
            variant === "sidebar"
              ? "bottom-full left-0 mb-2 origin-bottom"
              : "right-0 top-full mt-2",
          )}
        >
          <div className="border-b px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{name || "Your account"}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>

          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
            >
              <User className="h-4 w-4" /> Profile
            </Link>
            {isAdminEmail(email) ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
              >
                <BarChart3 className="h-4 w-4" /> Usage &amp; quota
              </Link>
            ) : null}
          </div>

          <div className="border-t px-3 py-2">
            <p className="mb-1.5 text-[11px] font-medium uppercase text-muted-foreground">Theme</p>
            <div className="grid grid-cols-3 gap-1">
              {themes.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => applyTheme(key)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px]",
                    theme === key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t p-1">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
