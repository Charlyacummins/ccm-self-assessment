import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";

export default async function AssessmentPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  // Resolve template_id from cohort or default
  let templateId = DEFAULT_TEMPLATE_ID;
  if (profile) {
    const { data: cohortMember } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", profile.id)
      .limit(1)
      .single();

    if (cohortMember) {
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("template_id")
        .eq("id", cohortMember.cohort_id)
        .single();

      if (cohort?.template_id) {
        templateId = cohort.template_id;
      }
    }
  }

  // Fetch question count (skills linked via meta_json.template_ids) and section count
  const { count: questionCount } = await supabase
    .from("template_skills")
    .select("id", { count: "exact", head: true })
    .contains("meta_json", { template_ids: [templateId] });

  const { count: sectionCount } = await supabase
    .from("template_skill_groups")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  const questions = questionCount ?? 0;
  const estLow = Math.max(1, Math.ceil((questions * 0.5)));
  const estHigh = Math.max(1, Math.ceil((questions * 0.75)));
  const timeLabel = estLow === estHigh ? `~${estLow} mins` : `${estLow}–${estHigh} mins`;

  return (
    <div className="space-y-10">
      {/* Info card */}
      <Card>
        <CardContent className="py-12 text-center">
          <h1 className="text-xl font-semibold text-[#004070]">
            Start Assessment
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm text-[#004070]">
            Assess your current skills across multiple competency areas.
          </p>

          <p className="mx-auto mt-6 max-w-3xl text-sm text-[#004070]">
            This assessment includes questions on strategy, leadership, and
            execution. Your progress will be saved automatically — you can
            return at any time. Once complete, you&apos;ll receive a
            personalized results summary and benchmarks.
          </p>

          <ul className="mt-8 space-y-1 text-sm font-medium text-[#004070]">
            <li>Estimated time: {timeLabel}</li>
            <li>Questions: {questionCount ?? 0}</li>
            <li>Sections: {sectionCount ?? 0}</li>
          </ul>
        </CardContent>
      </Card>

      {/* Start button card */}
      <div className="flex justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="py-6 text-center">
            <h2 className="text-lg font-semibold text-[#004070]">
              Start Assessment
            </h2>
            <Button
              asChild
              variant="outline"
              className="mt-4 w-32 border-[#00ABEB] text-[#004070] hover:bg-[#00ABEB]/10"
            >
              <Link href="/assessment/start">Start</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
