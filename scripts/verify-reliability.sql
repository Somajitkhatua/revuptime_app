-- Run after loading reliability-update.sql, inside a transaction; all fixtures roll back.
create temporary table reliability_ids as select gen_random_uuid() owner_id,gen_random_uuid() viewer_id,gen_random_uuid() org,gen_random_uuid() other_org,gen_random_uuid() site,gen_random_uuid() asset,gen_random_uuid() fast_sensor,gen_random_uuid() slow_sensor,gen_random_uuid() doc,gen_random_uuid() job;
insert into auth.users(id,email,email_confirmed_at) select owner_id,'reliability-owner@example.invalid',now() from reliability_ids union all select viewer_id,'reliability-viewer@example.invalid',now() from reliability_ids;
insert into public.profiles(id,email,full_name) select owner_id,'reliability-owner@example.invalid','Synthetic QA Owner' from reliability_ids union all select viewer_id,'reliability-viewer@example.invalid','Synthetic QA Viewer' from reliability_ids;
insert into public.organizations(id,name,slug) select org,'Synthetic QA','qa-'||org from reliability_ids union all select other_org,'Synthetic Other','qa-'||other_org from reliability_ids;
insert into public.organization_members(organization_id,user_id,role,status) select org,owner_id,'owner','active' from reliability_ids union all select org,viewer_id,'viewer','active' from reliability_ids;
insert into public.sites(id,organization_id,name) select site,org,'Synthetic Site' from reliability_ids;
insert into public.assets(id,organization_id,site_id,name) select asset,org,site,'Synthetic Motor' from reliability_ids;
insert into public.sensors(id,organization_id,site_id,asset_id,name,sensor_type,measurement_type) select fast_sensor,org,site,asset,'Fast','vibration','x_rms' from reliability_ids union all select slow_sensor,org,site,asset,'Slow','temperature','temperature' from reliability_ids;
insert into public.sensor_readings(organization_id,site_id,asset_id,sensor_id,timestamp,value,unit,metadata)
select org,site,asset,fast_sensor,now()-interval '1 day'+g*interval '1 minute',case when g=600 then 99 else 2 end,'mm/s','{"metric":"x_rms"}'::jsonb from reliability_ids cross join generate_series(0,1200) g;
insert into public.sensor_readings(organization_id,site_id,asset_id,sensor_id,timestamp,value,unit,metadata)
select org,site,asset,slow_sensor,now()-interval '2 days',0,'°C','{"metric":"temperature"}'::jsonb from reliability_ids;
insert into public.asset_documents(id,organization_id,asset_id,uploaded_by,name,document_type,mime_type,storage_bucket,storage_path,metadata)
select doc,org,asset,owner_id,'Synthetic manual','OEM Manual','application/pdf','asset-documents',org||'/'||asset||'/qa.pdf','{"status":"Queued"}'::jsonb from reliability_ids;
do $$ declare t record; r jsonb; begin
  select * into t from reliability_ids;
  if public.revuptime_claim_document(t.doc,t.org,t.job) is null then raise exception 'claim failed'; end if;
  if public.revuptime_claim_document(t.doc,t.org,gen_random_uuid()) is not null then raise exception 'concurrent claim accepted'; end if;
  if public.revuptime_finish_document(t.doc,gen_random_uuid(),1,'[]') then raise exception 'stale worker accepted'; end if;
  if not public.revuptime_finish_document(t.doc,t.job,2,'[{"chunk_index":0,"page_number":2,"content":"The tightening torque for the synthetic coupling is 12 Nm."}]') then raise exception 'completion failed'; end if;
  if has_function_privilege('authenticated','public.revuptime_claim_document(uuid,uuid,uuid)','execute') then raise exception 'worker exposed to client'; end if;
end $$;
grant select on reliability_ids to authenticated;
select set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true) is not null as owner_claim_set from reliability_ids;
set local role authenticated;
do $$ declare t record; r jsonb; begin
  select * into t from reliability_ids;
  r:=public.revuptime_latest_readings(t.org,t.asset);
  if jsonb_array_length(r)<>2 then raise exception 'slow sensor omitted'; end if;
  if not exists(select 1 from jsonb_array_elements(r) v where (v->>'sensor_id')::uuid=t.slow_sensor and (v->>'value')::numeric=0) then raise exception 'zero omitted'; end if;
  r:=public.revuptime_chart_readings(t.org,t.asset,now()-interval '3 days',now());
  if (r->>'total')::int<>1202 then raise exception 'wrong chart total'; end if;
  if not exists(select 1 from jsonb_array_elements(r->'readings') v where (v->>'value')::numeric=99) then raise exception 'peak lost'; end if;
  if not exists(select 1 from jsonb_array_elements(r->'readings') v where (v->>'timestamp')::timestamptz=now()-interval '1 day') then raise exception 'window start lost'; end if;
  if public.revuptime_latest_readings(t.other_org,t.asset)<>'[]'::jsonb then raise exception 'cross-workspace readings visible'; end if;
  if (select count(*) from public.revuptime_search_document_chunks(t.org,'What torque does the manual recommend?',null,t.asset))<>1 then raise exception 'manual search failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',viewer_id,'role','authenticated')::text,true) is not null as viewer_claim_set from reliability_ids;
set local role authenticated;
do $$ declare t record; begin
  select * into t from reliability_ids;
  begin
    insert into public.document_chunks(document_id,chunk_index,content,page_number) values(t.doc,1,'Unverified',1);
    raise exception 'viewer wrote document evidence';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Passed: full-period charts, peaks, slow sensor, zero, workspace isolation, processing leases, manual search, Viewer protection' as verification;
