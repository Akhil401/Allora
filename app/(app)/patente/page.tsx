import Link from "next/link";
import { ListChecks, ClipboardCheck, BarChart3, ArrowRight, Car, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

/** Patente home: entry points to practice, exam and progress. */
export default function PatenteHomePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-soft">
          <Car className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patente B</h1>
          <p className="text-sm text-muted-foreground">
            Prepare for the Italian driving-licence theory exam with the official questions.
          </p>
        </div>
      </div>

      <div className="stagger grid gap-3 sm:grid-cols-2">
        <HomeCard
          href="/patente/theory"
          icon={<BookOpen className="h-5 w-5" />}
          title="Theory"
          desc="Study guides for each exam topic, in English with key Italian terms."
        />
        <HomeCard
          href="/patente/practice"
          icon={<ListChecks className="h-5 w-5" />}
          title="Practice"
          desc="Study by topic with instant feedback and translations."
        />
        <HomeCard
          href="/patente/exam"
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Exam simulation"
          desc="30 questions, 20 minutes, max 3 errors — like the real test."
        />
        <HomeCard
          href="/patente/progress"
          icon={<BarChart3 className="h-5 w-5" />}
          title="Progress"
          desc="See your accuracy by topic and review mistakes."
        />
      </div>
    </div>
  );
}

function HomeCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="hover-lift group flex flex-col gap-2 rounded-2xl border bg-card p-5 shadow-soft">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="mt-1 flex items-center gap-1 font-semibold">
        {title}
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="text-sm text-muted-foreground">{desc}</span>
    </Link>
  );
}
