-- Core schema for QR message keychains.
-- All access goes through the server (service_role). anon/authenticated get nothing.

create type public.keychain_status as enum ('generated', 'active', 'disabled');

create table public.keychains (
  id            bigint generated always as identity primary key,
  token_hash    text not null unique,
  label         text not null unique,
  status        public.keychain_status not null default 'generated',
  current_round integer not null default 1,
  created_at    timestamptz not null default now(),
  activated_at  timestamptz
);

create table public.messages (
  id         bigint generated always as identity primary key,
  text       text not null check (length(text) between 1 and 500),
  author     text,
  category   text not null default 'motivasyon',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per scan. "round" increments each time the keychain has seen every
-- active message, so history is kept for stats while the pool is reset.
create table public.message_views (
  id          bigint generated always as identity primary key,
  keychain_id bigint not null references public.keychains(id) on delete cascade,
  message_id  bigint not null references public.messages(id) on delete cascade,
  round       integer not null,
  shown_at    timestamptz not null default now(),
  unique (keychain_id, message_id, round)
);
create index message_views_keychain_shown_idx on public.message_views (keychain_id, shown_at desc);

create table public.feedback (
  id          bigint generated always as identity primary key,
  keychain_id bigint references public.keychains(id) on delete set null,
  message     text not null check (length(message) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index feedback_keychain_created_idx on public.feedback (keychain_id, created_at desc);

alter table public.keychains     enable row level security;
alter table public.messages      enable row level security;
alter table public.message_views enable row level security;
alter table public.feedback      enable row level security;

revoke all on public.keychains, public.messages, public.message_views, public.feedback
  from anon, authenticated;

-- Picks an unseen random message for the keychain identified by p_token_hash and
-- records the view atomically. When every active message has been seen, starts
-- a new round, avoiding the last shown message as the first one of the round.
create or replace function public.pick_message(p_token_hash text)
returns table (status text, message_id bigint, message_text text, author text, is_new_round boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  k            public.keychains%rowtype;
  m            public.messages%rowtype;
  last_msg_id  bigint;
  new_round    boolean := false;
begin
  select * into k from public.keychains where token_hash = p_token_hash for update;

  if not found or k.status = 'disabled' then
    return query select 'not_found'::text, null::bigint, null::text, null::text, false;
    return;
  end if;

  if k.status = 'generated' then
    update public.keychains set status = 'active', activated_at = now() where id = k.id;
  end if;

  select msg.* into m
  from public.messages msg
  where msg.active
    and not exists (
      select 1 from public.message_views v
      where v.keychain_id = k.id and v.message_id = msg.id and v.round = k.current_round
    )
  order by random()
  limit 1;

  if not found then
    select v.message_id into last_msg_id
    from public.message_views v
    where v.keychain_id = k.id
    order by v.shown_at desc, v.id desc
    limit 1;

    select msg.* into m
    from public.messages msg
    where msg.active and msg.id is distinct from last_msg_id
    order by random()
    limit 1;

    if not found then
      -- Only one (or zero) active message exists.
      select msg.* into m from public.messages msg where msg.active order by random() limit 1;
    end if;

    if not found then
      return query select 'empty'::text, null::bigint, null::text, null::text, false;
      return;
    end if;

    k.current_round := k.current_round + 1;
    update public.keychains set current_round = k.current_round where id = k.id;
    new_round := true;
  end if;

  insert into public.message_views (keychain_id, message_id, round)
  values (k.id, m.id, k.current_round);

  return query select 'ok'::text, m.id, m.text, m.author, new_round;
end;
$$;

-- Stores feedback; max 3 entries per keychain per 10 minutes.
create or replace function public.submit_feedback(p_token_hash text, p_message text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  kid    bigint;
  recent integer;
  body   text := btrim(coalesce(p_message, ''));
begin
  if length(body) = 0 or length(body) > 1000 then
    return 'invalid';
  end if;

  select id into kid from public.keychains
  where token_hash = p_token_hash and status <> 'disabled';
  if kid is null then
    return 'not_found';
  end if;

  select count(*) into recent from public.feedback
  where keychain_id = kid and created_at > now() - interval '10 minutes';
  if recent >= 3 then
    return 'rate_limited';
  end if;

  insert into public.feedback (keychain_id, message) values (kid, body);
  return 'ok';
end;
$$;

create or replace function public.admin_stats()
returns json
language sql
security definer
set search_path = public
as $$
  with per_key as (
    select k.id, count(v.id) as scans
    from public.keychains k
    left join public.message_views v on v.keychain_id = k.id
    group by k.id
  )
  select json_build_object(
    'keychains_total',     (select count(*) from public.keychains),
    'keychains_active',    (select count(*) from public.keychains where status = 'active'),
    'keychains_disabled',  (select count(*) from public.keychains where status = 'disabled'),
    'scans_total',         (select count(*) from public.message_views),
    'scans_last_7_days',   (select count(*) from public.message_views where shown_at > now() - interval '7 days'),
    'scanned_keychains',   (select count(*) from per_key where scans > 0),
    'repeat_keychains',    (select count(*) from per_key where scans > 1),
    'avg_scans_per_scanned_keychain',
                           (select coalesce(round(avg(scans), 2), 0) from per_key where scans > 0),
    'messages_active',     (select count(*) from public.messages where active),
    'feedback_total',      (select count(*) from public.feedback)
  );
$$;

create or replace function public.admin_keychains()
returns table (id bigint, label text, status public.keychain_status, scans bigint, last_scan timestamptz, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select k.id, k.label, k.status, count(v.id), max(v.shown_at), k.created_at
  from public.keychains k
  left join public.message_views v on v.keychain_id = k.id
  group by k.id
  order by k.id;
$$;

revoke all on function public.pick_message(text), public.submit_feedback(text, text),
  public.admin_stats(), public.admin_keychains()
  from public, anon, authenticated;
grant execute on function public.pick_message(text), public.submit_feedback(text, text),
  public.admin_stats(), public.admin_keychains()
  to service_role;
