import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import {
  anthropic,
  ESTIMATE_MODEL,
  buildSystemPrompt,
  classifyDrawingFile,
  ensureQuestionIds,
  imageMediaType,
  parseAnalysisJson,
} from '@/lib/estimates'
import type { EstimateDrawingFile } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

type ContentBlock = Anthropic.Messages.ContentBlockParam

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const adminClient = await createAdminClient()

    const { data: estimate, error: estErr } = await adminClient
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (estErr || !estimate) {
      return NextResponse.json({ error: '見積もりが見つかりません' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({})) as { userAnswers?: Record<string, string> }
    const userAnswers = body.userAnswers || (estimate.user_answers as Record<string, string>) || {}

    await adminClient
      .from('estimates')
      .update({ status: 'analyzing' })
      .eq('id', id)

    // ベクトル検索で関連単価資料・類似案件を取得
    let contextText: string | null = null
    try {
      const queryText = `${estimate.project_name} ${estimate.work_type} 単価 歩掛 ${estimate.prefecture ?? ''}`
      const queryEmbedding = await generateEmbedding(queryText)
      const { data: docs } = await adminClient.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 6,
        p_user_id: user.id,
      })
      if (docs && docs.length > 0) {
        contextText = docs
          .map(
            (d: { name: string; project_name?: string; document_date?: string; content?: string }, i: number) =>
              `【資料${i + 1}】${d.name}${d.project_name ? `（${d.project_name}）` : ''}${
                d.document_date ? `（${d.document_date}）` : ''
              }\n${(d.content || '').slice(0, 800)}`
          )
          .join('\n\n---\n\n')
      }
    } catch (e) {
      console.warn('Vector search failed:', e)
    }

    const systemPrompt = buildSystemPrompt({
      workType: estimate.work_type,
      prefecture: estimate.prefecture,
      hasContext: !!contextText,
      contextText,
    })

    // 図面ファイルを Anthropic に渡す content blocks に変換
    const drawingFiles = (estimate.drawing_files as EstimateDrawingFile[]) || []
    const contentBlocks: ContentBlock[] = []

    contentBlocks.push({
      type: 'text',
      text: `【工事名】 ${estimate.project_name}\n【都道府県】 ${estimate.prefecture ?? '未設定'}\n【工事区分】 ${estimate.work_type}\n\n以下、設計図・資料を添付します。読み取って項目別概算見積もりを作成してください。`,
    })

    for (const f of drawingFiles) {
      const kind = classifyDrawingFile(f)
      try {
        const blob = await downloadFromStorage(adminClient, f.url)
        if (!blob) {
          contentBlocks.push({
            type: 'text',
            text: `--- 添付: ${f.name} はサーバー側で読み込めませんでした ---`,
          })
          continue
        }
        const buf = Buffer.from(await blob.arrayBuffer())
        if (kind === 'image') {
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType(f),
              data: buf.toString('base64'),
            },
          })
        } else if (kind === 'pdf') {
          contentBlocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: buf.toString('base64'),
            },
          })
        } else if (kind === 'text') {
          const text = buf.toString('utf-8')
          contentBlocks.push({
            type: 'text',
            text: `--- ファイル: ${f.name} ---\n${text.slice(0, 30000)}`,
          })
        } else {
          contentBlocks.push({
            type: 'text',
            text: `--- 添付: ${f.name}（形式: ${f.type || '不明'}） ---\nこのファイル形式は直接読み取れません。ファイル名と工事区分から推定される標準的な内容で見積もりに含めるか、不明点質問として扱ってください。`,
          })
        }
      } catch (e) {
        console.warn('File load failed:', f.name, e)
        contentBlocks.push({
          type: 'text',
          text: `--- 添付: ${f.name} はサーバー側で読み込めませんでした ---`,
        })
      }
    }

    if (Object.keys(userAnswers).length > 0) {
      const answersText = Object.entries(userAnswers)
        .map(([qid, ans]) => `- ${qid}: ${ans}`)
        .join('\n')
      contentBlocks.push({
        type: 'text',
        text: `\n【ユーザーからの追加情報（前回の不明点質問への回答）】\n${answersText}\n\nこの情報を反映して見積もりを更新してください。`,
      })
    }

    const response = await anthropic.messages.create({
      model: ESTIMATE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    })

    const answer = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (!answer) {
      await adminClient.from('estimates').update({ status: 'draft' }).eq('id', id)
      return NextResponse.json({ error: 'AIから応答を取得できませんでした' }, { status: 500 })
    }

    let parsed
    try {
      parsed = parseAnalysisJson(answer)
    } catch (e) {
      console.error('JSON parse error:', e, '\nRaw:', answer)
      await adminClient.from('estimates').update({ status: 'draft' }).eq('id', id)
      return NextResponse.json({
        error: 'AIの応答が想定形式ではありませんでした。もう一度お試しください。',
      }, { status: 500 })
    }

    // 既存の明細を削除して新規挿入
    await adminClient.from('estimate_items').delete().eq('estimate_id', id)
    if (parsed.items.length > 0) {
      const rows = parsed.items.map((it, idx) => ({
        estimate_id: id,
        display_order: idx,
        section: it.section ?? null,
        name: it.name,
        spec: it.spec ?? null,
        quantity: it.quantity ?? null,
        unit: it.unit ?? null,
        unit_price: it.unit_price ?? null,
        amount: it.amount ?? (it.quantity && it.unit_price ? it.quantity * it.unit_price : null),
        source: it.source ?? null,
        confidence: it.confidence ?? '中',
        notes: it.notes ?? null,
      }))
      const { error: insertItemsErr } = await adminClient.from('estimate_items').insert(rows)
      if (insertItemsErr) console.error('Items insert error:', insertItemsErr)
    }

    const pendingQuestions = ensureQuestionIds(parsed.pending_questions)
    const status = pendingQuestions.length > 0 ? 'pending_questions' : 'ready'

    const { data: updated } = await adminClient
      .from('estimates')
      .update({
        status,
        summary: parsed.summary,
        total_amount: parsed.total_amount ?? null,
        total_amount_tax_included: parsed.total_amount_tax_included ?? null,
        ai_notes: parsed.ai_notes ?? null,
        pending_questions: pendingQuestions,
        user_answers: userAnswers,
      })
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json({ estimate: updated, pendingQuestions })
  } catch (error: unknown) {
    console.error('Estimate analyze error:', error)
    const msg = error instanceof Error ? error.message : 'エラーが発生しました'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>

async function downloadFromStorage(client: AdminClient, url: string): Promise<Blob | null> {
  const marker = '/estimates/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = url.slice(idx + marker.length)
  const { data, error } = await client.storage.from('estimates').download(path)
  if (error) {
    console.warn('Storage download error:', error)
    return null
  }
  return data
}
