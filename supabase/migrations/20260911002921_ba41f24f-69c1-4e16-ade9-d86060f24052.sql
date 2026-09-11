create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  category text not null default 'general',
  priority text not null default 'medium',
  status text not null default 'todo',
  platform text not null default 'both',
  position integer not null default 0,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.admin_tasks to authenticated;
grant all on public.admin_tasks to service_role;

alter table public.admin_tasks enable row level security;

drop policy if exists "Admins manage admin tasks" on public.admin_tasks;
create policy "Admins manage admin tasks"
on public.admin_tasks for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create index if not exists idx_admin_tasks_status on public.admin_tasks(status, position);