import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();

  const lookupTables = [
    { key: "role", table: "job_roles" },
    { key: "functionalArea", table: "functional_areas" },
    { key: "industry", table: "industries" },
    { key: "educationLevel", table: "education_levels" },
    { key: "yearsExperience", table: "years_experience" },
    { key: "jobLevel", table: "seniority_levels" },
  ];

  const [lookupResults, countries] = await Promise.all([
    Promise.all(
      lookupTables.map(async ({ key, table }) => {
        const { data, error } = await supabase
          .from(table)
          .select("key, label")
          .order("order_index");
        if (error) console.error(`filter-options: ${table}`, error.message);
        return [key, (data ?? []).map((r) => r.label)] as const;
      })
    ),
    supabase
      .from("countries")
      .select("country_name, region, sub_region")
      .order("country_name"),
  ]);

  const countryRows = countries.data ?? [];

  const uniqueRegions = [...new Set(countryRows.map((c) => c.region))].sort();
  const uniqueSubRegions = [
    ...new Set(
      countryRows.map((c) => c.sub_region).filter((s): s is string => !!s)
    ),
  ].sort();

  return NextResponse.json({
    ...Object.fromEntries(lookupResults),
    country: countryRows.map((c) => c.country_name),
    region: uniqueRegions,
    subRegion: uniqueSubRegions,
  });
}
