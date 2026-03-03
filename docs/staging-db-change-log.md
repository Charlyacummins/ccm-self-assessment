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
