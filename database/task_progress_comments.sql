-- Section membership is assigned by the administrator, never by the user.
alter table public.profiles add column section text check(section in ('Asistencial','Coordinación Habitacional','Servicio Bandas','Planificación','Personal','Finanzas','Recreacional','Logística'));
create policy "Enabled users read general tasks" on public.jzb_tasks for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='user' and not must_change_password));
create table public.jzb_task_comments(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.jzb_tasks(id),
 actor_id uuid not null default auth.uid() references public.profiles(id),
 actor_name text not null,
 section text not null,
 body text not null check(length(trim(body)) between 1 and 10000),
 ready_for_review boolean not null default false,
 created_at timestamptz not null default now()
);
create index jzb_task_comments_task_time_idx on public.jzb_task_comments(task_id,created_at desc);
create index jzb_task_comments_actor_idx on public.jzb_task_comments(actor_id);
alter table public.jzb_task_comments enable row level security;
grant select on public.jzb_task_comments to authenticated;
grant insert(id,task_id,body,ready_for_review) on public.jzb_task_comments to authenticated;
create policy "Enabled profiles read progress" on public.jzb_task_comments for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and not must_change_password and role in ('admin','jefe','subjefe','user')));
create policy "Assigned section records progress" on public.jzb_task_comments for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from public.profiles p join public.jzb_tasks t on t.id=task_id where p.id=(select auth.uid()) and not p.must_change_password and (p.role in ('jefe','subjefe') or (p.role='user' and p.section=t.section)) and t.status<>'finalizada'));
create function jzb_private.stamp_task_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select coalesce(p.display_name,p.email,'Responsable'),t.section into new.actor_name,new.section from public.profiles p join public.jzb_tasks t on t.id=new.task_id where p.id=auth.uid() and not p.must_change_password and (p.role in ('jefe','subjefe') or (p.role='user' and p.section=t.section)) and t.status<>'finalizada' for share of t;
 if new.actor_name is null then raise exception 'Solo la sección asignada o la Jefatura puede registrar avances en una tarea abierta' using errcode='42501';end if;
 new.actor_id:=auth.uid();new.created_at:=now();return new;
end;$$;
revoke all on function jzb_private.stamp_task_comment() from public,anon,authenticated;
create trigger stamp_task_comment before insert on public.jzb_task_comments for each row execute function jzb_private.stamp_task_comment();
