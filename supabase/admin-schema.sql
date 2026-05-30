-- =============================================
-- Admin 機能用スキーマ拡張
-- 既存DBに追加実行する SQL です
-- =============================================

-- =============================================
-- public.users テーブル (プロフィール)
-- auth.users と 1:1 で紐づけ、ロール・プラン・会社名を保持
-- =============================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  company_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  plan text not null default 'small' check (plan in ('small', 'standard')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists users_company_name_idx on public.users(company_name);
create index if not exists users_role_idx on public.users(role);

-- =============================================
-- auth.users 作成時に public.users を自動作成するトリガー
-- =============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, company_name, role, plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    coalesce(new.raw_user_meta_data->>'plan', 'small')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- 既存ユーザーを public.users に同期 (1回限り)
-- =============================================
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- =============================================
-- updated_at 自動更新トリガー
-- =============================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- =============================================
-- RLS ポリシー
-- =============================================
alter table public.users enable row level security;

drop policy if exists "ユーザーは自分のプロフィールを参照可能" on public.users;
create policy "ユーザーは自分のプロフィールを参照可能"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "管理者は全プロフィールを参照可能" on public.users;
create policy "管理者は全プロフィールを参照可能"
  on public.users for select
  using (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

drop policy if exists "管理者は全プロフィールを更新可能" on public.users;
create policy "管理者は全プロフィールを更新可能"
  on public.users for update
  using (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

drop policy if exists "管理者は全プロフィールを削除可能" on public.users;
create policy "管理者は全プロフィールを削除可能"
  on public.users for delete
  using (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

-- =============================================
-- 初期 admin ユーザーを設定するための手順 (手動)
-- =============================================
-- 1. Supabase Authentication > Users で管理者用アカウントを作成
-- 2. その UUID を控え、以下を SQL Editor で実行:
--    update public.users set role = 'admin' where email = 'admin@example.com';
