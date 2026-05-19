-- =============================================
-- Construction Knowledge AI - Supabase Schema
-- =============================================

-- pgvector 拡張を有効化
create extension if not exists vector;

-- =============================================
-- ドキュメントテーブル
-- =============================================
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,                    -- ファイル名
  content text,                          -- 抽出テキスト
  file_url text,                         -- Supabase Storage の URL
  file_type text,                        -- pdf / image / excel / word
  project_name text,                     -- 工事名
  document_date date,                    -- 書類の日付
  category text default 'その他',        -- カテゴリ（施工図/報告書/クレーム等）
  embedding vector(1536),               -- OpenAI text-embedding-3-small
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ベクトル検索用インデックス
create index if not exists documents_embedding_idx
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 全文検索用インデックス
create index if not exists documents_content_fts
  on documents using gin (to_tsvector('japanese', coalesce(content, '') || ' ' || coalesce(name, '') || ' ' || coalesce(project_name, '')));

-- =============================================
-- チャット履歴テーブル
-- =============================================
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb default '[]',           -- 参照したドキュメントの情報
  created_at timestamptz default now()
);

-- =============================================
-- RLS (Row Level Security) ポリシー
-- =============================================

-- documents テーブル
alter table documents enable row level security;

create policy "ユーザーは自分のドキュメントのみ参照可能"
  on documents for select
  using (auth.uid() = user_id);

create policy "ユーザーは自分のドキュメントのみ挿入可能"
  on documents for insert
  with check (auth.uid() = user_id);

create policy "ユーザーは自分のドキュメントのみ削除可能"
  on documents for delete
  using (auth.uid() = user_id);

-- chat_messages テーブル
alter table chat_messages enable row level security;

create policy "ユーザーは自分のチャット履歴のみ参照可能"
  on chat_messages for select
  using (auth.uid() = user_id);

create policy "ユーザーは自分のチャット履歴のみ挿入可能"
  on chat_messages for insert
  with check (auth.uid() = user_id);

-- =============================================
-- ベクトル類似検索関数
-- =============================================
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  p_user_id uuid default null
)
returns table (
  id uuid,
  name text,
  content text,
  file_url text,
  file_type text,
  project_name text,
  document_date date,
  category text,
  similarity float
)
language sql stable
as $$
  select
    d.id,
    d.name,
    d.content,
    d.file_url,
    d.file_type,
    d.project_name,
    d.document_date,
    d.category,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where
    (p_user_id is null or d.user_id = p_user_id)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- =============================================
-- Storage バケット設定
-- =============================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "ユーザーは自分のファイルのみアップロード可能"
  on storage.objects for insert
  with check (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "ユーザーは自分のファイルのみ参照可能"
  on storage.objects for select
  using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "ユーザーは自分のファイルのみ削除可能"
  on storage.objects for delete
  using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
