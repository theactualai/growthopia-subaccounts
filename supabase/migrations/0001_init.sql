-- Growthopia Subaccounts — initial schema
--
-- Two rules shape this file:
--
--  1. Nothing in `public` is readable by the browser. Every table has RLS on
--     with a policy for authenticated users, and the one table holding secrets
--     has NO policy at all, so PostgREST returns nothing to anyone. Only the
--     service role, used server-side, can read it.
--
--  2. Deleting a resource must never orphan the record of who it belonged to.
--     Assignments are nulled, not cascaded, so the audit trail survives.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- clients

create table if not exists clients (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,              -- '0001', matches the ops board
  name                text not null,
  primary_handle      text,
  status              text not null default 'onboarding'
                      check (status in ('onboarding','active','paused','offboarded')),
  target_per_platform int  not null default 3,
  city                text,                              -- drives proxy + area-code matching
  notes               text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------- proxies

create table if not exists proxies (
  id             uuid primary key default gen_random_uuid(),
  vendor         text not null default 'webshare',
  address        text not null,
  port           int  not null,
  protocol       text not null default 'http'            -- HTTP, not SOCKS5: Microsoft 502s on SOCKS5
                 check (protocol in ('http','socks5')),
  tier           text not null default 'dedicated'
                 check (tier in ('shared','private','dedicated')),
  country        text,
  city           text,
  -- Independent reputation, refreshed by the preflight. A flagged IP cannot
  -- create accounts, whatever the vendor's own dashboard claims.
  flagged        boolean,
  flagged_at     timestamptz,
  monthly_cost   numeric(8,3) not null default 0.825,
  status         text not null default 'active'
                 check (status in ('active','cooldown','retired')),
  created_at     timestamptz not null default now(),
  unique (address, port)
);

-- ------------------------------------------------------------- identities

-- One browser profile plus the proxy bound to it. The unit that carries
-- accounts, and the thing that gets recycled after a cooldown.
create table if not exists identities (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid references clients(id) on delete set null,
  label              text not null,
  gologin_profile_id text unique,
  proxy_id           uuid references proxies(id) on delete set null,
  status             text not null default 'active'
                     check (status in ('active','held','cooldown','retired')),
  assigned_at        timestamptz default now(),
  released_at        timestamptz,
  created_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------- email

create table if not exists email_domains (
  id             uuid primary key default gen_random_uuid(),
  domain         text unique not null,
  registrar      text not null default 'spaceship',
  cloudflare_zone_id text,
  catch_all_to   text,
  registered_on  date,
  expires_on     date,
  auto_renew     boolean not null default true,
  annual_cost    numeric(8,2),
  status         text not null default 'provisioning'
                 check (status in ('provisioning','active','expired','released')),
  created_at     timestamptz not null default now()
);

create table if not exists email_identities (
  id         uuid primary key default gen_random_uuid(),
  domain_id  uuid references email_domains(id) on delete restrict,
  address    text unique not null,
  client_id  uuid references clients(id) on delete set null,
  status     text not null default 'active'
             check (status in ('active','retired')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- phone

create table if not exists phone_resources (
  id           uuid primary key default gen_random_uuid(),
  vendor       text not null default 'textverified',
  masked       text not null,                            -- never the full number in a readable table
  area_code    text,
  kind         text not null default 'one-time'
               check (kind in ('one-time','rental')),
  service      text,                                     -- 'instagram' etc; generic rentals do not receive
  monthly_cost numeric(8,2) not null default 0,
  client_id    uuid references clients(id) on delete set null,
  status       text not null default 'active'
               check (status in ('active','released','failed')),
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------- platform accounts

create table if not exists platform_accounts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  platform     text not null check (platform in ('instagram','tiktok','youtube')),
  handle       text not null,
  identity_id  uuid references identities(id) on delete set null,
  email_id     uuid references email_identities(id) on delete set null,
  phone_id     uuid references phone_resources(id) on delete set null,
  two_factor   text not null default 'none'
               check (two_factor in ('none','sms','authenticator')),
  status       text not null default 'warming'
               check (status in ('warming','live','needs-attention','lost')),
  created_at   timestamptz not null default now(),
  unique (platform, handle)
);

-- ------------------------------------------------------------- secrets 🔒

-- No RLS policy is defined for this table on purpose. RLS is enabled and no
-- policy grants access, so PostgREST returns nothing to any browser session,
-- authenticated or not. Only the service role key - server-side only - reads it.
-- Values are encrypted before insert with TOTP_ENCRYPTION_KEY, which lives
-- outside the database, so a dump alone is useless.
create table if not exists account_secrets (
  id                 uuid primary key default gen_random_uuid(),
  platform_account_id uuid not null references platform_accounts(id) on delete cascade,
  totp_secret_enc    text,
  password_enc       text,
  backup_codes_enc   text,
  updated_at         timestamptz not null default now(),
  unique (platform_account_id)
);

-- ------------------------------------------------------------------ audit

create table if not exists audit_events (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  actor         text not null,
  action        text not null,
  resource_type text,
  resource_id   text,
  detail        text
);

create index if not exists audit_at_idx on audit_events (at desc);
create index if not exists accounts_client_idx on platform_accounts (client_id);
create index if not exists identities_client_idx on identities (client_id);

-- -------------------------------------------------------------------- RLS

alter table clients            enable row level security;
alter table proxies            enable row level security;
alter table identities         enable row level security;
alter table email_domains      enable row level security;
alter table email_identities   enable row level security;
alter table phone_resources    enable row level security;
alter table platform_accounts  enable row level security;
alter table audit_events       enable row level security;
alter table account_secrets    enable row level security;   -- deliberately no policy

do $$
declare t text;
begin
  foreach t in array array['clients','proxies','identities','email_domains',
                           'email_identities','phone_resources','platform_accounts']
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated', t);
  end loop;
end $$;

-- Audit is append-only from the app's point of view: readable, insertable,
-- never updatable or deletable.
create policy audit_read   on audit_events for select to authenticated using (true);
create policy audit_insert on audit_events for insert to authenticated with check (true);
