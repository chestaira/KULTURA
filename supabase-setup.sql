-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  author text,
  excerpt text,
  cover_url text,
  body_html text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table articles enable row level security;
create policy "publik baca yang terbit" on articles for select using (published = true);
create policy "admin baca semua" on articles for select to authenticated using (true);
create policy "admin tambah" on articles for insert to authenticated with check (true);
create policy "admin ubah" on articles for update to authenticated using (true);
create policy "admin hapus" on articles for delete to authenticated using (true);

insert into storage.buckets (id, name, public) values ('gambar','gambar',true) on conflict do nothing;
create policy "publik lihat gambar" on storage.objects for select using (bucket_id = 'gambar');
create policy "admin unggah gambar" on storage.objects for insert to authenticated with check (bucket_id = 'gambar');
create policy "admin hapus gambar" on storage.objects for delete to authenticated using (bucket_id = 'gambar');
