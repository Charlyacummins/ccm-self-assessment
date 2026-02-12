import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    fullName,
    country,
    subRegion,
    jobRole,
    industry,
    yearsExperience,
    educationLevel,
    functionalArea,
    seniorityLevel,
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

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", profile.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: dimensionError } = await supabase
    .from("user_dimensions")
    .upsert(
      {
        user_id: profile.id,
        country: country || null,
        sub_region: subRegion || null,
        job_role: jobRole || null,
        industry: industry || null,
        years_experience: yearsExperience ? Number(yearsExperience) : null,
        education_level: educationLevel || null,
        functional_area: functionalArea || null,
        seniority_level: seniorityLevel || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (dimensionError) {
    return NextResponse.json({ error: dimensionError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
