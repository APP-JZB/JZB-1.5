-- Directory entries are not authentication accounts. Operational roster is loaded privately.
create table public.jzb_responsibles(
 id uuid primary key default gen_random_uuid(),
 rank text not null, full_name text not null, position text not null,
 section text, profile_id uuid unique references public.profiles(id),
 active boolean not null default true
);
create index jzb_responsibles_profile_idx on public.jzb_responsibles(profile_id);
alter table public.jzb_responsibles enable row level security;
grant select on public.jzb_responsibles to authenticated;
create policy "Enabled profiles read directory" on public.jzb_responsibles for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and not must_change_password and role in ('admin','jefe','subjefe','user')));
alter table public.jzb_tasks add column responsible_ids uuid[] not null default '{}';
create index jzb_tasks_responsible_ids_idx on public.jzb_tasks using gin(responsible_ids);
grant insert(responsible_ids),update(responsible_ids) on public.jzb_tasks to authenticated;
create function jzb_private.validate_responsibles() returns trigger language plpgsql security definer set search_path='' as $$
declare actor_role text;previous jsonb;
begin
 if (tg_op='INSERT' and cardinality(new.responsible_ids)>0) or (tg_op='UPDATE' and new.responsible_ids is distinct from old.responsible_ids) then
  select role into actor_role from public.profiles where id=auth.uid() and not must_change_password;
  if actor_role is null or actor_role not in ('jefe','subjefe') then raise exception 'Solo el Jefe o Subjefe puede designar responsables' using errcode='42501';end if;
  if cardinality(new.responsible_ids)>50 or exists(select 1 from unnest(new.responsible_ids) r(id) where not exists(select 1 from public.jzb_responsibles d where d.id=r.id and d.active)) or cardinality(new.responsible_ids)<>(select count(distinct id) from unnest(new.responsible_ids) r(id)) then raise exception 'Selección de responsables no válida' using errcode='23514';end if;
  if tg_op='UPDATE' then previous:=jsonb_build_object('responsible_ids',old.responsible_ids);end if;
  insert into public.jzb_task_history(task_id,actor_id,actor_name,event,before_values,after_values)
  select new.id,p.id,coalesce(p.display_name,p.email,'Jefatura'),'updated',previous,jsonb_build_object('responsible_ids',new.responsible_ids) from public.profiles p where p.id=auth.uid();
 end if;
 return new;
end;$$;
revoke all on function jzb_private.validate_responsibles() from public,anon,authenticated;
-- AFTER ensures the task exists before recording the assignment audit.
create trigger validate_responsibles after insert or update on public.jzb_tasks for each row execute function jzb_private.validate_responsibles();
drop policy "Assigned section records progress" on public.jzb_task_comments;
create policy "Assigned section records progress" on public.jzb_task_comments for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from public.profiles p join public.jzb_tasks t on t.id=task_id where p.id=(select auth.uid()) and not p.must_change_password and (p.role in ('jefe','subjefe') or (p.role='user' and (p.section=t.section or exists(select 1 from public.jzb_responsibles d where d.profile_id=p.id and d.active and d.id=any(t.responsible_ids))))) and t.status<>'finalizada'));
create or replace function jzb_private.stamp_task_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select coalesce(p.display_name,p.email,'Responsable'),t.section into new.actor_name,new.section from public.profiles p join public.jzb_tasks t on t.id=new.task_id where p.id=auth.uid() and not p.must_change_password and (p.role in ('jefe','subjefe') or (p.role='user' and (p.section=t.section or exists(select 1 from public.jzb_responsibles d where d.profile_id=p.id and d.active and d.id=any(t.responsible_ids))))) and t.status<>'finalizada' for share of t;
 if new.actor_name is null then raise exception 'No tiene permiso para registrar avances en esta tarea' using errcode='42501';end if;
 new.actor_id:=auth.uid();new.created_at:=now();return new;
end;$$;
revoke all on function jzb_private.stamp_task_comment() from public,anon,authenticated;
