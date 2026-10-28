alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add constraint rv_avatar_owner_path check(avatar_path is null or split_part(avatar_path,'/',1)=id::text);
alter table public.assets add column if not exists installation_datetime timestamptz;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',false,5242880,array['image/jpeg','image/png','image/webp','image/heic','image/heif']) on conflict(id) do nothing;
create policy rv_avatar_read on storage.objects for select to authenticated using(bucket_id='profile-photos' and split_part(storage.objects.name,'/',1)=auth.uid()::text);
create policy rv_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and split_part(storage.objects.name,'/',1)=auth.uid()::text);
create policy rv_avatar_delete on storage.objects for delete to authenticated using(bucket_id='profile-photos' and split_part(storage.objects.name,'/',1)=auth.uid()::text);
notify pgrst,'reload schema';
