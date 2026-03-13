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

function statusLabel(status: string | null): string {
  switch (status) {
    case "submitted": return "Submitted";
    case "in_review": return "In Review";
    case "reviewed": return "Reviewed";
    case "completed": return "Completed";
    case "in_progress": return "In Progress";
    default: return status ?? "—";
  }
}

function statusClass(status: string | null): string {
  switch (status) {
    case "completed":
    case "reviewed":
      return "bg-green-100 text-green-800";
    case "submitted":
    case "in_review":
      return "bg-[#004070]/10 text-[#004070]";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function AssessmentHistoryTable({ profileId }: { profileId: string }) {
  const supabase = db();

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, submitted_at, created_at, status, template_id")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = assessments ?? [];

  const templateIds = [
    ...new Set(rows.map((a) => a.template_id).filter((id): id is string => !!id)),
  ];

  const { data: templates } = templateIds.length
    ? await supabase
        .from("assessment_templates")
        .select("id, title")
        .in("id", templateIds)
    : { data: [] as { id: string; title: string }[] };

  const titleById = Object.fromEntries(
    (templates ?? []).map((t) => [t.id, t.title])
  );

  // Compute percentage scores for submitted assessments
  const scorableIds = rows
    .filter((a) => ["submitted", "in_review", "reviewed", "completed"].includes(a.status ?? ""))
    .map((a) => a.id);

  const scoreByAssessmentId: Record<string, number> = {};

  if (scorableIds.length > 0) {
    const { data: scoreRows } = await supabase
      .from("assessment_skill_scores")
      .select("assessment_id, final_score, template_skill_id")
      .in("assessment_id", scorableIds);

    const skillIds = [
      ...new Set(
        (scoreRows ?? []).map((s) => s.template_skill_id).filter((id): id is string => !!id)
      ),
    ];

    const { data: skillMeta } = skillIds.length
      ? await supabase
          .from("template_skills")
          .select("id, max_points")
          .in("id", skillIds)
      : { data: [] as { id: string; max_points: number | null }[] };

    const maxById = Object.fromEntries((skillMeta ?? []).map((s) => [s.id, s.max_points ?? 0]));

    const totals: Record<string, { score: number; possible: number }> = {};
    for (const row of scoreRows ?? []) {
      const aid = row.assessment_id as string;
      const max = row.template_skill_id ? maxById[row.template_skill_id] ?? 0 : 0;
      if (!totals[aid]) totals[aid] = { score: 0, possible: 0 };
      totals[aid].score += Number(row.final_score ?? 0);
      totals[aid].possible += max;
    }

    for (const [aid, { score, possible }] of Object.entries(totals)) {
      if (possible > 0) scoreByAssessmentId[aid] = Math.round((score / possible) * 100);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#004070]">Assessment History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[#534F4F]">
            No assessments found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F3F4F6]">
                <TableHead className="text-xs font-semibold text-[#004070]">Assessment</TableHead>
                <TableHead className="text-xs font-semibold text-[#004070]">Date</TableHead>
                <TableHead className="text-xs font-semibold text-[#004070]">Status</TableHead>
                <TableHead className="text-right text-xs font-semibold text-[#004070]">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a, i) => {
                const score = scoreByAssessmentId[a.id];
                return (
                  <TableRow
                    key={a.id}
                    className={i % 2 === 0 ? "bg-white" : "bg-[#F3F4F6]"}
                  >
                    <TableCell className="text-sm font-medium text-[#004070]">
                      {a.template_id ? (titleById[a.template_id] ?? "Unknown") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-[#534F4F]">
                      {formatDate(a.submitted_at ?? a.created_at)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(a.status)}`}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-[#004070]">
                      {score != null ? `${score}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
