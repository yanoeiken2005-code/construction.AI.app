-- =============================================
-- companies / users 最小ブートストラップ
-- estimates-schema.sql を実行する前に1回だけ実行してください。
-- admin-schema.sql / companies-schema.sql が既に適用済みでも安全です（冪等）。
-- =============================================

-- =============================================
-- updated_at 自動更新関数
-- =============================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================
-- public.users (プロフィール)
-- =============================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists users_role_idx on public.users(role);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- 既存の auth.users を public.users に同期
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- RLS
alter table public.users enable row level security;

drop policy if exists "ユーザーは自分のプロフィールを参照可能" on public.users;
create policy "ユーザーは自分のプロフィールを参照可能"
  on public.users for select
  using (auth.uid() = id);

-- =============================================
-- public.companies
-- =============================================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  plan text not null default 'small' check (plan in ('solo', 'small', 'standard')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 既存DB用: plan の check を 'solo' 対応に再作成
alter table public.companies drop constraint if exists companies_plan_check;
alter table public.companies add constraint companies_plan_check
  check (plan in ('solo', 'small', 'standard'));

create index if not exists companies_name_idx on public.companies(name);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- =============================================
-- users.company_id を追加（既にあればスキップ）
-- =============================================
alter table public.users
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists users_company_id_idx on public.users(company_id);

-- =============================================
-- handle_new_user トリガー（招待時に company_id を取り込む）
-- =============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, company_id, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'company_id', '')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do update
    set company_id = coalesce(excluded.company_id, public.users.company_id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- companies の RLS
-- =============================================
alter table public.companies enable row level security;

drop policy if exists "ユーザーは自社情報を参照可能" on public.companies;
create policy "ユーザーは自社情報を参照可能"
  on public.companies for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid() and users.company_id = companies.id
    )
  );
