import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AssessmentRow {
  id: string;
  user_id: string;
  template_id: string;
  status: string;
  submitted_at: string | null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function mapSubmissionStatus(status: string): string {
  switch (status) {
    case "in_review":
      return "In Review";
    case "reviewed":
    case "completed":
      return "Completed";
    case "submitted":
    default:
      return "Pending";
  }
}

export default async function ReviewerSubmissionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  const { data: reviewerProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (!reviewerProfile) return null;

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, user_id, template_id, status, submitted_at")
    .eq("reviewed_by", reviewerProfile.id)
    .in("status", ["submitted", "in_review", "reviewed", "completed"])
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const inviteeIds = [...new Set((assessments ?? []).map((a) => a.user_id))];
  const templateIds = [...new Set((assessments ?? []).map((a) => a.template_id))];

  const [{ data: inviteeProfiles }, { data: templates }] = await Promise.all([
    inviteeIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", inviteeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    templateIds.length
      ? supabase.from("assessment_templates").select("id, title").in("id", templateIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string | null }> }),
  ]);

  const inviteeNameById = new Map((inviteeProfiles ?? []).map((p) => [p.id, p.full_name]));
  const templateTitleById = new Map((templates ?? []).map((t) => [t.id, t.title]));

  const rows = (assessments ?? []).map((assessment: AssessmentRow) => ({
    id: assessment.id,
    name: inviteeNameById.get(assessment.user_id) || "Unknown Invitee",
    assessment: templateTitleById.get(assessment.template_id) || "Assessment",
    submittedDate: formatDate(assessment.submitted_at),
    status: mapSubmissionStatus(assessment.status),
  }));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#004070]">Submissions</h1>
        <p className="mt-2 text-sm text-[#534F4F]">
          Assigned assessments awaiting reviewer action.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Assessment</TableHead>
            <TableHead>Submitted Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-[#534F4F]">
                No assessments currently assigned for review.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell className="font-medium text-[#004070]">{submission.name}</TableCell>
                <TableCell>{submission.assessment}</TableCell>
                <TableCell>{submission.submittedDate}</TableCell>
                <TableCell>{submission.status}</TableCell>
                <TableCell>
                  <Link
                    href={`/reviewer/submissions/${submission.id}`}
                    className="font-medium text-[#00ABEB] hover:text-[#004070]"
                  >
                    Review
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
