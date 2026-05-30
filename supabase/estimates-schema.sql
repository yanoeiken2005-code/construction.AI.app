-- =============================================
-- 土木見積もり機能スキーマ
-- schema.sql / companies-schema.sql の実行後に実行
-- =============================================

-- =============================================
-- estimates: 見積もり案件
-- =============================================
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete set null,
  project_name text not null,
  prefecture text,
  work_type text default '道路',         -- '道路' / '造成' / '混在' / 'その他'
  status text not null default 'draft'
    check (status in ('draft', 'analyzing', 'pending_questions', 'ready', 'archived')),
  drawing_files jsonb default '[]',     -- [{url, name, type, size}]
  pending_questions jsonb default '[]', -- AIからの質問配列（最大5件）
  user_answers jsonb default '{}',      -- ユーザー回答
  summary text,                         -- 工事概要（AIサマリ）
  total_amount numeric,                 -- 合計金額（税抜）
  total_amount_tax_included numeric,    -- 合計金額（税込）
  ai_notes text,                        -- AIによる注記
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists estimates_user_id_idx on public.estimates(user_id);
create index if not exists estimates_company_id_idx on public.estimates(company_id);
create index if not exists estimates_created_at_idx on public.estimates(created_at desc);

drop trigger if exists estimates_set_updated_at on public.estimates;
create trigger estimates_set_updated_at
  before update on public.estimates
  for each row execute function public.set_updated_at();

-- =============================================
-- estimate_items: 見積もり明細
-- =============================================
create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.estimates(id) on delete cascade not null,
  display_order int not null default 0,
  section text,                        -- 大項目（例：土工、舗装工、排水工）
  name text not null,                  -- 項目名
  spec text,                           -- 規格・仕様
  quantity numeric,                    -- 数量
  unit text,                           -- 単位（m3, m2, m, 式 など）
  unit_price numeric,                  -- 単価（円）
  amount numeric,                      -- 金額（円）
  source text,                         -- 単価の根拠（例：「資材単価2026/06 アスファルト合材」）
  confidence text default '中'
    check (confidence in ('高', '中', '低')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists estimate_items_estimate_id_idx on public.estimate_items(estimate_id);
create index if not exists estimate_items_display_order_idx on public.estimate_items(estimate_id, display_order);

-- =============================================
-- estimate_messages: 見積もりチャット履歴
-- =============================================
create table if not exists public.estimate_messages (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.estimates(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb default '[]',
  created_at timestamptz default now()
);

create index if not exists estimate_messages_estimate_id_idx on public.estimate_messages(estimate_id, created_at);

-- =============================================
-- RLS: estimates
-- =============================================
alter table public.estimates enable row level security;

drop policy if exists "ユーザーは自分の見積もりを参照可能" on public.estimates;
create policy "ユーザーは自分の見積もりを参照可能"
  on public.estimates for select
  using (auth.uid() = user_id);

drop policy if exists "ユーザーは自分の見積もりを作成可能" on public.estimates;
create policy "ユーザーは自分の見積もりを作成可能"
  on public.estimates for insert
  with check (auth.uid() = user_id);

drop policy if exists "ユーザーは自分の見積もりを更新可能" on public.estimates;
create policy "ユーザーは自分の見積もりを更新可能"
  on public.estimates for update
  using (auth.uid() = user_id);

drop policy if exists "ユーザーは自分の見積もりを削除可能" on public.estimates;
create policy "ユーザーは自分の見積もりを削除可能"
  on public.estimates for delete
  using (auth.uid() = user_id);

-- =============================================
-- RLS: estimate_items
-- =============================================
alter table public.estimate_items enable row level security;

drop policy if exists "ユーザーは自分の見積もりの明細を参照可能" on public.estimate_items;
create policy "ユーザーは自分の見積もりの明細を参照可能"
  on public.estimate_items for select
  using (
    exists (
      select 1 from public.estimates
      where estimates.id = estimate_items.estimate_id
        and estimates.user_id = auth.uid()
    )
  );

drop policy if exists "ユーザーは自分の見積もりの明細を作成可能" on public.estimate_items;
create policy "ユーザーは自分の見積もりの明細を作成可能"
  on public.estimate_items for insert
  with check (
    exists (
      select 1 from public.estimates
      where estimates.id = estimate_items.estimate_id
        and estimates.user_id = auth.uid()
    )
  );

drop policy if exists "ユーザーは自分の見積もりの明細を更新可能" on public.estimate_items;
create policy "ユーザーは自分の見積もりの明細を更新可能"
  on public.estimate_items for update
  using (
    exists (
      select 1 from public.estimates
      where estimates.id = estimate_items.estimate_id
        and estimates.user_id = auth.uid()
    )
  );

drop policy if exists "ユーザーは自分の見積もりの明細を削除可能" on public.estimate_items;
create policy "ユーザーは自分の見積もりの明細を削除可能"
  on public.estimate_items for delete
  using (
    exists (
      select 1 from public.estimates
      where estimates.id = estimate_items.estimate_id
        and estimates.user_id = auth.uid()
    )
  );

-- =============================================
-- RLS: estimate_messages
-- =============================================
alter table public.estimate_messages enable row level security;

drop policy if exists "ユーザーは自分の見積もりメッセージを参照可能" on public.estimate_messages;
create policy "ユーザーは自分の見積もりメッセージを参照可能"
  on public.estimate_messages for select
  using (auth.uid() = user_id);

drop policy if exists "ユーザーは自分の見積もりメッセージを作成可能" on public.estimate_messages;
create policy "ユーザーは自分の見積もりメッセージを作成可能"
  on public.estimate_messages for insert
  with check (auth.uid() = user_id);

-- =============================================
-- Storage バケット: estimates（設計図ファイル用）
-- =============================================
insert into storage.buckets (id, name, public)
values ('estimates', 'estimates', false)
on conflict (id) do nothing;

drop policy if exists "ユーザーは自分の見積もりファイルをアップロード可能" on storage.objects;
create policy "ユーザーは自分の見積もりファイルをアップロード可能"
  on storage.objects for insert
  with check (
    bucket_id = 'estimates' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "ユーザーは自分の見積もりファイルを参照可能" on storage.objects;
create policy "ユーザーは自分の見積もりファイルを参照可能"
  on storage.objects for select
  using (
    bucket_id = 'estimates' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "ユーザーは自分の見積もりファイルを削除可能" on storage.objects;
create policy "ユーザーは自分の見積もりファイルを削除可能"
  on storage.objects for delete
  using (
    bucket_id = 'estimates' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
