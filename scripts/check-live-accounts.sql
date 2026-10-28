-- Transactional integration checks: test users and data are rolled back.
begin;
create temporary table rv_test_ids(owner_id uuid,viewer_id uuid,unverified_id uuid,org_id uuid,asset_id uuid,order_id uuid);
insert into rv_test_ids values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,null,null);
grant all on rv_test_ids to authenticated;
insert into auth.users(id,email,role,aud,email_confirmed_at,raw_user_meta_data)
select owner_id,'rv-test-'||owner_id||'@example.invalid','authenticated','authenticated',now(),'{"full_name":"Test Owner"}'::jsonb from rv_test_ids union all
select viewer_id,'rv-test-'||viewer_id||'@example.invalid','authenticated','authenticated',now(),'{"full_name":"Test Viewer"}'::jsonb from rv_test_ids union all
select unverified_id,'rv-test-'||unverified_id||'@example.invalid','authenticated','authenticated',null,'{}'::jsonb from rv_test_ids;
select set_config('request.jwt.claim.sub',(select owner_id::text from rv_test_ids),true);
set local role authenticated;
do $$declare p jsonb;p2 jsonb;begin
 p:=public.revuptime_account_profile();p2:=public.revuptime_account_profile();
 if p->>'role'<>'Owner' or p->>'organization_id'<>p2->>'organization_id' then raise exception 'FAIL: onboarding not idempotent';end if;
 update rv_test_ids set org_id=(p->>'organization_id')::uuid;
end $$;
reset role;
insert into public.profiles(id,email,full_name) select viewer_id,'rv-test-'||viewer_id||'@example.invalid','Test Viewer' from rv_test_ids;
insert into public.organization_members(organization_id,user_id,role,status) select org_id,viewer_id,'viewer','active' from rv_test_ids;
select set_config('request.jwt.claim.sub',(select unverified_id::text from rv_test_ids),true);
set local role authenticated;
do $$begin begin perform public.revuptime_account_profile();raise exception 'FAIL: unverified account accepted';exception when insufficient_privilege then null;end;end $$;
reset role;
select set_config('request.jwt.claim.sub',(select viewer_id::text from rv_test_ids),true);
set local role authenticated;
do $$begin
 begin insert into public.sites(organization_id,name) select org_id,'Forbidden site' from rv_test_ids;raise exception 'FAIL: Viewer write accepted';exception when insufficient_privilege then null;end;
 if (public.revuptime_account_profile()->>'role')<>'Viewer' then raise exception 'FAIL: Viewer role changed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select owner_id::text from rv_test_ids),true);
set local role authenticated;
do $$declare a uuid;w jsonb;wid uuid;before_count int;after_count int;begin
 insert into public.assets(organization_id,site_id,name,asset_code,asset_type) select org_id,(select id from public.sites where organization_id=org_id limit 1),'Integration motor','TEST-MOTOR','motor' from rv_test_ids returning id into a;
 update rv_test_ids set asset_id=a;
 w:=public.revuptime_mobile_create_work_order((select org_id from rv_test_ids),jsonb_build_object('asset_id',a,'title','Test inspection','priority','High','due_date','2026-10-15'));wid:=(w->>'id')::uuid;
 update rv_test_ids set order_id=wid;
 begin perform public.revuptime_mobile_complete_work_order((select org_id from rv_test_ids),wid,'{"root_cause":"Bearing","action_taken":"Lubricated","downtime_minutes":45,"final_vibration":2.8}');raise exception 'FAIL: incomplete checklist accepted';exception when raise_exception then if sqlerrm='FAIL: incomplete checklist accepted' then raise;end if;end;
 update public.work_order_tasks set status='completed' where work_order_id=wid;
 perform public.revuptime_mobile_complete_work_order((select org_id from rv_test_ids),wid,'{"root_cause":"Bearing","action_taken":"Lubricated","downtime_minutes":45,"final_vibration":2.8}');
 select count(*) into before_count from public.maintenance_events where work_order_id=wid;if before_count<>1 then raise exception 'FAIL: completion history missing';end if;
 begin perform public.revuptime_mobile_complete_work_order((select org_id from rv_test_ids),wid,'{}');raise exception 'FAIL: duplicate completion accepted';exception when raise_exception then if sqlerrm='FAIL: duplicate completion accepted' then raise;end if;end;
 select count(*) into after_count from public.maintenance_events where work_order_id=wid;if after_count<>before_count then raise exception 'FAIL: duplicate history';end if;
 begin update public.work_order_tasks set status='pending' where work_order_id=wid;raise exception 'FAIL: closed checklist editable';exception when raise_exception then if sqlerrm='FAIL: closed checklist editable' then raise;end if;end;
end $$;
reset role;
rollback;
