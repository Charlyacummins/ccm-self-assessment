import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type GroupApiRow = {
  id: string;
  name: string;
  description: string | null;
  completedPercentage: number;
  memberCount: number;
  completedCount: number;
};

type MemberRole = "user" | "reviewer";

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMemberUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return [...new Set(ids)];
}

function normalizeRole(value: unknown): MemberRole | null {
  if (value === "user" || value === "reviewer") return value;
  return null;
}

async function resolveAdminProfile(userId: string) {
  const supabase = db();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  return { supabase, profile };
}

async function verifyCohortAdmin(params: {
  supabase: ReturnType<typeof db>;
  cohortId: string;
  profileId: string;
}) {
  const { supabase, cohortId, profileId } = params;
  return supabase
    .from("cohorts")
    .select("id, template_id")
    .eq("id", cohortId)
    .eq("admin_id", profileId)
    .maybeSingle();
}

async function verifyGroupingEnabled(params: {
  supabase: ReturnType<typeof db>;
  cohortId: string;
}) {
  const { supabase, cohortId } = params;
  const { data } = await supabase
    .from("cohort_settings")
    .select("grouping_enabled")
    .eq("cohort_id", cohortId)
    .maybeSingle();
  return !!data?.grouping_enabled;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const { supabase, profile } = await resolveAdminProfile(userId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await verifyCohortAdmin({
    supabase,
    cohortId,
    profileId: profile.id,
  });
  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await verifyGroupingEnabled({ supabase, cohortId }))) {
    return NextResponse.json({ error: "Grouping is disabled for this cohort" }, { status: 403 });
  }

  const { data: groups, error: groupsError } = await supabase
    .from("cohort_groups")
    .select("*")
    .eq("cohort_id", cohortId)
    .order("name", { ascending: true });

  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 });
  if (!groups || groups.length === 0) return NextResponse.json([] satisfies GroupApiRow[]);

  const groupIds = groups
    .map((group) => {
      const idValue = group.group_id ?? group.id;
      if (typeof idValue === "string") return idValue;
      if (typeof idValue === "number") return String(idValue);
      return null;
    })
    .filter((value): value is string => !!value);

  const { data: members, error: membersError } = await supabase
    .from("cohort_members")
    .select("group_id, user_id")
    .eq("cohort_id", cohortId)
    .in("group_id", groupIds);

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });

  const groupUserSetById = new Map<string, Set<string>>();
  for (const member of members ?? []) {
    const groupId = typeof member.group_id === "string" ? member.group_id : null;
    const userId = typeof member.user_id === "string" ? member.user_id : null;
    if (!groupId || !userId) continue;

    const existingSet = groupUserSetById.get(groupId);
    if (existingSet) {
      existingSet.add(userId);
    } else {
      groupUserSetById.set(groupId, new Set([userId]));
    }
  }

  const allUserIds = [...new Set((members ?? []).map((row) => row.user_id).filter(Boolean))];

  let submittedUserIdSet = new Set<string>();
  if (allUserIds.length > 0) {
    let assessmentQuery = supabase
      .from("assessments")
      .select("user_id")
      .in("user_id", allUserIds)
      .eq("status", "submitted");

    if (cohort.template_id) {
      assessmentQuery = assessmentQuery.eq("template_id", cohort.template_id);
    }

    const { data: submittedAssessments, error: assessmentsError } = await assessmentQuery;
    if (assessmentsError) {
      return NextResponse.json({ error: assessmentsError.message }, { status: 500 });
    }

    submittedUserIdSet = new Set(
      (submittedAssessments ?? [])
        .map((assessment) => assessment.user_id)
        .filter((value): value is string => typeof value === "string")
    );
  }

  const rows: GroupApiRow[] = groups.map((group) => {
    const idValue = group.group_id ?? group.id;
    const groupId =
      typeof idValue === "string" ? idValue : typeof idValue === "number" ? String(idValue) : "";
    const groupUsers = groupUserSetById.get(groupId) ?? new Set<string>();
    const memberCount = groupUsers.size;
    let completedCount = 0;
    for (const userId of groupUsers) {
      if (submittedUserIdSet.has(userId)) completedCount += 1;
    }

    const completedPercentage = memberCount > 0 ? Math.round((completedCount / memberCount) * 100) : 0;

    return {
      id: groupId,
      name:
        typeof group.name === "string"
          ? group.name
          : typeof group.group_name === "string"
            ? group.group_name
            : "Untitled Group",
      description:
        typeof group.description === "string"
          ? group.description
          : typeof group.group_description === "string"
            ? group.group_description
            : null,
      completedPercentage,
      memberCount,
      completedCount,
    };
  });

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const name = normalizeName(body?.name);
  const description = normalizeDescription(body?.description);
  const memberUserIds = normalizeMemberUserIds(body?.memberUserIds);

  if (!cohortId || !name) {
    return NextResponse.json({ error: "cohortId and name are required" }, { status: 400 });
  }

  const { supabase, profile } = await resolveAdminProfile(userId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await verifyCohortAdmin({
    supabase,
    cohortId,
    profileId: profile.id,
  });
  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await verifyGroupingEnabled({ supabase, cohortId }))) {
    return NextResponse.json({ error: "Grouping is disabled for this cohort" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("cohort_groups")
    .insert({
      id: crypto.randomUUID(),
      cohort_id: cohortId,
      name,
      description,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const insertedGroupIdValue = data.group_id ?? data.id;
  const insertedGroupId =
    typeof insertedGroupIdValue === "string"
      ? insertedGroupIdValue
      : typeof insertedGroupIdValue === "number"
        ? String(insertedGroupIdValue)
        : "";

  if (!insertedGroupId) {
    return NextResponse.json(
      { error: "Created group row is missing a group identifier" },
      { status: 500 }
    );
  }

  let assignedCount = 0;
  if (memberUserIds.length > 0) {
    const { data: updatedMembers, error: memberUpdateError } = await supabase
      .from("cohort_members")
      .update({ group_id: insertedGroupId })
      .eq("cohort_id", cohortId)
      .eq("role", "user")
      .in("user_id", memberUserIds)
      .select("user_id");

    if (memberUpdateError) {
      return NextResponse.json(
        { error: memberUpdateError.message },
        { status: 500 }
      );
    }

    assignedCount = (updatedMembers ?? []).length;
  }

  return NextResponse.json(
    {
      ok: true,
      group: {
        id: insertedGroupId,
        name:
          typeof data.name === "string"
            ? data.name
            : typeof data.group_name === "string"
              ? data.group_name
              : name,
        description:
          typeof data.description === "string"
            ? data.description
            : typeof data.group_description === "string"
              ? data.group_description
              : description,
      },
      assignedCount,
    },
    { status: 201 }
  );
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  const role = normalizeRole(body?.role);
  const memberUserIds = normalizeMemberUserIds(body?.memberUserIds);

  if (!cohortId || !groupId || memberUserIds.length === 0) {
    return NextResponse.json(
      { error: "cohortId, groupId, and memberUserIds are required" },
      { status: 400 }
    );
  }

  const { supabase, profile } = await resolveAdminProfile(userId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await verifyCohortAdmin({
    supabase,
    cohortId,
    profileId: profile.id,
  });
  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await verifyGroupingEnabled({ supabase, cohortId }))) {
    return NextResponse.json({ error: "Grouping is disabled for this cohort" }, { status: 403 });
  }

  const { data: group, error: groupError } = await supabase
    .from("cohort_groups")
    .select("id")
    .eq("id", groupId)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  let query = supabase
    .from("cohort_members")
    .update({ group_id: groupId })
    .eq("cohort_id", cohortId)
    .in("user_id", memberUserIds)
    .select("user_id");

  if (role) query = query.eq("role", role);

  const { data: updatedMembers, error: updateError } = await query;
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    assignedCount: (updatedMembers ?? []).length,
  });
}
