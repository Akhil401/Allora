import { redirect } from "next/navigation";
import { findLesson } from "@/presentation/data/curriculum";
import { LessonView } from "@/presentation/components/lesson-view";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const loc = findLesson(lessonId);
  if (!loc) redirect("/learn");

  return (
    <LessonView
      lessonId={lessonId}
      title={loc.lesson.title}
      objective={loc.lesson.objective}
      level={loc.level.level}
    />
  );
}
