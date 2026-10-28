import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite({ extensions: { vector } });
await db.exec(
  `create schema auth;create schema storage;create schema extensions;create role authenticated;create role anon;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,name text,bucket_id text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;create publication supabase_realtime;grant usage on schema auth,storage to authenticated;grant execute on function auth.uid(),storage.foldername(text) to authenticated;`,
);
await db.exec(readFileSync("supabase/schema.sql", "utf8"));
const userA = "00000000-0000-4000-8000-000000000003",
  userB = "00000000-0000-4000-8000-000000000005",
  orgA = "00000000-0000-4000-8000-000000000001",
  orgB = "00000000-0000-4000-8000-000000000006";
await db.exec(`insert into auth.users values('${userA}'),('${userB}');`);
await db.exec(readFileSync("supabase/seed.sql", "utf8"));
await db.exec(
  `insert into public.organizations values('${orgB}','Other organization');insert into public.organization_members(organization_id,user_id,role) values('${orgB}','${userB}','Viewer');insert into public.profiles(id,organization_id,name,email) values('${userB}','${orgB}','Other user','other@example.com');insert into public.sites(id,organization_id,name) values('00000000-0000-4000-8000-000000000007','${orgB}','Private plant');set role authenticated;select set_config('request.jwt.claim.sub','${userA}',false);`,
);
assert.equal((await db.query("select * from public.sites")).rows.length, 2);
assert.equal(
  (await db.query(`select * from public.sites where organization_id='${orgB}'`))
    .rows.length,
  0,
);
await assert.rejects(() =>
  db.exec(
    `insert into public.work_orders(organization_id,asset_id,title,priority,due_date) values('${orgB}','00000000-0000-4000-8000-000000000011','Invalid cross-tenant','High','2026-10-07');`,
  ),
);
await assert.rejects(() =>
  db.exec(
    `update public.profiles set organization_id='${orgB}' where id='${userA}';`,
  ),
);
const created = await db.query(
  `select (public.create_work_order('${orgA}','{"asset_id":"00000000-0000-4000-8000-000000000011","title":"Schema verification","priority":"High","assigned_to":"${userA}","due_date":"2026-10-07"}'::jsonb)).id`,
);
const id = created.rows[0].id;
await assert.rejects(() =>
  db.query(
    `select public.complete_work_order('${orgA}','${id}','{"root_cause":"Test","action_taken":"Test repair","downtime_minutes":45,"final_vibration":2.8}'::jsonb)`,
  ),
);
await db.query(
  `update public.work_orders set tasks=(select jsonb_agg(t||'{"completed":true}'::jsonb) from jsonb_array_elements(tasks)t) where id='${id}'`,
);
await db.query(
  `select public.complete_work_order('${orgA}','${id}','{"root_cause":"Test","action_taken":"Test repair","downtime_minutes":45,"final_vibration":2.8}'::jsonb)`,
);
assert.equal(
  (
    await db.query(
      `select * from public.maintenance_events where work_order_id='${id}'`,
    )
  ).rows.length,
  1,
);
await assert.rejects(() =>
  db.query(`select public.complete_work_order('${orgA}','${id}','{}'::jsonb)`),
);
await db.exec(`select set_config('request.jwt.claim.sub','${userB}',false);`);
assert.equal((await db.query("select * from public.assets")).rows.length, 0);
await assert.rejects(() =>
  db.query(`select public.create_work_order('${orgA}','{}'::jsonb)`),
);
console.log(
  "PASS: schema, seed, tenant isolation, profile protection, atomic completion, duplicate closure, Viewer permissions",
);
await db.close();
