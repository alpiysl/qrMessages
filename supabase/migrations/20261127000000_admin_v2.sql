-- Admin v2: QR batches, encrypted tokens for re-printing, paged admin queries.

create table public.batches (
  id         bigint generated always as identity primary key,
  prefix     text not null,
  count      integer not null check (count > 0),
  qr_size_cm numeric(3, 1) not null default 3,
  created_at timestamptz not null default now()
);
alter table public.batches enable row level security;
revoke all on public.batches from anon, authenticated;
grant select, insert, update, delete on public.batches to service_role;

-- token_enc: AES-256-GCM encrypted raw token (app-side key), so QR codes can be
-- re-rendered later. Null for keychains created before this migration.
alter table public.keychains
  add column batch_id  bigint references public.batches(id) on delete set null,
  add column token_enc text;
create index keychains_batch_idx on public.keychains (batch_id);
create index message_views_message_idx on public.message_views (message_id);

drop function if exists public.admin_keychains();

create or replace function public.admin_keychains(
  p_search   text default null,
  p_status   public.keychain_status default null,
  p_batch_id bigint default null,
  p_limit    integer default 50,
  p_offset   integer default 0
)
returns table (
  id bigint, label text, status public.keychain_status, batch_id bigint, current_round integer,
  has_token boolean, created_at timestamptz, scans bigint, last_scan timestamptz,
  last_message text, total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select k.*
    from public.keychains k
    where (p_search is null or k.label ilike '%' || p_search || '%')
      and (p_status is null or k.status = p_status)
      and (p_batch_id is null or k.batch_id = p_batch_id)
  ), page as (
    select f.*, count(*) over () as total
    from filtered f
    order by f.id desc
    limit p_limit offset p_offset
  )
  select p.id, p.label, p.status, p.batch_id, p.current_round, p.token_enc is not null, p.created_at,
         coalesce(s.scans, 0), s.last_scan, lm.text, p.total
  from page p
  left join lateral (
    select count(*) as scans, max(v.shown_at) as last_scan
    from public.message_views v where v.keychain_id = p.id
  ) s on true
  left join lateral (
    select m.text
    from public.message_views v join public.messages m on m.id = v.message_id
    where v.keychain_id = p.id
    order by v.shown_at desc, v.id desc
    limit 1
  ) lm on true
  order by p.id desc;
$$;

-- One row per scan: which keychain saw which message, when, in which round.
create or replace function public.admin_scans(
  p_keychain_id bigint default null,
  p_search      text default null,
  p_limit       integer default 50,
  p_offset      integer default 0
)
returns table (
  id bigint, shown_at timestamptz, round integer, keychain_id bigint, label text,
  message_id bigint, message_text text, author text, total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.shown_at, v.round, k.id, k.label, m.id, m.text, m.author, count(*) over ()
  from public.message_views v
  join public.keychains k on k.id = v.keychain_id
  join public.messages m on m.id = v.message_id
  where (p_keychain_id is null or v.keychain_id = p_keychain_id)
    and (p_search is null
         or k.label ilike '%' || p_search || '%'
         or m.text ilike '%' || p_search || '%'
         or m.author ilike '%' || p_search || '%')
  order by v.shown_at desc, v.id desc
  limit p_limit offset p_offset;
$$;

create or replace function public.admin_messages(
  p_search text default null,
  p_active boolean default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint, text text, author text, category text, active boolean, created_at timestamptz,
  views bigint, total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select m.*
    from public.messages m
    where (p_search is null or m.text ilike '%' || p_search || '%' or m.author ilike '%' || p_search || '%')
      and (p_active is null or m.active = p_active)
  ), page as (
    select f.*, count(*) over () as total
    from filtered f
    order by f.id
    limit p_limit offset p_offset
  )
  select p.id, p.text, p.author, p.category, p.active, p.created_at,
         (select count(*) from public.message_views v where v.message_id = p.id), p.total
  from page p
  order by p.id;
$$;

create or replace function public.admin_batches()
returns table (
  id bigint, prefix text, count integer, qr_size_cm numeric, created_at timestamptz,
  first_label text, last_label text, remaining bigint, printable bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.prefix, b.count, b.qr_size_cm, b.created_at,
         min(k.label), max(k.label), count(k.id), count(k.token_enc)
  from public.batches b
  left join public.keychains k on k.batch_id = b.id
  group by b.id
  order by b.id desc;
$$;

revoke all on function
  public.admin_keychains(text, public.keychain_status, bigint, integer, integer),
  public.admin_scans(bigint, text, integer, integer),
  public.admin_messages(text, boolean, integer, integer),
  public.admin_batches()
  from public, anon, authenticated;
grant execute on function
  public.admin_keychains(text, public.keychain_status, bigint, integer, integer),
  public.admin_scans(bigint, text, integer, integer),
  public.admin_messages(text, boolean, integer, integer),
  public.admin_batches()
  to service_role;
grant usage, select on all sequences in schema public to service_role;
