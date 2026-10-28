-- No task contents or personal data belong in this public source file.
create table public.jzb_tasks (
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique,
 section text not null check (section in ('Asistencial','Coordinación Habitacional','Servicio Bandas','Planificación','Personal','Finanzas','Recreacional','Logística')),
 title text not null check (length(trim(title)) > 0),
 description text not null default '',
 assignee_text text,
 status text not null default 'pendiente' check(status in ('pendiente','en_desarrollo','finalizada')),
 due_date date,
 deadline_text text,
 needs_review boolean not null default true,
 review_notes text not null default '',
 source_filename text not null,
 created_at timestamptz not null default now()
);
alter table public.jzb_tasks enable row level security;
revoke all on public.jzb_tasks from anon, authenticated;
grant select on public.jzb_tasks to authenticated;
grant update (due_date,needs_review,review_notes) on public.jzb_tasks to authenticated;
create policy "Admin reads imported tasks" on public.jzb_tasks for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and not must_change_password));
create policy "Admin reviews imported tasks" on public.jzb_tasks for update to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and not must_change_password))
 with check (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and not must_change_password));
create index jzb_tasks_section_due_idx on public.jzb_tasks(section,due_date);
