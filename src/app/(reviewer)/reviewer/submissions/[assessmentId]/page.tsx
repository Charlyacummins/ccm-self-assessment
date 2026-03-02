import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReviewerAssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#004070]">Review Assessment</h1>
        <p className="mt-2 text-sm text-[#534F4F]">
          Reviewing submission <span className="font-medium">{assessmentId}</span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assessment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#534F4F]">
            <p>Organization: Placeholder Organization</p>
            <p>Assessment Type: Placeholder Assessment</p>
            <p>Submitted Date: 2026-02-01</p>
            <p>Status: Pending Review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#534F4F]">
            <p>Scoring controls and review rubric will be added here.</p>
            <div className="rounded-lg border border-dashed border-[#00ABEB]/50 p-4 text-[#004070]">
              Placeholder form area for section-by-section scoring and reviewer notes.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
