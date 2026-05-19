-- =============================================
-- 会社単位プラン管理スキーマ
-- admin-schema.sql の実行後に、追加で実行する SQL です
-- 既存の public.users にあった company_name / plan は
-- public.companies に移行されたあと削除されます
-- =============================================

-- =============================================
-- companies テーブル
-- =============================================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  plan text not null default 'small' check (plan in ('small', 'standard')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists companies_name_idx on public.companies(name);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- =============================================
-- users.company_id カラムを追加
-- =============================================
alter table public.users
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists users_company_id_idx on public.users(company_id);

-- =============================================
-- 既存データの移行
--   users.company_name → companies.name を作成
--   users.company_id を埋める
--   users.plan → companies.plan に引き上げ (standard が1人でもいれば standard)
-- =============================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'company_name'
  ) then
    insert into public.companies (name)
    select distinct trim(company_name) from public.users
    where company_name is not null and trim(company_name) <> ''
    on conflict (name) do nothing;

    update public.users u
    set company_id = c.id
    from public.companies c
    where trim(coalesce(u.company_name, '')) = c.name and u.company_id is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'plan'
  ) then
    update public.companies c
    set plan = 'standard'
    where exists (
      select 1 from public.users u
      where u.company_id = c.id and u.plan = 'standard'
    );
  end if;
end $$;

-- =============================================
-- 旧カラム (users.company_name / users.plan) を削除
-- =============================================
alter table public.users drop column if exists company_name;
alter table public.users drop column if exists plan;

-- =============================================
-- handle_new_user トリガー更新
--   招待時の raw_user_meta_data から company_id を取り込む
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

-- =============================================
-- companies の RLS ポリシー
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

drop policy if exists "管理者は全社情報を参照可能" on public.companies;
create policy "管理者は全社情報を参照可能"
  on public.companies for select
  using (public.is_admin());

drop policy if exists "管理者は会社を作成可能" on public.companies;
create policy "管理者は会社を作成可能"
  on public.companies for insert
  with check (public.is_admin());

drop policy if exists "管理者は会社を更新可能" on public.companies;
create policy "管理者は会社を更新可能"
  on public.companies for update
  using (public.is_admin());

drop policy if exists "管理者は会社を削除可能" on public.companies;
create policy "管理者は会社を削除可能"
  on public.companies for delete
  using (public.is_admin());
