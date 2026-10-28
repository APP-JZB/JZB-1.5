-- Credentials are handled by Supabase Auth. These tables only resolve private login aliases.
create table public.jzb_access_accounts(
 id uuid primary key references public.profiles(id), phone text unique not null,
 auth_email text unique not null, username text unique,
 contact_email text, setup_complete boolean not null default false,
 setup_lock timestamptz,
 check(username is null or username ~ '^[a-z][a-z0-9_.-]{2,29}$')
);
alter table public.jzb_access_accounts enable row level security;
revoke all on public.jzb_access_accounts from anon,authenticated;
grant all on public.jzb_access_accounts to service_role;
create table public.jzb_access_bootstrap(token_hash text primary key, directory_id uuid not null references public.jzb_responsibles(id),phone text not null,expires_at timestamptz not null);
alter table public.jzb_access_bootstrap enable row level security;
revoke all on public.jzb_access_bootstrap from anon,authenticated;
grant all on public.jzb_access_bootstrap to service_role;
create table public.jzb_access_attempts(key text primary key,started_at timestamptz not null default now(),attempts integer not null default 1);
alter table public.jzb_access_attempts enable row level security;
revoke all on public.jzb_access_attempts from anon,authenticated;
grant all on public.jzb_access_attempts to service_role;
create function public.jzb_access_rate_limit(attempt_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare total integer;
begin
 insert into public.jzb_access_attempts(key) values(attempt_key) on conflict(key) do update set attempts=case when public.jzb_access_attempts.started_at<now()-interval '15 minutes' then 1 else public.jzb_access_attempts.attempts+1 end,started_at=case when public.jzb_access_attempts.started_at<now()-interval '15 minutes' then now() else public.jzb_access_attempts.started_at end returning attempts into total;
 return total<=10;
end;$$;
revoke all on function public.jzb_access_rate_limit(text) from public,anon,authenticated;
grant execute on function public.jzb_access_rate_limit(text) to service_role;
