alter table public.jzb_tasks add column completed_at timestamptz, add column completed_by uuid references auth.users(id);
create index jzb_tasks_completed_by_idx on public.jzb_tasks(completed_by);
grant update(status) on public.jzb_tasks to authenticated;
-- RLS continues to restrict writers; this trigger additionally excludes admin from changing task status.
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
   if actor_role not in ('jefe','subjefe') then raise exception 'Solo el Jefe o el Subjefe puede cambiar el estado de una tarea' using errcode='42501';end if;
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
create or replace function jzb_private.append_task_history() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();actor_label text;previous jsonb;
begin
 select coalesce(display_name,email,'Responsable') into actor_label from public.profiles where id=actor and role in ('admin','jefe','subjefe') and not must_change_password;
 if actor is null or actor_label is null then raise exception 'No tiene permiso para registrar cambios' using errcode='42501';end if;
 if tg_op='UPDATE' then previous:=jsonb_build_object('section',old.section,'due_date',old.due_date,'title',old.title,'assignee',old.assignee_text,'status',old.status);end if;
 insert into public.jzb_task_history(task_id,actor_id,actor_name,event,before_values,after_values)
 values(new.id,actor,actor_label,case when tg_op='INSERT' then 'created' else 'updated' end,previous,jsonb_build_object('section',new.section,'due_date',new.due_date,'title',new.title,'assignee',new.assignee_text,'status',new.status));
 return new;
end;$$;
revoke all on function jzb_private.append_task_history() from public,anon,authenticated;
