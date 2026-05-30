-- =============================================
-- 共有ドキュメント（全ユーザー共通の参照ナレッジ）
-- 単価表・歩掛・国交省資料など、ユーザー横断で見える資料用
-- =============================================
-- 適用順: schema.sql の後、estimates-schema.sql の後（順不同可）
-- 冪等（再実行可）
-- =============================================

-- 1. is_shared カラムを追加（既存ドキュメントには影響しない）
alter table public.documents
  add column if not exists is_shared boolean not null default false;

create index if not exists documents_is_shared_idx
  on public.documents(is_shared)
  where is_shared = true;

-- 2. RLS: 共有ドキュメントは全ユーザーが SELECT 可能
drop policy if exists "ユーザーは自分のドキュメントのみ参照可能" on public.documents;
create policy "ユーザーは自分または共有ドキュメントを参照可能"
  on public.documents for select
  using (auth.uid() = user_id or is_shared = true);

-- 3. match_documents を共有ドキュメント込みで検索するよう更新
create or replace function public.match_documents(
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
  from public.documents d
  where
    (p_user_id is null or d.user_id = p_user_id or d.is_shared = true)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- 4. Storage: shared/ フォルダ配下は全ユーザーが SELECT 可能
drop policy if exists "共有ファイルは全ユーザーが参照可能" on storage.objects;
create policy "共有ファイルは全ユーザーが参照可能"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'shared'
  );
