-- Additive integration for the existing normalized RevUpTime database.
create or replace function revuptime_private.can_write(org uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','manager','technician') and u.email_confirmed_at is not null); $$;
revoke all on function revuptime_private.can_write(uuid) from public,anon;
grant execute on function revuptime_private.can_write(uuid) to authenticated;
do $$declare t text; begin
 foreach t in array array['sites','assets','alerts','work_orders','maintenance_events','asset_documents'] loop
  execute format('create policy rv_verified_insert on public.%I as restrictive for insert to authenticated with check(revuptime_private.can_write(organization_id))',t);
  execute format('create policy rv_verified_update on public.%I as restrictive for update to authenticated using(revuptime_private.can_write(organization_id)) with check(revuptime_private.can_write(organization_id))',t);
  execute format('create policy rv_verified_delete on public.%I as restrictive for delete to authenticated using(revuptime_private.can_write(organization_id))',t);
 end loop;
end $$;
create policy rv_task_verified_insert on public.work_order_tasks as restrictive for insert to authenticated with check(exists(select 1 from public.work_orders w where w.id=work_order_id and revuptime_private.can_write(w.organization_id)));
create policy rv_task_verified_update on public.work_order_tasks as restrictive for update to authenticated using(exists(select 1 from public.work_orders w where w.id=work_order_id and revuptime_private.can_write(w.organization_id))) with check(exists(select 1 from public.work_orders w where w.id=work_order_id and revuptime_private.can_write(w.organization_id)));
create policy rv_task_verified_delete on public.work_order_tasks as restrictive for delete to authenticated using(exists(select 1 from public.work_orders w where w.id=work_order_id and revuptime_private.can_write(w.organization_id)));

create or replace function public.revuptime_mobile_create_work_order(p_org uuid,p_input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.work_orders; a public.assets; t text; pos int:=0; wid uuid:=gen_random_uuid(); begin
 if not revuptime_private.can_write(p_org) then raise exception 'Write access required' using errcode='42501'; end if;
 select * into a from public.assets where id=(p_input->>'asset_id')::uuid and organization_id=p_org;
 if not found then raise exception 'Asset unavailable'; end if;
 if length(trim(coalesce(p_input->>'title',''))) not between 1 and 200 then raise exception 'Enter a work order title'; end if;
 if p_input->>'priority' not in ('High','Medium','Low') then raise exception 'Invalid priority'; end if;
 if p_input->>'alert_id' is not null and not exists(select 1 from public.alerts where id=(p_input->>'alert_id')::uuid and organization_id=p_org and asset_id=a.id) then raise exception 'Alert unavailable'; end if;
 insert into public.work_orders(id,organization_id,site_id,asset_id,alert_id,work_order_number,title,description,priority,status,assigned_to,created_by,scheduled_end)
 values(wid,p_org,a.site_id,a.id,(p_input->>'alert_id')::uuid,'WO-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(wid::text,'-',''),1,12)),trim(p_input->>'title'),coalesce(p_input->>'notes',''),lower(p_input->>'priority'),'open',(p_input->>'assigned_to')::uuid,auth.uid(),(p_input->>'due_date')::date) returning * into w;
 foreach t in array array['Check vibration reading','Inspect lubrication','Check coupling alignment','Record final vibration'] loop pos:=pos+1;insert into public.work_order_tasks(work_order_id,task_number,title) values(w.id,pos,t);end loop;
 return to_jsonb(w); end $$;

create or replace function public.revuptime_mobile_update_work_order(p_org uuid,p_id uuid,p_values jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare w public.work_orders; t jsonb; count_updated int; begin
 if not revuptime_private.can_write(p_org) then raise exception 'Write access required' using errcode='42501'; end if;
 select * into w from public.work_orders where id=p_id and organization_id=p_org for update;
 if not found or w.status in ('completed','cancelled') then raise exception 'Work order unavailable or closed'; end if;
 if p_values ? 'status' and p_values->>'status' not in ('Open','In Progress') then raise exception 'Use the completion form to close this work order'; end if;
 update public.work_orders set status=case when p_values ? 'status' then case p_values->>'status' when 'In Progress' then 'in_progress' else 'open' end else status end,assigned_to=case when p_values ? 'assigned_to' then (p_values->>'assigned_to')::uuid else assigned_to end,description=case when p_values ? 'notes' then p_values->>'notes' else description end,started_at=case when p_values->>'status'='In Progress' then coalesce(started_at,now()) else started_at end where id=w.id;
 if p_values ? 'tasks' then
  for t in select value from jsonb_array_elements(p_values->'tasks') loop
   if jsonb_typeof(t->'completed') <> 'boolean' then raise exception 'Invalid checklist value';end if;
   update public.work_order_tasks set status=case when (t->>'completed')::boolean then 'completed' else 'pending' end,completed_at=case when (t->>'completed')::boolean then now() else null end where id=(t->>'id')::uuid and work_order_id=w.id;
   get diagnostics count_updated=row_count;if count_updated<>1 then raise exception 'Checklist task unavailable';end if;
  end loop;
 end if;
 end $$;

create or replace function revuptime_private.mobile_completion() returns trigger language plpgsql security invoker set search_path='' as $$
declare result jsonb; begin
 if old.status='completed' then raise exception 'Completed work orders cannot be edited'; end if;
 if new.status='completed' then
  result:=new.completion_notes::jsonb;
  if not revuptime_private.can_write(new.organization_id) then raise exception 'Write access required' using errcode='42501';end if;
  if not exists(select 1 from public.work_order_tasks where work_order_id=new.id) or exists(select 1 from public.work_order_tasks where work_order_id=new.id and status<>'completed') then raise exception 'Complete every checklist task first';end if;
  if result is null or length(trim(coalesce(result->>'root_cause','')))=0 or length(trim(coalesce(result->>'action_taken','')))=0 or jsonb_typeof(result->'downtime_minutes') is distinct from 'number' or jsonb_typeof(result->'final_vibration') is distinct from 'number' or (result->>'downtime_minutes')::numeric<0 or (result->>'final_vibration')::numeric<0 or (result->>'downtime_minutes')::numeric<>trunc((result->>'downtime_minutes')::numeric) then raise exception 'Enter a valid repair outcome';end if;
  new.completed_at:=now();new.actual_downtime_minutes:=(result->>'downtime_minutes')::numeric;
  insert into public.maintenance_events(organization_id,site_id,asset_id,work_order_id,event_type,maintenance_type,title,root_cause,action_taken,performed_by,completed_at,downtime_minutes,outcome)
  values(new.organization_id,new.site_id,new.asset_id,new.id,'repair','corrective',result->>'action_taken',result->>'root_cause',result->>'action_taken',auth.uid(),new.completed_at,(result->>'downtime_minutes')::numeric,result);
 end if;return new;end $$;
create trigger rv_mobile_completion before update on public.work_orders for each row execute function revuptime_private.mobile_completion();
create or replace function revuptime_private.mobile_task_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent public.work_orders;begin
 select * into parent from public.work_orders where id=case when tg_op='DELETE' then old.work_order_id else new.work_order_id end for update;
 if parent.status in ('completed','cancelled') then raise exception 'Closed work order checklists cannot be edited';end if;
 if tg_op='DELETE' then return old;end if;return new;end $$;
revoke all on function revuptime_private.mobile_task_guard() from public,anon;
create trigger rv_mobile_task_guard before insert or update or delete on public.work_order_tasks for each row execute function revuptime_private.mobile_task_guard();
create or replace function public.revuptime_mobile_complete_work_order(p_org uuid,p_id uuid,p_result jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.work_orders;begin
 update public.work_orders set status='completed',completion_notes=p_result::text where id=p_id and organization_id=p_org and status not in ('completed','cancelled') returning * into w;
 if not found then raise exception 'Work order unavailable or already closed';end if;return to_jsonb(w);end $$;
revoke all on function public.revuptime_mobile_create_work_order(uuid,jsonb),public.revuptime_mobile_update_work_order(uuid,uuid,jsonb),public.revuptime_mobile_complete_work_order(uuid,uuid,jsonb),revuptime_private.mobile_completion() from public,anon;
grant execute on function public.revuptime_mobile_create_work_order(uuid,jsonb),public.revuptime_mobile_update_work_order(uuid,uuid,jsonb),public.revuptime_mobile_complete_work_order(uuid,uuid,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('asset-documents','asset-documents',false,20971520),('work-order-photos','work-order-photos',false,20971520) on conflict(id) do nothing;
create policy rv_mobile_file_read on storage.objects for select to authenticated using(bucket_id in ('asset-documents','work-order-photos') and exists(select 1 from public.organization_members m where m.organization_id::text=split_part(name,'/',1) and m.user_id=auth.uid() and m.status='active'));
create policy rv_mobile_file_insert on storage.objects for insert to authenticated with check(bucket_id in ('asset-documents','work-order-photos') and exists(select 1 from public.assets a where a.organization_id::text=split_part(storage.objects.name,'/',1) and a.id::text=split_part(storage.objects.name,'/',2) and revuptime_private.can_write(a.organization_id)));
create policy rv_mobile_file_delete on storage.objects for delete to authenticated using(bucket_id in ('asset-documents','work-order-photos') and exists(select 1 from public.organization_members m where m.organization_id::text=split_part(name,'/',1) and m.user_id=auth.uid() and revuptime_private.can_write(m.organization_id)));
notify pgrst,'reload schema';

