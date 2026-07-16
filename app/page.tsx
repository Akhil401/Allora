import Link from "next/link";
import {
  GraduationCap,
  Mic,
  Layers,
  Sparkles,
  MessageCircle,
  ArrowRight,
  BookMarked,
  Volume2,
} from "lucide-react";

/**
 * Public landing page. Modern hero with header sign-in/sign-up, a product
 * preview, and feature highlights. Uses theme tokens so it respects dark/light.
 */
export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Soft gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <span className="text-lg font-bold">
          All<span className="text-primary">ora</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="press shadow-soft rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign up
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div className="animate-fade-in-up space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Your personal AI Italian tutor
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Impara l&apos;italiano <span className="text-primary">parlando</span>.
            </h1>
            <p className="max-w-md text-balance text-muted-foreground">
              Hold real conversations, get instant grammar &amp; pronunciation feedback, learn from
              a full A1–C2 course, and remember every word with smart flashcards.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="press shadow-soft inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="press inline-flex items-center gap-2 rounded-lg border px-5 py-3 font-medium transition-colors hover:bg-muted"
              >
                I have an account
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">Free to use · No credit card</p>
          </div>

          {/* Product preview */}
          <div className="animate-scale-in relative mx-auto w-full max-w-sm">
            <div className="shadow-soft-lg rounded-3xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 border-b pb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <div className="text-sm font-semibold">Conversazione</div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    Ciao!
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <GraduationCap className="h-3.5 w-3.5" />
                  </span>
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
                    Ciao! Come stai oggi? Dimmi qualcosa di te!
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Volume2 className="h-3 w-3" /> Listen
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                  ✓ Correction &amp; new words captured automatically
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="stagger grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<Mic className="h-5 w-5" />}
            title="Speak"
            desc="Voice conversations with instant correction."
          />
          <Feature
            icon={<GraduationCap className="h-5 w-5" />}
            title="Learn"
            desc="A full A1–C2 course, generated & cached."
          />
          <Feature
            icon={<Layers className="h-5 w-5" />}
            title="Review"
            desc="Spaced-repetition flashcards that stick."
          />
          <Feature
            icon={<BookMarked className="h-5 w-5" />}
            title="Words"
            desc="A searchable Italian–English dictionary."
          />
        </section>

        {/* Bottom CTA */}
        <section className="shadow-soft mb-16 rounded-3xl border bg-card p-8 text-center">
          <h2 className="text-2xl font-bold">Ready to start?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create your free account and have your first Italian conversation in under a minute.
          </p>
          <Link
            href="/sign-up"
            className="press shadow-soft mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" /> Get started
          </Link>
        </section>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="hover-lift shadow-soft rounded-2xl border bg-card p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
