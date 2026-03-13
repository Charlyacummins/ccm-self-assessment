# Staging DB Change Log (Not Yet in Main)

Use this file to track database changes applied in staging that have not been applied to `main` yet.

## 2026-02-23

### Added `public.pending_invites` table

```sql
create table public.pending_invites (
  id uuid not null default gen_random_uuid (),
  email text not null,
  cohort_id uuid null,
  role text not null default 'user'::text,
  invited_at timestamp with time zone null default now(),
  constraint pending_invites_pkey primary key (id),
  constraint pending_invites_email_cohort_key unique (email, cohort_id),
  constraint pending_invites_cohort_id_fkey foreign KEY (cohort_id) references cohorts (id) on delete CASCADE
) TABLESPACE pg_default;
```

### Notes

- Applied to staging only (not yet in `main`)
- Previous `invites` table change was removed/deleted and replaced with this table definition

## 2026-03-03

### Added `public.rpc_auto_complete_cohort_if_ready(uuid)`

```sql
create or replace function public.rpc_auto_complete_cohort_if_ready(p_cohort_id uuid)
returns table (
  updated boolean,
  status text,
  roster_count integer,
  completed_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_template_id uuid;
  v_roster_count integer := 0;
  v_completed_count integer := 0;
  v_updated boolean := false;
begin
  select c.status, c.template_id
    into v_status, v_template_id
  from public.cohorts c
  where c.id = p_cohort_id;

  if v_status is null then
    return query
      select false, null::text, 0, 0;
    return;
  end if;

  select count(*)
    into v_roster_count
  from public.cohort_members cm
  where cm.cohort_id = p_cohort_id
    and cm.role in ('user', 'reviewer');

  if v_roster_count > 0 then
    select count(*)
      into v_completed_count
    from public.cohort_members cm
    where cm.cohort_id = p_cohort_id
      and cm.role in ('user', 'reviewer')
      and exists (
        select 1
        from public.assessments a
        where a.user_id = cm.user_id
          and (v_template_id is null or a.template_id = v_template_id)
          and a.status in ('submitted', 'in_review', 'reviewed', 'completed')
      );
  end if;

  if lower(v_status) = 'active' and v_roster_count > 0 and v_completed_count = v_roster_count then
    update public.cohorts
    set status = 'Completed'
    where id = p_cohort_id
      and lower(status) = 'active';

    v_updated := found;
    v_status := 'Completed';
  end if;

  return query
    select v_updated, v_status, v_roster_count, v_completed_count;
end;
$$;
```

### Added `public.rpc_revert_cohort_to_default_template_if_equivalent(uuid, uuid)`

```sql
create or replace function public.rpc_revert_cohort_to_default_template_if_equivalent(
  p_cohort_id uuid,
  p_default_template_id uuid default 'c9bd8551-b8f4-4255-b2b7-c1b86f18907d'
)
returns table (
  changed boolean,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_template_id uuid;
  v_custom_count integer := 0;
  v_diff_count integer := 0;
  v_assessment_count integer := 0;
begin
  select c.template_id
    into v_current_template_id
  from public.cohorts c
  where c.id = p_cohort_id;

  if v_current_template_id is null then
    return query select false, 'cohort_not_found_or_template_null';
    return;
  end if;

  if v_current_template_id = p_default_template_id then
    return query select false, 'already_default';
    return;
  end if;

  select count(*)
    into v_assessment_count
  from public.assessments a
  join public.cohort_members cm on cm.user_id = a.user_id
  where cm.cohort_id = p_cohort_id
    and a.template_id = v_current_template_id;

  if v_assessment_count > 0 then
    return query select false, 'assessments_exist_for_current_template';
    return;
  end if;

  select count(*)
    into v_custom_count
  from public.custom_skills cs
  where cs.cohort_id = p_cohort_id;

  if v_custom_count > 0 then
    return query select false, 'custom_questions_exist';
    return;
  end if;

  with default_set as (
    select ts.id
    from public.template_skills ts
    where (ts.meta_json->'template_ids') ? (p_default_template_id::text)
  ),
  current_set as (
    select ts.id
    from public.template_skills ts
    where (ts.meta_json->'template_ids') ? (v_current_template_id::text)
  ),
  sym_diff as (
    select coalesce(d.id, c.id) as id
    from default_set d
    full join current_set c on c.id = d.id
    where d.id is null or c.id is null
  )
  select count(*) into v_diff_count from sym_diff;

  if v_diff_count > 0 then
    return query select false, 'template_sets_do_not_match_default';
    return;
  end if;

  update public.cohorts
  set template_id = p_default_template_id
  where id = p_cohort_id;

  return query select true, 'reverted_to_default';
end;
$$;
```

### Notes

- Applied to staging only (not yet in `main`)
- Both RPCs were created directly in staging

## 2026-03-05

### Added `public.cohort_members.reviewer_id`

```sql
alter table public.cohort_members
add column reviewer_id uuid null;

alter table public.cohort_members
add constraint cohort_members_reviewer_id_fkey
foreign key (reviewer_id)
references public.profiles (id)
on update cascade
on delete cascade;
```

### Notes

- Applied to staging only (not yet in `main`)
- `reviewer_id` links a cohort member row to the assigned reviewer profile

### Updated `public.v_benchmark_skill_facts_live` score fallback

```sql
create or replace view public.v_benchmark_skill_facts_live as
select
  a.template_id,
  ass.template_skill_id,
  coalesce(ass.reviewer_score::numeric, ass.points) as score_value,
  a.submitted_at,
  ud.country,
  ud.industry,
  ud.seniority_level as job_level,
  ud.functional_area,
  ud.job_role as role,
  ud.region,
  ud.sub_region,
  ud.years_experience,
  ud.education_level,
  ts.skill_group_id,
  ts.max_points,
  ts.min_points
from assessments a
join assessment_skill_scores ass
  on ass.assessment_id = a.id
join template_skills ts
  on ts.id = ass.template_skill_id
 and (
   ts.template_id = a.template_id
   or a.template_id::text in (
     select jsonb_array_elements_text(ts.meta_json -> 'template_ids')
   )
 )
left join user_dimensions ud
  on ud.user_id = a.user_id
where a.submitted_at is not null
  and ass.points is not null;
```

### Notes

- Applied to staging only (not yet in `main`)
- Benchmark score source now prefers reviewer score when present, otherwise uses user points
- Row inclusion still requires `ass.points is not null` (no reviewer-only rows)

### Added `public.rpc_dynamic_skill_benchmark_live_v2(...)`

```sql
create or replace function public.rpc_dynamic_skill_benchmark_live_v2(
  p_template_skill_id uuid,
  p_submitted_year integer default null,
  p_country text default null,
  p_industry text default null,
  p_job_level text default null,
  p_functional_area text default null,
  p_role text default null,
  p_region text default null,
  p_sub_region text default null,
  p_years_experience integer default null,
  p_education_level text default null
)
returns table(
  n bigint,
  mean_score numeric,
  p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric
)
language sql stable security definer as $$
with base as (
  select f.score_value::numeric as score
  from public.v_benchmark_skill_facts_live f
  where f.template_id = 'c9bd8551-b8f4-4255-b2b7-c1b86f18907d'
    and f.template_skill_id = p_template_skill_id
    and f.score_value is not null
    and (p_submitted_year   is null or extract(year from f.submitted_at)::int = p_submitted_year)
    and (p_country          is null or f.country           = p_country)
    and (p_industry         is null or f.industry          = p_industry)
    and (p_job_level        is null or f.job_level         = p_job_level)
    and (p_functional_area  is null or f.functional_area   = p_functional_area)
    and (p_role             is null or f.role              = p_role)
    and (p_region           is null or f.region            = p_region)
    and (p_sub_region       is null or f.sub_region        = p_sub_region)
    and (p_years_experience is null or f.years_experience  = p_years_experience)
    and (p_education_level  is null or f.education_level   = p_education_level)
)
select
  count(*)::bigint                                          as n,
  avg(score)                                               as mean_score,
  percentile_cont(0.10) within group (order by score)      as p10,
  percentile_cont(0.25) within group (order by score)      as p25,
  percentile_cont(0.50) within group (order by score)      as p50,
  percentile_cont(0.75) within group (order by score)      as p75,
  percentile_cont(0.90) within group (order by score)      as p90
from base;
$$;
```

### Added `public.rpc_skill_group_benchmark_v2(...)`

```sql
create or replace function public.rpc_skill_group_benchmark_v2(
  p_skill_group_id uuid,
  p_cohort_template_id uuid,
  p_submitted_year integer default null,
  p_country text default null,
  p_industry text default null,
  p_job_level text default null,
  p_functional_area text default null,
  p_role text default null,
  p_region text default null,
  p_sub_region text default null,
  p_years_experience integer default null,
  p_education_level text default null
)
returns table(
  skill_group_name text,
  total_possible_points bigint,
  n bigint,
  mean_score numeric,
  p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric
)
language sql stable security definer
as $$
with matched_skills as (
  -- Skills present in BOTH the default template AND the cohort's template
  select ts.id as template_skill_id, ts.max_points::numeric as max_points
  from public.template_skills ts
  where ts.skill_group_id = p_skill_group_id
    and (ts.meta_json->'template_ids') ? 'c9bd8551-b8f4-4255-b2b7-c1b86f18907d'
    and (ts.meta_json->'template_ids') ? p_cohort_template_id::text
),
skill_stats as (
  select
    f.template_skill_id,
    count(*)                    as n,
    avg(f.score_value::numeric) as mean_score
  from public.v_benchmark_skill_facts_live f
  join matched_skills ms on ms.template_skill_id = f.template_skill_id
  where f.template_id  = 'c9bd8551-b8f4-4255-b2b7-c1b86f18907d'
    and f.skill_group_id = p_skill_group_id
    and f.score_value is not null
    and (p_submitted_year   is null or extract(year from f.submitted_at)::int = p_submitted_year)
    and (p_country          is null or f.country           = p_country)
    and (p_industry         is null or f.industry          = p_industry)
    and (p_job_level        is null or f.job_level         = p_job_level)
    and (p_functional_area  is null or f.functional_area   = p_functional_area)
    and (p_role             is null or f.role              = p_role)
    and (p_region           is null or f.region            = p_region)
    and (p_sub_region       is null or f.sub_region        = p_sub_region)
    and (p_years_experience is null or f.years_experience  = p_years_experience)
    and (p_education_level  is null or f.education_level   = p_education_level)
  group by f.template_skill_id
)
select
  tsg.name                                                         as skill_group_name,
  (select sum(max_points) from matched_skills)::bigint             as total_possible_points,
  min(ss.n)::bigint                                                as n,
  sum(ss.mean_score)                                               as mean_score,
  null::numeric as p10, null::numeric as p25, null::numeric as p50,
  null::numeric as p75, null::numeric as p90
from skill_stats ss
cross join public.template_skill_groups tsg
where tsg.id = p_skill_group_id
group by tsg.name;
$$;
```

### Notes

- Applied to staging only (not yet in `main`)
- Both v2 RPCs benchmark against default-template facts and map overlap via `template_skills.meta_json.template_ids`

## 2026-03-09

### Added `public.v_benchmark_skill_facts_v2` (materialized view)

Replaces `v_benchmark_skill_facts_live` for corp admin and individual user benchmark RPCs. Indexed on `skill_group_id` and `template_skill_id` — no `template_id` column, so captures scores from all templates via skill UUID.

```sql
create materialized view public.v_benchmark_skill_facts_v2 as
select
  ass.template_skill_id,
  ts.skill_group_id,
  coalesce(ass.reviewer_score, ass.final_score, ass.points)::numeric as score_value,
  a.submitted_at,
  ud.country,
  ud.industry,
  ud.seniority_level    as job_level,
  ud.functional_area,
  ud.job_role           as role,
  ud.region,
  ud.sub_region,
  ud.years_experience,
  ud.education_level
from public.assessment_skill_scores ass
join public.assessments a         on a.id  = ass.assessment_id
join public.template_skills ts    on ts.id = ass.template_skill_id
left join public.user_dimensions ud on ud.user_id = a.user_id
where a.submitted_at is not null
  and coalesce(ass.reviewer_score, ass.final_score, ass.points) is not null;

create index on public.v_benchmark_skill_facts_v2 (skill_group_id);
create index on public.v_benchmark_skill_facts_v2 (template_skill_id);
```

### Updated `public.rpc_skill_group_benchmark_v2(...)`

Replaced single `p_skill_group_id` + `p_cohort_template_id` signature with batched `p_skill_group_ids uuid[]`. Now uses `v_benchmark_skill_facts_v2` (no template_id filter). Returns one row per skill group.

```sql
create or replace function public.rpc_skill_group_benchmark_v2(
  p_skill_group_ids uuid[],
  p_submitted_year integer default null,
  p_country text default null,
  p_industry text default null,
  p_job_level text default null,
  p_functional_area text default null,
  p_role text default null,
  p_region text default null,
  p_sub_region text default null,
  p_years_experience integer default null,
  p_education_level text default null
)
returns table(
  skill_group_id uuid,
  skill_group_name text,
  total_possible_points bigint,
  n bigint,
  mean_score numeric
)
language sql stable security definer as $$
with matched_skills as (
  select ts.id as template_skill_id, ts.skill_group_id, ts.max_points::numeric
  from public.template_skills ts
  where ts.skill_group_id = any(p_skill_group_ids)
),
skill_stats as (
  select
    f.template_skill_id,
    count(*)                    as n,
    avg(f.score_value)          as mean_score
  from public.v_benchmark_skill_facts_v2 f
  join matched_skills ms on ms.template_skill_id = f.template_skill_id
  where (p_submitted_year   is null or extract(year from f.submitted_at)::int = p_submitted_year)
    and (p_country          is null or f.country          = p_country)
    and (p_industry         is null or f.industry         = p_industry)
    and (p_job_level        is null or f.job_level        = p_job_level)
    and (p_functional_area  is null or f.functional_area  = p_functional_area)
    and (p_role             is null or f.role             = p_role)
    and (p_region           is null or f.region           = p_region)
    and (p_sub_region       is null or f.sub_region       = p_sub_region)
    and (p_years_experience is null or f.years_experience = p_years_experience)
    and (p_education_level  is null or f.education_level  = p_education_level)
  group by f.template_skill_id
)
select
  ms.skill_group_id,
  tsg.name                                                            as skill_group_name,
  sum(ms.max_points)::bigint                                          as total_possible_points,
  min(ss.n)::bigint                                                   as n,
  sum(ss.mean_score)                                                  as mean_score
from skill_stats ss
join matched_skills ms on ms.template_skill_id = ss.template_skill_id
join public.template_skill_groups tsg on tsg.id = ms.skill_group_id
group by ms.skill_group_id, tsg.name;
$$;
```

### Updated `public.rpc_dynamic_skill_benchmark_live_v2(...)`

Now uses `v_benchmark_skill_facts_v2` instead of `v_benchmark_skill_facts_live`. No `p_template_id` — queries by `template_skill_id` directly across all templates.

```sql
create or replace function public.rpc_dynamic_skill_benchmark_live_v2(
  p_template_skill_id uuid,
  p_submitted_year integer default null,
  p_country text default null,
  p_industry text default null,
  p_job_level text default null,
  p_functional_area text default null,
  p_role text default null,
  p_region text default null,
  p_sub_region text default null,
  p_years_experience integer default null,
  p_education_level text default null
)
returns table(
  n bigint,
  mean_score numeric,
  p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric
)
language sql stable security definer as $$
with base as (
  select f.score_value
  from public.v_benchmark_skill_facts_v2 f
  where f.template_skill_id = p_template_skill_id
    and (p_submitted_year   is null or extract(year from f.submitted_at)::int = p_submitted_year)
    and (p_country          is null or f.country          = p_country)
    and (p_industry         is null or f.industry         = p_industry)
    and (p_job_level        is null or f.job_level        = p_job_level)
    and (p_functional_area  is null or f.functional_area  = p_functional_area)
    and (p_role             is null or f.role             = p_role)
    and (p_region           is null or f.region           = p_region)
    and (p_sub_region       is null or f.sub_region       = p_sub_region)
    and (p_years_experience is null or f.years_experience = p_years_experience)
    and (p_education_level  is null or f.education_level  = p_education_level)
)
select
  count(*)::bigint                                          as n,
  avg(score_value)                                         as mean_score,
  percentile_cont(0.10) within group (order by score_value) as p10,
  percentile_cont(0.25) within group (order by score_value) as p25,
  percentile_cont(0.50) within group (order by score_value) as p50,
  percentile_cont(0.75) within group (order by score_value) as p75,
  percentile_cont(0.90) within group (order by score_value) as p90
from base;
$$;
```

### Notes

- Applied to staging only (not yet in `main`)
- `v_benchmark_skill_facts_v2` captures scores from all templates (no `template_id` filter) — fixes cross-template benchmark accuracy
- `rpc_skill_group_benchmark_v2` now batched (accepts array of IDs) — reduces N API calls to 1
- Both individual user routes (`/api/assessment/benchmark`, `/api/assessment/skill-benchmark`) updated to use v2 RPCs
- Corp admin routes already used v2 RPCs; `p_cohort_template_id` param removed from group benchmark

## 2026-03-10

### Added `country_id` column to `public.user_settings`

```sql
alter table public.user_settings
add column country_id integer null;

alter table public.user_settings
add constraint user_settings_country_id_fkey
foreign key (country_id)
references public.countries (country_id)
on update cascade
on delete set null;
```

### Notes

- Applied to staging only (not yet in `main`)
- `country_id` stores the user's selected benchmark country when `benchmark_default = 'country'`
- FK references `countries.country_id` (integer PK); `on delete set null` so removing a country row doesn't orphan user settings

## 2026-03-11

### Added composite index on `public.v_benchmark_skill_facts_v2`

Fixes statement timeout on `rpc_skill_group_benchmark_v2` by allowing index-only scans on the join between the materialized view and `matched_skills`.

```sql
create index if not exists v_benchmark_skill_facts_v2_skill_group_template_idx
  on public.v_benchmark_skill_facts_v2 (skill_group_id, template_skill_id);
```

### Notes

- Applied to staging only (not yet in `main`)
- Previous single-column indexes on `skill_group_id` and `template_skill_id` were insufficient for the batched RPC join pattern
- If timeouts persist after indexing, also apply `set statement_timeout = '30s'` to `rpc_skill_group_benchmark_v2` (see benchmark route fix notes in 2026-03-09 entry)

### Added `also_participant` and `participant_type` columns to `public.cohort_members`

Supports multi-role users — e.g. a corp_admin who also participates in their own cohort as a user or reviewer. The `role` column is preserved (stays `corp_admin`); participation is tracked separately.

```sql
alter table public.cohort_members
add column also_participant boolean not null default false,
add column participant_type text null
  check (participant_type in ('user', 'reviewer'));
```

### Notes

- Applied to staging only (not yet in `main`)
- `also_participant = true` + `participant_type` is set when a high-privilege user (corp_admin) is added to a cohort as a user/reviewer, instead of overwriting their `role`
- Used by `getUserRoles()` to detect multi-role contexts and present the role selector UI

### Updated `public.refresh_cohort_seats_used(uuid)`

Fixes seat counting for multi-role users. Previously excluded only `corp_admin` rows; now also excludes `reviewer` rows unless `participant_type = 'user'` (i.e. the reviewer was explicitly invited as a cohort participant).

```sql
CREATE OR REPLACE FUNCTION public.refresh_cohort_seats_used(p_cohort_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.cohorts c
  set seats_used = (
    select count(*)
    from public.cohort_members cm
    where cm.cohort_id = p_cohort_id
      and not (
        cm.role in ('corp_admin', 'reviewer')
        and cm.participant_type is distinct from 'user'
      )
  )
  where c.id = p_cohort_id;
end;
$function$
```

### Notes

- Applied to staging only (not yet in `main`)
- A `corp_admin` or `reviewer` row is now counted toward seats only when `participant_type = 'user'`

### Added `location` column to `public.cohorts`

Allows corp admins to record a location for each cohort (e.g. city/country of the group being assessed).

```sql
alter table public.cohorts
add column location text null;
```

### Notes

- Applied to staging only (not yet in `main`)
- Free-text field, no FK constraint — e.g. "New York, USA"
- Editable via the corp admin Account page (scoped to the active cohort)
