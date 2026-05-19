import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { message, history = [] } = await request.json()
    if (!message) return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })

    // クエリをベクトル化して関連ドキュメントを検索
    const adminClient = await createAdminClient()
    let sources: any[] = []

    try {
      const queryEmbedding = await generateEmbedding(message)
      const { data: docs } = await adminClient.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.4,
        match_count: 5,
        p_user_id: user.id,
      })
      sources = docs || []
    } catch {
      // 埋め込み失敗時はコンテキストなしで回答
    }

    // コンテキスト生成
    const contextText = sources.length > 0
      ? sources
          .map((d: any, i: number) =>
            `【資料${i + 1}】${d.name}${d.project_name ? `（工事名：${d.project_name}）` : ''}${d.document_date ? `（日付：${d.document_date}）` : ''}\n${d.content || '内容なし'}`
          )
          .join('\n\n---\n\n')
      : null

    const hasContext = !!contextText

    const commonGuidelines = `【共通の指針】
- 確実でない情報は「〜と思われます」「現場での確認が必要です」と明示してください
- 建設業の専門用語を適切に使いつつ、わかりやすく説明してください`

    const withContextGuidelines = `【資料がある場合の回答スタイル】
- 参照した資料がある場合は「○○（資料名）によると」のように引用してください
- 過去の対応事例がある場合は、具体的な方法・手順を提示してください
- 箇条書きや見出しを使って整理しても構いません`

    const noContextGuidelines = `【資料がない場合の回答スタイル】
現在、社内資料は見つかりませんでした。一般的な知識でお答えしますが、以下の形式を厳守してください。

- 必ず「自然な文章（段落形式）」で書いてください
- 箇条書き（・、-、*、1. など）、見出し（##、**太字** など）、Markdown記号は使わないでください
- まるで先輩社員が口頭で説明してくれるような、読みやすい普通の文章にしてください
- 必要に応じて段落を分け、丁寧に説明してください
- 冒頭で「該当する社内資料は見つかりませんでしたので、一般的な内容としてお答えします。」と前置きしてください`

    const systemPrompt = `あなたは建設会社の業務をサポートするAIアシスタントです。
社内の過去の書類・対応事例・施工記録などを参照しながら、社長や社員の質問に的確に答えます。

${commonGuidelines}

${hasContext ? withContextGuidelines : noContextGuidelines}

${hasContext ? `【参照できる社内資料】\n${contextText}` : ''}`

    const messages = [
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''

    // チャット履歴を保存
    await supabase.from('chat_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      {
        user_id: user.id,
        role: 'assistant',
        content: answer,
        sources: sources.map((s: any) => ({
          id: s.id, name: s.name, project_name: s.project_name,
          document_date: s.document_date, category: s.category, file_url: s.file_url,
        })),
      },
    ])

    return NextResponse.json({
      answer,
      sources: sources.map((s: any) => ({
        id: s.id, name: s.name, project_name: s.project_name,
        document_date: s.document_date, category: s.category, file_url: s.file_url,
      })),
    })
  } catch (error: unknown) {
    console.error('Chat API error:', error)

    let userMessage = 'エラーが発生しました。もう一度お試しください。'
    let code = 'unknown'
    let status = 500

    const err = error as {
      status?: number
      message?: string
      error?: { error?: { type?: string; message?: string } }
    }

    const apiErr = err?.error?.error
    if (apiErr) {
      const apiMessage = apiErr.message ?? ''
      if (apiMessage.includes('credit balance')) {
        userMessage =
          'Anthropic API のクレジット残高が不足しています。console.anthropic.com の「Plans & Billing」からクレジットを追加してください。'
        code = 'credit_balance_too_low'
      } else if (apiErr.type === 'authentication_error') {
        userMessage =
          'Anthropic API キーが無効です。.env.local の ANTHROPIC_API_KEY を確認してください。'
        code = 'authentication_error'
        status = 401
      } else if (apiErr.type === 'rate_limit_error') {
        userMessage =
          'Anthropic API のレート制限に達しました。少し時間をおいて再度お試しください。'
        code = 'rate_limit_error'
        status = 429
      } else if (apiErr.type === 'overloaded_error') {
        userMessage =
          'Claude API が一時的に混雑しています。少し時間をおいて再度お試しください。'
        code = 'overloaded_error'
        status = 503
      } else if (apiErr.type === 'permission_error') {
        userMessage =
          'Anthropic API キーに必要な権限がありません。キーの権限設定を確認してください。'
        code = 'permission_error'
        status = 403
      } else {
        userMessage = `Anthropic API エラー: ${apiMessage || apiErr.type || '原因不明'}`
        code = apiErr.type ?? 'api_error'
      }
    } else if (typeof err?.message === 'string' && err.message.toLowerCase().includes('openai')) {
      userMessage = `OpenAI API エラー: ${err.message}`
      code = 'openai_error'
    } else if (err?.message) {
      userMessage = err.message
    }

    return NextResponse.json({ error: userMessage, code }, { status })
  }
}
