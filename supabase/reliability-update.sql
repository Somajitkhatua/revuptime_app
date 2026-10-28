-- Canonical schema only. Functions are SECURITY INVOKER and retain table RLS.
create or replace function public.revuptime_latest_readings(p_organization uuid, p_asset uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(r order by r->>'timestamp' desc), '[]'::jsonb)
  from (
    select distinct on (s.sensor_id, s.unit, coalesce(s.metadata->>'metric', sen.measurement_type, sen.sensor_type, ''))
      to_jsonb(s) || jsonb_build_object('sensors',jsonb_build_object('measurement_type',sen.measurement_type,'sensor_type',sen.sensor_type)) as r
    from public.sensor_readings s
    left join public.sensors sen on sen.id=s.sensor_id and sen.organization_id=s.organization_id
    where s.organization_id=p_organization and s.asset_id=p_asset
      and (s.quality is null or s.quality in ('good','valid'))
    order by s.sensor_id,s.unit,coalesce(s.metadata->>'metric',sen.measurement_type,sen.sensor_type,''),s.timestamp desc,s.id desc
  ) latest;
$$;
create or replace function public.revuptime_chart_readings(p_organization uuid,p_asset uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then
    raise exception 'Choose a date range of up to one year.' using errcode='22023';
  end if;
  return (
    with samples as (
      select s.*, sen.measurement_type,sen.sensor_type,
        floor(extract(epoch from (s.timestamp-p_from))/greatest(extract(epoch from (p_to-p_from))/120,1)) as bucket
      from public.sensor_readings s left join public.sensors sen on sen.id=s.sensor_id and sen.organization_id=s.organization_id
      where s.organization_id=p_organization and s.asset_id=p_asset
        and s.timestamp between p_from and p_to and (s.quality is null or s.quality in ('good','valid'))
    ), ranked as (
      select samples.*,
        row_number() over(w order by timestamp,id) as first_n,
        row_number() over(w order by timestamp desc,id desc) as last_n,
        row_number() over(w order by value nulls last,timestamp) as min_n,
        row_number() over(w order by value desc nulls last,timestamp) as max_n
      from samples window w as (partition by sensor_id,unit,coalesce(metadata->>'metric',measurement_type,sensor_type,''),bucket)
    )
    select jsonb_build_object('total',(select count(*) from samples),'sampled',count(*)<(select count(*) from samples),
      'readings',coalesce(jsonb_agg((to_jsonb(ranked)-'bucket'-'first_n'-'last_n'-'min_n'-'max_n'-'measurement_type'-'sensor_type')
        ||jsonb_build_object('sensors',jsonb_build_object('measurement_type',measurement_type,'sensor_type',sensor_type)) order by timestamp desc,id desc),'[]'::jsonb))
    from ranked where first_n=1 or last_n=1 or min_n=1 or max_n=1
  );
end;
$$;
revoke all on function public.revuptime_latest_readings(uuid,uuid) from public,anon;
revoke all on function public.revuptime_chart_readings(uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.revuptime_latest_readings(uuid,uuid) to authenticated;
grant execute on function public.revuptime_chart_readings(uuid,uuid,timestamptz,timestamptz) to authenticated;

-- Document workers claim and finish with a lease. Only the authenticated Edge
-- Function's service client can call these; mobile clients cannot mark files ready.
create or replace function public.revuptime_claim_document(p_document uuid,p_organization uuid,p_job uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  update public.asset_documents set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
    'status','Extracting text','processing_job',p_job,'processing_started_at',now(),'processing_error',null)
  where id=p_document and organization_id=p_organization and (
    coalesce(metadata->>'status','Queued') in ('Queued','Uploading','Failed')
    or (metadata->>'status' in ('Extracting text','Chunking','Creating embeddings')
      and coalesce((metadata->>'processing_started_at')::timestamptz,'epoch'::timestamptz)<now()-interval '5 minutes'))
  returning to_jsonb(asset_documents.*) into result;
  return result;
end;
$$;
create or replace function public.revuptime_finish_document(p_document uuid,p_job uuid,p_pages integer,p_chunks jsonb,p_error text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare doc public.asset_documents;
begin
  select * into doc from public.asset_documents where id=p_document and metadata->>'processing_job'=p_job::text for update;
  if not found then return false; end if;
  if p_error is null then
    if jsonb_typeof(p_chunks)<>'array' or jsonb_array_length(p_chunks)=0 or jsonb_array_length(p_chunks)>400 then
      raise exception 'Invalid document chunks';
    end if;
    delete from public.document_chunks where document_id=p_document;
    insert into public.document_chunks(document_id,chunk_index,content,page_number,metadata)
      select p_document,(c->>'chunk_index')::integer,c->>'content',(c->>'page_number')::integer,jsonb_build_object('retrieval','text')
      from jsonb_array_elements(p_chunks) c;
  end if;
  update public.asset_documents set metadata=(coalesce(metadata,'{}'::jsonb)-'processing_job')||jsonb_build_object(
    'status',case when p_error is null then 'Ready for AI' else 'Failed' end,
    'pages',case when p_error is null then to_jsonb(p_pages) else metadata->'pages' end,
    'processing_error',left(p_error,300),'processed_at',now(),'retrieval','text')
  where id=p_document;
  return true;
end;
$$;
revoke all on function public.revuptime_claim_document(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.revuptime_finish_document(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.revuptime_claim_document(uuid,uuid,uuid) to service_role;
grant execute on function public.revuptime_finish_document(uuid,uuid,integer,jsonb,text) to service_role;

-- Prevent a read-only member from inserting unverified manual passages.
create or replace function public.revuptime_search_document_chunks(p_organization uuid,p_query text,p_site uuid default null,p_asset uuid default null)
returns table(id uuid,document_id uuid,document_name text,content text,page_number integer,chunk_index integer)
language sql stable security invoker set search_path = '' as $$
  with terms as (
    select string_agg(quote_literal(word),' | ') as query from unnest(tsvector_to_array(to_tsvector('english',left(p_query,500)))) word
    where word not in ('manual','document','oem','recommend','machin','pleas','page')
  ), search as (select to_tsquery('english',query) as query from terms where query is not null)
  select c.id,c.document_id,d.name,left(c.content,1200),c.page_number,c.chunk_index
  from public.document_chunks c join public.asset_documents d on d.id=c.document_id cross join search
  where d.organization_id=p_organization and revuptime_private.is_member(p_organization)
    and d.metadata->>'status'='Ready for AI' and coalesce(d.metadata->>'archived','false')<>'true'
    and (p_site is null or d.site_id=p_site) and (p_asset is null or d.asset_id=p_asset)
    and to_tsvector('english',c.content) @@ search.query
  order by ts_rank(to_tsvector('english',c.content),search.query) desc,c.document_id,c.chunk_index limit 6;
$$;
revoke all on function public.revuptime_search_document_chunks(uuid,text,uuid,uuid) from public,anon;
grant execute on function public.revuptime_search_document_chunks(uuid,text,uuid,uuid) to authenticated;

create policy rv_chunks_verified_insert on public.document_chunks as restrictive for insert to authenticated
with check (exists(select 1 from public.asset_documents d where d.id=document_id and revuptime_private.can_write(d.organization_id)));
create policy rv_chunks_verified_update on public.document_chunks as restrictive for update to authenticated
using (exists(select 1 from public.asset_documents d where d.id=document_id and revuptime_private.can_write(d.organization_id)))
with check (exists(select 1 from public.asset_documents d where d.id=document_id and revuptime_private.can_write(d.organization_id)));
create policy rv_chunks_verified_delete on public.document_chunks as restrictive for delete to authenticated
using (exists(select 1 from public.asset_documents d where d.id=document_id and revuptime_private.can_write(d.organization_id)));
