import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "summary_report_mode, dashboard_option, percentage_based_scoring, benchmark_default"
    )
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    summaryReportMode: data?.summary_report_mode ?? "summary_reports",
    dashboardOption: data?.dashboard_option ?? "insights",
    percentageBasedScoring: data?.percentage_based_scoring ?? true,
    benchmarkDefault: data?.benchmark_default ?? "global",
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    summaryReportMode,
    dashboardOption,
    percentageBasedScoring,
    benchmarkDefault,
  } = body ?? {};

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: profile.id,
      summary_report_mode: summaryReportMode ?? "summary_reports",
      dashboard_option: dashboardOption ?? "insights",
      percentage_based_scoring: percentageBasedScoring ?? true,
      benchmark_default: benchmarkDefault ?? "global",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
