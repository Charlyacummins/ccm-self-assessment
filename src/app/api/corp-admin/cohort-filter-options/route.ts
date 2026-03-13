import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();
  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: settings } = await supabase
    .from("cohort_settings")
    .select("individual_result_visibility, grouping_enabled")
    .eq("cohort_id", cohortId)
    .maybeSingle();
  const individualResultVisibility = settings?.individual_result_visibility ?? false;
  const groupingEnabled = settings?.grouping_enabled ?? false;

  const [groupsResult, membersResult] = await Promise.all([
    groupingEnabled
      ? supabase
          .from("cohort_groups")
          .select("id, name")
          .eq("cohort_id", cohortId)
          .order("name")
      : Promise.resolve({ data: [] }),
    supabase
      .from("cohort_members")
      .select("user_id")
      .eq("cohort_id", cohortId)
      .eq("role", "user"),
  ]);

  const userIds = (membersResult.data ?? [])
    .map((m) => m.user_id)
    .filter((id): id is string => typeof id === "string");

  const profilesResult = individualResultVisibility && userIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };

  return NextResponse.json({
    groupingEnabled,
    individualResultVisibility,
    groups: (groupsResult.data ?? []).map((g) => ({ id: g.id as string, name: g.name as string })),
    users: (profilesResult.data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Unknown" })),
  });
}
