-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run
create table if not exists views (
  id bigint generated always as identity primary key,
  article_id uuid not null references articles(id) on delete cascade,
  visitor text not null,
  source text,
  max_scroll smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists views_article_idx on views (article_id, created_at);
alter table views enable row level security;
create policy "admin baca views" on views for select to authenticated using (true);

-- Mencatat satu kunjungan (hanya untuk artikel yang terbit)
create or replace function track_view(p_slug text, p_visitor text, p_source text)
returns bigint language plpgsql security definer set search_path = public as $$
declare a uuid; v bigint;
begin
  select id into a from articles where slug = p_slug and published;
  if a is null then return null; end if;
  insert into views (article_id, visitor, source)
  values (a, left(p_visitor, 64), left(coalesce(p_source, 'Langsung'), 40))
  returning id into v;
  return v;
end $$;

-- Mencatat seberapa jauh artikel dibaca (0-100)
create or replace function track_read(p_id bigint, p_visitor text, p_scroll int)
returns void language sql security definer set search_path = public as $$
  update views set max_scroll = greatest(max_scroll, least(100, p_scroll))
  where id = p_id and visitor = p_visitor;
$$;

-- Ringkasan statistik, hanya bisa dipanggil oleh admin yang sudah login
create or replace function get_stats(p_days int default 30)
returns json language plpgsql security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => p_days);
begin
  if auth.uid() is null then raise exception 'hanya untuk admin'; end if;
  return json_build_object(
    'total',    (select count(*) from views where created_at > since),
    'unique',   (select count(distinct visitor) from views where created_at > since),
    'finished', (select count(*) from views where created_at > since and max_scroll >= 80),
    'daily', (select coalesce(json_agg(d order by d.day), '[]'::json) from (
        select to_char(date_trunc('day', created_at at time zone 'Asia/Jakarta'), 'YYYY-MM-DD') as day,
               count(*) as views, count(distinct visitor) as visitors
        from views where created_at > since group by 1) d),
    'articles', (select coalesce(json_agg(t), '[]'::json) from (
        select a.title, count(v.id) as views, count(distinct v.visitor) as visitors,
               round(avg(v.max_scroll))::int as avg_scroll,
               count(*) filter (where v.max_scroll >= 80) as finished
        from views v join articles a on a.id = v.article_id
        where v.created_at > since group by a.id, a.title order by views desc limit 20) t),
    'sources', (select coalesce(json_agg(s), '[]'::json) from (
        select coalesce(source, 'Langsung') as source, count(*) as views
        from views where created_at > since group by 1 order by 2 desc limit 8) s)
  );
end $$;

grant execute on function track_view(text, text, text) to anon, authenticated;
grant execute on function track_read(bigint, text, int) to anon, authenticated;
grant execute on function get_stats(int) to authenticated;
