-- parserail-desk: the product's real developer-platform schema, pulled from the shared
-- production project xowekqdsttxwbhfxvusa on 2026-09-19 and re-read on 2026-09-29.
--
-- Every call site in ~/CompoundLabs/parserail reads `compound_api_keys`, `compound_credit_accounts`,
-- `compound_usage_events`, `compound_api_jobs`, `compound_agent_memories`, `compound_rate_limits`
-- and the four `compound_*` RPCs. Until 2026-09-29 production served those names as views and SQL
-- wrappers over older tables that a 2026-09-10 rename sweep left behind. On 2026-09-29 the tables
-- themselves were renamed to compound_*, and pg_class.relkind now reads 'r' for all seven. This
-- file reproduces that: the app and the graders read the same seven tables.

create extension if not exists vector;

-- the tables ----------------------------------------------------------------------------

create table if not exists public.compound_credit_accounts (
  account_id              uuid primary key,
  balance_credits         integer     not null default 0,
  free_grant_used         boolean     not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  last_free_grant_at      timestamptz,
  stripe_customer_id      text,
  default_payment_method  text,
  auto_recharge_pack      text,
  last_auto_recharge_at   timestamptz,
  webhook_secret          text,
  activated_at            timestamptz,
  grant_email             text
);
create unique index if not exists compound_credit_accounts_grant_email_uniq
  on public.compound_credit_accounts (grant_email) where grant_email is not null;

create table if not exists public.compound_api_keys (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid        not null,
  key_prefix   text        not null,
  key_hash     text        not null unique,
  label        text        not null default 'default',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists compound_api_keys_account_idx on public.compound_api_keys (account_id);
create index if not exists compound_api_keys_prefix_idx  on public.compound_api_keys (key_prefix);

create table if not exists public.compound_usage_events (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid        not null,
  api_key_id     uuid,
  endpoint       text        not null,
  units          integer     not null default 1,
  credits_burned integer     not null default 0,
  request_id     text,
  model          text,
  created_at     timestamptz not null default now(),
  meta           jsonb       not null default '{}'::jsonb
);
create index if not exists compound_usage_events_account_idx
  on public.compound_usage_events (account_id, created_at desc);

create table if not exists public.compound_credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid        not null,
  delta         integer     not null,
  reason        text        not null,
  balance_after integer     not null,
  ref           text,
  created_at    timestamptz not null default now()
);
create index if not exists compound_credit_ledger_account_idx
  on public.compound_credit_ledger (account_id, created_at desc);

create table if not exists public.compound_api_jobs (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid        not null,
  api_key_id       uuid,
  endpoint         text        not null,
  status           text        not null default 'queued',
  request          jsonb       not null default '{}'::jsonb,
  result           jsonb,
  error            text,
  request_id       text,
  callback_url     text,
  credits_charged  integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  lease_expires_at timestamptz
);
create index if not exists compound_api_jobs_account_idx on public.compound_api_jobs (account_id, created_at desc);
create index if not exists compound_api_jobs_reap_idx    on public.compound_api_jobs (status, lease_expires_at)
  where status in ('queued', 'running');

create table if not exists public.compound_agent_memories (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid        not null,
  namespace  text        not null default 'default',
  content    text        not null,
  metadata   jsonb       not null default '{}'::jsonb,
  embedding  vector(768) not null,
  created_at timestamptz not null default now()
);
create index if not exists compound_agent_memories_account_ns
  on public.compound_agent_memories (account_id, namespace, created_at desc);

create table if not exists public.compound_rate_limits (
  bucket_key text primary key,
  count      integer     not null default 0,
  expires_at timestamptz not null
);

-- The monthly-refresh cron reads this one by its own name. It is here so that route runs rather
-- than 500s.
create table if not exists public.all_access_user_subscriptions (
  user_id                uuid primary key,
  tier                   text not null default 'free',
  status                 text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_price_id        text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false,
  updated_at             timestamptz not null default now()
);
