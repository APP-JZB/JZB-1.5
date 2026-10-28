create or replace function jzb_private.audit_task_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();actor_label text;actor_role text;
begin
 select coalesce(display_name,email,'Responsable'),role into actor_label,actor_role from public.profiles
 where id=actor and role in ('admin','jefe','subjefe') and not must_change_password;
 if actor is null or actor_label is null then raise exception 'No tiene permiso para gestionar tareas' using errcode='42501';end if;
 if tg_op='INSERT' then
  new.created_by:=actor;new.updated_by:=actor;new.revision:=1;new.created_at:=now();new.updated_at:=now();new.status:='pendiente';
  new.completed_at:=null;new.completed_by:=null;
  new.source_key:='manual:'||new.id::text;new.source_filename:='Ingreso manual';new.needs_review:=false;new.review_notes:='';
 else
  if new.status is distinct from old.status then
   if actor_role not in ('admin','jefe','subjefe') then raise exception 'Solo el Administrador, Jefe o Subjefe puede cambiar el estado de una tarea' using errcode='42501';end if;
   if new.status='finalizada' then new.completed_at:=now();new.completed_by:=actor;
   else new.completed_at:=null;new.completed_by:=null;end if;
  else new.completed_at:=old.completed_at;new.completed_by:=old.completed_by;end if;
  new.updated_by:=actor;new.updated_at:=now();new.revision:=old.revision+1;
  if new.due_date is distinct from old.due_date then
   new.deadline_text:=case when new.due_date is null then null else to_char(new.due_date,'DD/MM/YYYY') end;
  end if;
 end if;
 return new;
end;$$;
revoke all on function jzb_private.audit_task_write() from public,anon,authenticated;
create or replace function jzb_private.validate_responsibles() returns trigger language plpgsql security definer set search_path='' as $$
declare actor_role text;previous jsonb;
begin
 if (tg_op='INSERT' and cardinality(new.responsible_ids)>0) or (tg_op='UPDATE' and new.responsible_ids is distinct from old.responsible_ids) then
  select role into actor_role from public.profiles where id=auth.uid() and not must_change_password;
  if actor_role is null or actor_role not in ('admin','jefe','subjefe') then raise exception 'Solo el Administrador, Jefe o Subjefe puede designar responsables' using errcode='42501';end if;
  if cardinality(new.responsible_ids)>50 or exists(select 1 from unnest(new.responsible_ids) r(id) where not exists(select 1 from public.jzb_responsibles d where d.id=r.id and d.active)) or cardinality(new.responsible_ids)<>(select count(distinct id) from unnest(new.responsible_ids) r(id)) then raise exception 'Selección de responsables no válida' using errcode='23514';end if;
  if tg_op='UPDATE' then previous:=jsonb_build_object('responsible_ids',old.responsible_ids);end if;
  insert into public.jzb_task_history(task_id,actor_id,actor_name,event,before_values,after_values)
  select new.id,p.id,coalesce(p.display_name,p.email,'Jefatura'),'updated',previous,jsonb_build_object('responsible_ids',new.responsible_ids) from public.profiles p where p.id=auth.uid();
 end if;
 return new;
end;$$;
revoke all on function jzb_private.validate_responsibles() from public,anon,authenticated;
drop policy "Assigned section records progress" on public.jzb_task_comments;
create policy "Assigned section records progress" on public.jzb_task_comments for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from public.profiles p join public.jzb_tasks t on t.id=task_id where p.id=(select auth.uid()) and not p.must_change_password and (p.role in ('admin','jefe','subjefe') or (p.role='user' and (p.section=t.section or exists(select 1 from public.jzb_responsibles d where d.profile_id=p.id and d.active and d.id=any(t.responsible_ids))))) and t.status<>'finalizada'));
create or replace function jzb_private.stamp_task_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select coalesce(p.display_name,p.email,'Responsable'),t.section into new.actor_name,new.section from public.profiles p join public.jzb_tasks t on t.id=new.task_id where p.id=auth.uid() and not p.must_change_password and (p.role in ('admin','jefe','subjefe') or (p.role='user' and (p.section=t.section or exists(select 1 from public.jzb_responsibles d where d.profile_id=p.id and d.active and d.id=any(t.responsible_ids))))) and t.status<>'finalizada' for share of t;
 if new.actor_name is null then raise exception 'No tiene permiso para registrar avances en esta tarea' using errcode='42501';end if;
 new.actor_id:=auth.uid();new.created_at:=now();return new;
end;$$;
revoke all on function jzb_private.stamp_task_comment() from public,anon,authenticated;
