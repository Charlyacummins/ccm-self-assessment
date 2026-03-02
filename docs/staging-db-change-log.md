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
