"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, User } from "lucide-react";

interface ProfileData {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  cefrLevel: string;
  isAdmin: boolean;
}

/** Profile panel — edit first/last name; view email, level, admin status. */
export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setData(d);
        setFirstName(d.firstName ?? "");
        setLastName(d.lastName ?? "");
      })
      .catch(() => setData(null));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() ||
    (data.email[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight">Profile</h1>

      <div className="shadow-soft flex items-center gap-4 rounded-2xl border bg-card p-4">
        <div className="shadow-soft flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-lg font-bold text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{data.displayName || "Set your name"}</p>
          <p className="truncate text-xs text-muted-foreground">{data.email}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
              Level {data.cefrLevel}
            </span>
            {data.isAdmin ? (
              <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shadow-soft space-y-4 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4" /> Your name
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name">
            <input
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setSaved(false);
              }}
              placeholder="Mario"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Last name">
            <input
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setSaved(false);
              }}
              placeholder="Rossi"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            value={data.email}
            disabled
            className="w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground"
          />
        </Field>

        <button
          onClick={save}
          disabled={saving}
          className="press flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saved ? "Saved ✓" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
