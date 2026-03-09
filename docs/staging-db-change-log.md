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
