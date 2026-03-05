import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ReviewRow {
  id: string;
  invitee: string;
  email: string;
  statusLabel: string;
  functionLabel: string;
  actionLabel: string;
}

function mapReviewStatus(status: string): {
  label: string;
  action: string;
} {
  switch (status) {
    case "in_review":
      return { label: "In Progress", action: "Continue" };
    case "reviewed":
    case "completed":
      return { label: "Completed", action: "View" };
    case "submitted":
    default:
      return { label: "Invited", action: "Start Review" };
  }
}

export default async function ReviewerDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  const { data: reviewerProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!reviewerProfile) {
    return null;
  }

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, user_id, template_id, status, submitted_at, started_at, created_at")
    .eq("reviewed_by", reviewerProfile.id)
    .in("status", ["submitted", "in_review", "reviewed", "completed"])
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const inviteeIds = [...new Set((assessments ?? []).map((a) => a.user_id))];
  const { data: inviteeProfiles } = inviteeIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", inviteeIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

  const { data: inviteeDimensions } = inviteeIds.length
    ? await supabase
        .from("user_dimensions")
        .select("user_id, functional_area")
        .in("user_id", inviteeIds)
    : { data: [] as { user_id: string; functional_area: string | null }[] };

  const profileById = new Map((inviteeProfiles ?? []).map((p) => [p.id, p]));
  const functionById = new Map((inviteeDimensions ?? []).map((d) => [d.user_id, d.functional_area]));

  const pendingCount = (assessments ?? []).filter((a) => ["submitted", "in_review"].includes(a.status)).length;
  const completedCount = (assessments ?? []).filter((a) => ["reviewed", "completed"].includes(a.status)).length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentActivityCount = (assessments ?? []).filter((a) => {
    const activityAt = a.submitted_at ?? a.started_at ?? a.created_at;
    if (!activityAt) return false;
    return new Date(activityAt) >= sevenDaysAgo;
  }).length;

  const primaryTemplateId = (assessments ?? [])[0]?.template_id ?? DEFAULT_TEMPLATE_ID;
  const { count: questionCount } = await supabase
    .from("template_skills")
    .select("id", { count: "exact", head: true })
    .contains("meta_json", { template_ids: [primaryTemplateId] });

  const { data: sectionRows } = await supabase
    .from("template_skills")
    .select("skill_group_id")
    .contains("meta_json", { template_ids: [primaryTemplateId] });

  const sectionCount = new Set(
    (sectionRows ?? [])
      .map((row) => row.skill_group_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  ).size;

  const questions = questionCount ?? 0;
  const estLow = Math.max(1, Math.ceil(questions * 0.5));
  const estHigh = Math.max(1, Math.ceil(questions * 0.75));
  const timeLabel = estLow === estHigh ? `~${estLow} mins` : `${estLow}-${estHigh} mins`;

  const reviewRows: ReviewRow[] = (assessments ?? []).slice(0, 10).map((assessment) => {
    const p = profileById.get(assessment.user_id);
    const mapped = mapReviewStatus(assessment.status);
    return {
      id: assessment.id,
      invitee: p?.full_name || "Unknown Invitee",
      email: p?.email || "-",
      statusLabel: mapped.label,
      functionLabel: functionById.get(assessment.user_id) || "-",
      actionLabel: mapped.action,
    };
  });

  const orgDisplayName = "YOUR ASSIGNED INVITEES";
  const overviewCards = [
    {
      title: "Pending Reviews",
      value: String(pendingCount),
      description: "Assessments waiting for your review.",
    },
    {
      title: "Completed Reviews",
      value: String(completedCount),
      description: "Assessments reviewed in the current period.",
    },
    {
      title: "Recent Activity",
      value: String(recentActivityCount),
      description: "Reviews updated in the last 7 days.",
    },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#004070]">Reviewer Dashboard</h1>
        <p className="mt-2 text-sm text-[#534F4F]">
          Overview of your current review workload.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overviewCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-bold text-[#00ABEB]">{card.value}</p>
              <p className="text-sm text-[#534F4F]">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <h2 className="text-3xl font-semibold text-[#004070]">Start Review</h2>
          <p className="mt-4 text-2xl font-semibold text-[#004070]">
            Review assessments on behalf of {orgDisplayName}
          </p>
          <p className="mx-auto mt-8 max-w-4xl text-base text-[#004070]">
            This assessment includes questions on strategy, leadership, and execution.
            Your progress will be saved automatically, and you can return at any time.
          </p>
          <ul className="mt-8 space-y-1 text-base font-medium text-[#004070]">
            <li>Estimated time: {timeLabel}</li>
            <li>Questions: {questions}</li>
            <li>Sections: {sectionCount ?? 0}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">To Review</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invitee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Review Status</TableHead>
                <TableHead>Function</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-[#534F4F]">
                    No assessments currently assigned for review.
                  </TableCell>
                </TableRow>
              ) : (
                reviewRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-[#004070]">{row.invitee}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell className="font-semibold text-[#004070]">{row.statusLabel}</TableCell>
                    <TableCell>{row.functionLabel}</TableCell>
                    <TableCell>
                      <Link
                        href={`/reviewer/submissions/${row.id}`}
                        className="font-medium text-[#00ABEB] hover:text-[#004070]"
                      >
                        {row.actionLabel}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
