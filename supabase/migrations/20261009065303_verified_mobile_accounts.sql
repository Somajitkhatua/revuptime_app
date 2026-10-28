create or replace function revuptime_private.account_profile()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); u auth.users; p public.profiles; m public.organization_members; org uuid;
begin
 if actor is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 select * into u from auth.users where id=actor;
 if not found or u.email_confirmed_at is null then raise exception 'Verify your email before continuing' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 insert into public.profiles(id,email,full_name) values(actor,u.email,coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1))) on conflict(id) do nothing;
 select * into p from public.profiles where id=actor;
 if p.status <> 'active' then raise exception 'Account is inactive. Contact your administrator.' using errcode='42501'; end if;
 select * into m from public.organization_members where user_id=actor and status='active' order by joined_at limit 1;
 if not found then
  if exists(select 1 from public.organization_members where user_id=actor) then raise exception 'Workspace access is inactive. Contact your administrator.' using errcode='42501'; end if;
  org := revuptime_private.create_workspace(coalesce(nullif(trim(p.full_name),''),'My')||' workspace','workspace-'||replace(actor::text,'-',''),null);
  insert into public.sites(organization_id,name,code,timezone) values(org,'Main plant','MAIN','Asia/Kolkata');
  select * into m from public.organization_members where user_id=actor and organization_id=org;
 end if;
 return jsonb_build_object('id',actor,'name',coalesce(nullif(p.full_name,''),u.email),'email',u.email,'organization_id',m.organization_id,'role',case m.role when 'owner' then 'Owner' when 'admin' then 'Admin' when 'manager' then 'Maintenance Manager' when 'technician' then 'Technician' when 'viewer' then 'Viewer' else 'Operator' end);
end $$;
revoke all on function revuptime_private.account_profile() from public,anon;
grant usage on schema revuptime_private to authenticated;
grant execute on function revuptime_private.account_profile() to authenticated;
create or replace function public.revuptime_account_profile() returns jsonb language sql security invoker set search_path='' as $$ select revuptime_private.account_profile(); $$;
revoke all on function public.revuptime_account_profile() from public,anon;
grant execute on function public.revuptime_account_profile() to authenticated;
alter table public.profiles add column if not exists push_token text;
notify pgrst,'reload schema';
