import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REFERENCE_FOLDER = '見積もり用資料'
const CATEGORY = '単価表・歩掛'

// ファイル名から推測されるラベル（必要に応じて追加）
const KNOWN_LABELS: Record<string, { project_name: string; document_date: string }> = {
  'roumutanka20260401.pdf': { project_name: '公共工事設計労務単価 2026/04/01', document_date: '2026-04-01' },
  'sizaitanka20260601.pdf': { project_name: '公共工事資材単価 2026/06/01', document_date: '2026-06-01' },
}

// =============================================
// GET: 状態確認用（ブラウザで叩いて状態を見られる）
// =============================================
export async function GET() {
  try {
    const folder = path.join(process.cwd(), REFERENCE_FOLDER)
    let files: string[] = []
    let folderExists = true
    try {
      files = await fs.readdir(folder)
    } catch {
      folderExists = false
    }
    const pdfs = files.filter((f) => f.toLowerCase().endsWith('.pdf'))

    return NextResponse.json({
      endpoint: '/api/admin/seed-estimate-references',
      description: 'POST で 見積もり用資料/ 配下の PDF を documents テーブルに一括登録します',
      folder,
      folder_exists: folderExists,
      pdf_count: pdfs.length,
      pdf_files: pdfs,
      usage: "fetch('/api/admin/seed-estimate-references', { method: 'POST' }).then(r => r.json())",
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'エラーが発生しました',
    }, { status: 500 })
  }
}

// =============================================
// POST: 一括登録
// =============================================
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です。ログインしてから実行してください。' }, { status: 401 })

    const adminClient = await createAdminClient()
    const folder = path.join(process.cwd(), REFERENCE_FOLDER)

    let files: string[] = []
    try {
      files = await fs.readdir(folder)
    } catch {
      return NextResponse.json({
        error: `${REFERENCE_FOLDER} フォルダが見つかりません（${folder}）。プロジェクトルートに配置してください。`,
      }, { status: 404 })
    }

    const pdfs = files.filter((f) => f.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) {
      return NextResponse.json({ error: 'PDFファイルが見つかりません' }, { status: 404 })
    }

    const results: Array<{ name: string; status: 'ok' | 'skipped' | 'error'; reason?: string }> = []

    for (const fname of pdfs) {
      try {
        // 既に共有ドキュメントとして登録済みかチェック（全ユーザー横断）
        const { data: existing } = await adminClient
          .from('documents')
          .select('id')
          .eq('name', fname)
          .eq('category', CATEGORY)
          .eq('is_shared', true)
          .maybeSingle()
        if (existing) {
          results.push({ name: fname, status: 'skipped', reason: '共有ドキュメントとして登録済み' })
          continue
        }

        const filePath = path.join(folder, fname)
        const buf = await fs.readFile(filePath)
        // shared/ 配下に置くと全ユーザーが参照可能（storage RLS）
        const storagePath = `shared/seed_${Date.now()}_${fname}`

        const { error: upErr } = await adminClient.storage
          .from('documents')
          .upload(storagePath, buf, { contentType: 'application/pdf', upsert: false })
        if (upErr) throw new Error(`Storage アップロード失敗: ${upErr.message}`)

        const { data: { publicUrl } } = adminClient.storage
          .from('documents')
          .getPublicUrl(storagePath)

        const meta = KNOWN_LABELS[fname]
        const projectName = meta?.project_name ?? `単価・歩掛資料 ${fname}`
        const documentDate = meta?.document_date ?? new Date().toISOString().slice(0, 10)
        const content =
          `ファイル名: ${fname}\nカテゴリ: ${CATEGORY}\n工事区分: 土木（道路・造成等）\n資料名: ${projectName}\n備考: 見積もり用の単価・歩掛参照資料`

        let embedding: number[] | null = null
        try {
          embedding = await generateEmbedding(`${projectName} 単価 歩掛 土木 道路 造成 ${fname}`)
        } catch (e) {
          console.warn(`[seed] embedding failed for ${fname}:`, e)
        }

        const { error: insertErr } = await adminClient.from('documents').insert({
          user_id: user.id,
          name: fname,
          content,
          file_url: publicUrl,
          file_type: 'application/pdf',
          project_name: projectName,
          document_date: documentDate,
          category: CATEGORY,
          embedding,
          is_shared: true,
        })
        if (insertErr) throw new Error(`DB 挿入失敗: ${insertErr.message}`)

        results.push({ name: fname, status: 'ok' })
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        console.error(`[seed] failed for ${fname}:`, reason)
        results.push({ name: fname, status: 'error', reason })
      }
    }

    return NextResponse.json({
      summary: {
        total: pdfs.length,
        ok: results.filter((r) => r.status === 'ok').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        error: results.filter((r) => r.status === 'error').length,
      },
      results,
    })
  } catch (error) {
    console.error('Seed estimate references error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'エラーが発生しました',
    }, { status: 500 })
  }
}
