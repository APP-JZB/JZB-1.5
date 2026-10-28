-- Task creation, editing and private documents. No operational data in source.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','jefe','subjefe','user'));
create unique index profiles_single_leadership_role on public.profiles(role) where role in ('jefe','subjefe');

alter table public.jzb_tasks
 add column created_by uuid references auth.users(id),
 add column updated_by uuid references auth.users(id),
 add column updated_at timestamptz not null default now(),
 add column revision integer not null default 1;
create index jzb_tasks_created_by_idx on public.jzb_tasks(created_by);
create index jzb_tasks_updated_by_idx on public.jzb_tasks(updated_by);
alter table public.jzb_tasks add constraint jzb_task_input_lengths check(length(title)<=240 and length(description)<=20000 and coalesce(length(assignee_text),0)<=240);

drop policy "Admin reads imported tasks" on public.jzb_tasks;
drop policy "Admin reviews imported tasks" on public.jzb_tasks;
create policy "Managers read tasks" on public.jzb_tasks for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));
create policy "Managers create tasks" on public.jzb_tasks for insert to authenticated
 with check (created_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));
create policy "Managers edit tasks" on public.jzb_tasks for update to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password))
 with check (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));
grant insert(id,title,description,section,assignee_text,due_date) on public.jzb_tasks to authenticated;
grant update(title,description,section,assignee_text,due_date) on public.jzb_tasks to authenticated;

create table public.jzb_task_history (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.jzb_tasks(id) on delete restrict,
 actor_id uuid not null references auth.users(id),
 actor_name text not null,
 event text not null check(event in ('created','updated')),
 before_values jsonb,
 after_values jsonb not null,
 created_at timestamptz not null default now()
);
create index jzb_task_history_task_idx on public.jzb_task_history(task_id,created_at);
create index jzb_task_history_actor_idx on public.jzb_task_history(actor_id);
alter table public.jzb_task_history enable row level security;
revoke all on public.jzb_task_history from anon,authenticated;
grant select on public.jzb_task_history to authenticated;
create policy "Managers read task history" on public.jzb_task_history for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));

create schema if not exists jzb_private;
revoke all on schema jzb_private from public,anon,authenticated;
-- Required to append an immutable audit record while application roles have no INSERT permission on history.
create function jzb_private.audit_task_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); actor_label text;
begin
 select coalesce(display_name,email,'Responsable') into actor_label from public.profiles
 where id=actor and role in ('admin','jefe','subjefe') and not must_change_password;
 if actor is null or actor_label is null then raise exception 'No tiene permiso para gestionar tareas' using errcode='42501'; end if;
 if tg_op='INSERT' then
  new.created_by:=actor; new.updated_by:=actor; new.revision:=1;
  new.created_at:=now(); new.updated_at:=now();new.status:='pendiente';
  new.source_key:='manual:'||new.id::text;new.source_filename:='Ingreso manual';new.needs_review:=false;new.review_notes:='';
 else
  new.updated_by:=actor;new.updated_at:=now();new.revision:=old.revision+1;
  if new.due_date is distinct from old.due_date then
   new.deadline_text:=case when new.due_date is null then null else to_char(new.due_date,'DD/MM/YYYY') end;
  end if;
 end if;
 return new;
end;$$;
revoke all on function jzb_private.audit_task_write() from public,anon,authenticated;
create trigger prepare_task_write before insert or update on public.jzb_tasks for each row execute function jzb_private.audit_task_write();

create function jzb_private.append_task_history() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_label text; previous jsonb;
begin
 select coalesce(display_name,email,'Responsable') into actor_label from public.profiles where id=actor and role in ('admin','jefe','subjefe') and not must_change_password;
 if actor is null or actor_label is null then raise exception 'No tiene permiso para registrar cambios' using errcode='42501';end if;
 if tg_op='UPDATE' then
  previous:=jsonb_build_object('section',old.section,'due_date',old.due_date,'title',old.title,'assignee',old.assignee_text);
 end if;
 insert into public.jzb_task_history(task_id,actor_id,actor_name,event,before_values,after_values)
 values(new.id,actor,actor_label,case when tg_op='INSERT' then 'created' else 'updated' end,previous,jsonb_build_object('section',new.section,'due_date',new.due_date,'title',new.title,'assignee',new.assignee_text));
 return new;
end;$$;
revoke all on function jzb_private.append_task_history() from public,anon,authenticated;
create trigger record_task_write after insert or update on public.jzb_tasks for each row execute function jzb_private.append_task_history();

create table public.jzb_task_attachments (
 id uuid primary key,
 task_id uuid not null references public.jzb_tasks(id) on delete restrict,
 object_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 255),
 mime_type text not null,
 size_bytes bigint not null check(size_bytes between 1 and 10485760),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 check(object_path=task_id::text||'/'||id::text)
);
create index jzb_task_attachments_task_idx on public.jzb_task_attachments(task_id);
create index jzb_task_attachments_creator_idx on public.jzb_task_attachments(created_by);
alter table public.jzb_task_attachments enable row level security;
revoke all on public.jzb_task_attachments from anon,authenticated;
grant select on public.jzb_task_attachments to authenticated;
grant insert(id,task_id,object_path,file_name,mime_type,size_bytes) on public.jzb_task_attachments to authenticated;
create policy "Managers read task documents" on public.jzb_task_attachments for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));
create policy "Managers register task documents" on public.jzb_task_attachments for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password)
 and exists(select 1 from storage.objects where bucket_id='jzb-task-documents' and name=object_path));

insert into storage.buckets(id,name,public,file_size_limit) values('jzb-task-documents','jzb-task-documents',false,10485760);
create policy "Managers upload task documents" on storage.objects for insert to authenticated
 with check(bucket_id='jzb-task-documents' and array_length(string_to_array(name,'/'),1)=2
 and exists(select 1 from public.jzb_tasks t where t.id::text=split_part(name,'/',1))
 and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));
create policy "Managers download task documents" on storage.objects for select to authenticated
 using(bucket_id='jzb-task-documents' and exists(select 1 from public.jzb_tasks t where t.id::text=split_part(name,'/',1))
 and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));
-- Cleanup only for an upload that has no registered document yet.
create policy "Managers clean unfinished task uploads" on storage.objects for delete to authenticated
 using(bucket_id='jzb-task-documents'
 and not exists(select 1 from public.jzb_task_attachments a where a.object_path=name)
 and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','jefe','subjefe') and not must_change_password));
