-- Run against a fresh Supabase project via the SQL editor. Server migrations
-- should subsequently be generated with the Supabase CLI for your environment.
begin;
create extension if not exists vector with schema extensions;
create schema if not exists private;
create type public.member_role as enum ('Owner','Admin','Plant Manager','Maintenance Manager','Engineer','Technician','Operator','Viewer');
create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null);
create table public.organization_members(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,user_id uuid not null references auth.users,role public.member_role not null,unique(organization_id,user_id));
create table public.profiles(id uuid primary key references auth.users,organization_id uuid not null references public.organizations,name text not null,email text not null,push_token text,unique(id,organization_id));
create table public.sites(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,name text not null,location text not null default '',unique(id,organization_id));
create table public.assets(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,site_id uuid not null,name text not null,description text not null default '',type text not null,health text not null check(health in ('Healthy','Warning','Critical')),health_score integer not null check(health_score between 0 and 100),status text not null default 'Running',manufacturer text not null default '',model text not null default '',serial_number text not null default '',power numeric not null default 0,rpm integer not null default 0,location text not null default '',installed_at date,image_url text,unique(id,organization_id),foreign key(site_id,organization_id) references public.sites(id,organization_id));
create table public.gateways(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,site_id uuid not null,name text not null,serial_number text,foreign key(site_id,organization_id) references public.sites(id,organization_id),unique(id,organization_id));
create table public.sensors(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,gateway_id uuid,name text not null,modbus_address integer,foreign key(asset_id,organization_id) references public.assets(id,organization_id),foreign key(gateway_id,organization_id) references public.gateways(id,organization_id),unique(id,organization_id));
create table public.device_status(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,sensor_id uuid,status text not null,last_seen timestamptz,foreign key(asset_id,organization_id) references public.assets(id,organization_id),foreign key(sensor_id,organization_id) references public.sensors(id,organization_id));
create table public.sensor_readings(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,sensor_id uuid,recorded_at timestamptz not null default now(),x_rms double precision not null,y_rms double precision not null,z_rms double precision not null,temperature double precision not null,rpm integer not null,foreign key(asset_id,organization_id) references public.assets(id,organization_id),foreign key(sensor_id,organization_id) references public.sensors(id,organization_id));
create index readings_range on public.sensor_readings(organization_id,asset_id,recorded_at desc);
create table public.sensor_feature_windows(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,window_start timestamptz not null,window_end timestamptz not null,rms_average double precision,rms_max double precision,temperature_average double precision,anomaly_score double precision,foreign key(asset_id,organization_id) references public.assets(id,organization_id));
create index feature_range on public.sensor_feature_windows(organization_id,asset_id,window_end desc);
create table public.alert_rules(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,metric text not null,threshold double precision not null,severity text not null,foreign key(asset_id,organization_id) references public.assets(id,organization_id));
create table public.alerts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,title text not null,severity text not null check(severity in ('Critical','High','Warning','Info')),status text not null default 'Open' check(status in ('Open','Acknowledged','Resolved')),value double precision not null,unit text not null,threshold double precision not null,detected_at timestamptz not null default now(),resolved_at timestamptz,foreign key(asset_id,organization_id) references public.assets(id,organization_id),unique(id,organization_id));
create index alerts_asset on public.alerts(organization_id,asset_id,status);
create table public.ai_predictions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,prediction text not null,confidence double precision,created_at timestamptz not null default now(),foreign key(asset_id,organization_id) references public.assets(id,organization_id));
create sequence public.work_order_number start 48;
create table public.work_orders(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,alert_id uuid,number text not null default ('WO-'||extract(year from now())||'-'||lpad(nextval('public.work_order_number')::text,4,'0')),title text not null,priority text not null check(priority in ('High','Medium','Low')),status text not null default 'Open' check(status in ('Open','In Progress','Completed')),assigned_to uuid,due_date date not null,created_at timestamptz not null default now(),completed_at timestamptz,tasks jsonb not null default '[]',notes text not null default '',result jsonb,foreign key(asset_id,organization_id) references public.assets(id,organization_id),foreign key(alert_id,organization_id) references public.alerts(id,organization_id),foreign key(assigned_to,organization_id) references public.profiles(id,organization_id),unique(id,organization_id),unique(organization_id,number));
create index orders_asset on public.work_orders(organization_id,asset_id,status);
create table public.work_order_tasks(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,work_order_id uuid not null,title text not null,completed boolean not null default false,foreign key(work_order_id,organization_id) references public.work_orders(id,organization_id));
create table public.work_order_updates(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,work_order_id uuid not null,user_id uuid not null references auth.users,message text not null,created_at timestamptz not null default now(),foreign key(work_order_id,organization_id) references public.work_orders(id,organization_id));
create table public.maintenance_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,work_order_id uuid not null,title text not null,technician text not null,technician_id uuid not null references auth.users,occurred_at timestamptz not null default now(),root_cause text not null,before_vibration double precision not null,after_vibration double precision not null,result jsonb,foreign key(asset_id,organization_id) references public.assets(id,organization_id),foreign key(work_order_id,organization_id) references public.work_orders(id,organization_id),unique(work_order_id));
create table public.asset_documents(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,title text not null,type text not null,pages integer,file_type text not null,status text not null default 'Uploading' check(status in ('Uploading','Extracting text','Chunking','Creating embeddings','Ready for AI','Failed','Queued')),storage_path text not null,manufacturer text not null default '',model text not null default '',version text not null default '',created_at timestamptz not null default now(),foreign key(asset_id,organization_id) references public.assets(id,organization_id),unique(id,organization_id));
create table public.document_chunks(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,document_id uuid not null,page integer not null,content text not null,embedding extensions.vector(1536),foreign key(asset_id,organization_id) references public.assets(id,organization_id),foreign key(document_id,organization_id) references public.asset_documents(id,organization_id));
create index chunks_asset on public.document_chunks(organization_id,asset_id,document_id);
create index chunks_vector on public.document_chunks using hnsw(embedding extensions.vector_cosine_ops);
create table public.chat_sessions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,user_id uuid not null references auth.users,created_at timestamptz not null default now(),foreign key(asset_id,organization_id) references public.assets(id,organization_id),unique(id,organization_id));
create table public.chat_messages(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_id uuid not null,session_id uuid not null,user_id uuid not null references auth.users,role text not null check(role in ('user','assistant')),content text not null,evidence jsonb,created_at timestamptz not null default now(),foreign key(asset_id,organization_id) references public.assets(id,organization_id),foreign key(session_id,organization_id) references public.chat_sessions(id,organization_id));

-- Membership lookup intentionally lives in a non-exposed schema to avoid RLS recursion.
create function private.is_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid())$$;
create function private.can_write(org uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and role not in ('Viewer'))$$;
revoke all on function private.is_member(uuid),private.can_write(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid),private.can_write(uuid) to authenticated;
alter table public.organizations enable row level security;
create policy organization_read on public.organizations for select to authenticated using(private.is_member(id));
alter table public.organization_members enable row level security;
create policy membership_read on public.organization_members for select to authenticated using(private.is_member(organization_id));
alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(private.is_member(organization_id));
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid() and private.is_member(organization_id)) with check(id=auth.uid() and private.is_member(organization_id));
do $$declare t text;begin foreach t in array array['sites','assets','gateways','sensors','device_status','sensor_readings','sensor_feature_windows','alert_rules','alerts','ai_predictions','work_orders','work_order_tasks','work_order_updates','maintenance_events','asset_documents','document_chunks','chat_sessions','chat_messages'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy tenant_read on public.%I for select to authenticated using(private.is_member(organization_id))',t);
end loop;end$$;
-- Telemetry, predictions, membership and indexing are writable only by trusted servers.
do $$declare t text;begin foreach t in array array['alerts','work_orders','work_order_tasks','work_order_updates','maintenance_events','asset_documents','chat_sessions','chat_messages'] loop
execute format('create policy tenant_insert on public.%I for insert to authenticated with check(private.can_write(organization_id))',t);
execute format('create policy tenant_update on public.%I for update to authenticated using(private.can_write(organization_id)) with check(private.can_write(organization_id))',t);
end loop;end$$;
-- Assistant sessions and chat messages are private to their author inside a tenant.
drop policy tenant_read on public.chat_sessions; drop policy tenant_read on public.chat_messages;
create policy own_sessions on public.chat_sessions for select to authenticated using(private.is_member(organization_id) and user_id=auth.uid());
create policy own_messages on public.chat_messages for select to authenticated using(private.is_member(organization_id) and user_id=auth.uid());
drop policy tenant_insert on public.chat_sessions;drop policy tenant_insert on public.chat_messages;
create policy own_session_insert on public.chat_sessions for insert to authenticated with check(private.is_member(organization_id) and user_id=auth.uid());
create policy own_message_insert on public.chat_messages for insert to authenticated with check(private.is_member(organization_id) and user_id=auth.uid());
grant select on all tables in schema public to authenticated;
grant insert,update on public.alerts,public.work_orders,public.work_order_tasks,public.work_order_updates,public.maintenance_events,public.asset_documents,public.chat_sessions,public.chat_messages to authenticated;
grant update(push_token,name) on public.profiles to authenticated;
grant usage on sequence public.work_order_number to authenticated;

-- Client uploads cannot claim successful indexing or change processing status.
drop policy tenant_insert on public.asset_documents;
create policy document_upload on public.asset_documents for insert to authenticated with check(private.can_write(organization_id) and status='Uploading' and storage_path like organization_id::text||'/'||asset_id::text||'/%');
revoke update on public.asset_documents from authenticated;
grant update(title,type,manufacturer,model,version) on public.asset_documents to authenticated;
drop policy tenant_update on public.chat_sessions;
drop policy tenant_update on public.chat_messages;
create policy own_session_update on public.chat_sessions for update to authenticated using(private.is_member(organization_id) and user_id=auth.uid()) with check(private.is_member(organization_id) and user_id=auth.uid());
create policy own_message_update on public.chat_messages for update to authenticated using(private.is_member(organization_id) and user_id=auth.uid()) with check(private.is_member(organization_id) and user_id=auth.uid());

create function public.match_document_chunks(p_org uuid,p_asset uuid,p_embedding extensions.vector(1536)) returns table(id uuid,document_id uuid,page integer,content text,similarity double precision) language sql stable security invoker set search_path='' as $$
select d.id,d.document_id,d.page,d.content,1-(d.embedding operator(extensions.<=>) p_embedding) as similarity from public.document_chunks d join public.asset_documents a on a.id=d.document_id and a.asset_id=d.asset_id where d.organization_id=p_org and d.asset_id=p_asset and a.status='Ready for AI' order by d.embedding operator(extensions.<=>) p_embedding limit 6$$;
create function public.create_work_order(p_org uuid,p_input jsonb) returns public.work_orders language plpgsql security invoker set search_path='' as $$declare w public.work_orders;begin
if not private.can_write(p_org) then raise exception 'Permission denied';end if;
insert into public.work_orders(organization_id,asset_id,alert_id,title,priority,assigned_to,due_date,notes,tasks) values(p_org,(p_input->>'asset_id')::uuid,(p_input->>'alert_id')::uuid,p_input->>'title',p_input->>'priority',(p_input->>'assigned_to')::uuid,(p_input->>'due_date')::date,coalesce(p_input->>'notes',''),(select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'title',t,'completed',false)) from unnest(array['Check vibration reading','Inspect lubrication','Check coupling alignment','Record final vibration']) t)) returning * into w;return w;end$$;
-- Trigger makes closure and its maintenance event a single database transaction.
create function public.record_completion() returns trigger language plpgsql security invoker set search_path='' as $$declare technician_name text;before_reading double precision;begin
if old.status='Completed' then raise exception 'Completed work orders cannot be edited';end if;
if new.status='Completed' then
if exists(select 1 from jsonb_array_elements(new.tasks) t where coalesce((t->>'completed')::boolean,false)=false) or jsonb_array_length(new.tasks)=0 then raise exception 'Complete every checklist task first';end if;
if new.result is null or coalesce(new.result->>'root_cause','')='' or coalesce(new.result->>'action_taken','')='' or (new.result->>'final_vibration')::numeric<0 or (new.result->>'downtime_minutes')::numeric<0 then raise exception 'Invalid completion result';end if;
new.completed_at=now();select name into technician_name from public.profiles where id=auth.uid();select x_rms into before_reading from public.sensor_readings where asset_id=new.asset_id and organization_id=new.organization_id order by recorded_at desc limit 1;
insert into public.maintenance_events(organization_id,asset_id,work_order_id,title,technician,technician_id,root_cause,before_vibration,after_vibration,result) values(new.organization_id,new.asset_id,new.id,new.result->>'action_taken',coalesce(technician_name,'Technician'),auth.uid(),new.result->>'root_cause',coalesce(before_reading,0),(new.result->>'final_vibration')::double precision,new.result);
end if;return new;end$$;
create trigger order_completion before update on public.work_orders for each row execute function public.record_completion();
create function public.complete_work_order(p_org uuid,p_id uuid,p_result jsonb) returns public.work_orders language plpgsql security invoker set search_path='' as $$declare w public.work_orders;begin update public.work_orders set status='Completed',result=p_result where id=p_id and organization_id=p_org and status<>'Completed' returning * into w;if w.id is null then raise exception 'Work order unavailable or already completed';end if;return w;end$$;
revoke all on function public.match_document_chunks(uuid,uuid,extensions.vector),public.create_work_order(uuid,jsonb),public.complete_work_order(uuid,uuid,jsonb),public.record_completion() from public;
grant execute on function public.match_document_chunks(uuid,uuid,extensions.vector),public.create_work_order(uuid,jsonb),public.complete_work_order(uuid,uuid,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('asset-documents','asset-documents',false,20971520,array['application/pdf','image/jpeg','image/png']),('work-order-photos','work-order-photos',false,20971520,array['image/jpeg','image/png']);
create policy tenant_file_read on storage.objects for select to authenticated using(bucket_id in ('asset-documents','work-order-photos') and exists(select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid()));
create policy tenant_file_insert on storage.objects for insert to authenticated with check(bucket_id in ('asset-documents','work-order-photos') and exists(select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid() and m.role<>'Viewer'));
create policy tenant_file_delete on storage.objects for delete to authenticated using(bucket_id in ('asset-documents','work-order-photos') and exists(select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid() and m.role<>'Viewer'));
alter publication supabase_realtime add table public.alerts,public.work_orders,public.sensor_readings,public.asset_documents;
commit;
