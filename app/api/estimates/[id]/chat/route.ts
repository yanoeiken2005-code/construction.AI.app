import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import { anthropic, ESTIMATE_MODEL, buildChatSystemPrompt } from '@/lib/estimates'
import type { EstimateItem } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { message } = await request.json()
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    const { data: estimate } = await adminClient
      .from('estimates')
      .select('id, project_name, prefecture, work_type, summary')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!estimate) {
      return NextResponse.json({ error: '見積もりが見つかりません' }, { status: 404 })
    }

    const { data: items } = await adminClient
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', id)
      .order('display_order')

    const { data: history } = await adminClient
      .from('estimate_messages')
      .select('role, content')
      .eq('estimate_id', id)
      .order('created_at', { ascending: true })
      .limit(20)

    let contextText: string | null = null
    let sources: Array<{ id: string; name: string; project_name?: string; document_date?: string; category?: string; file_url?: string }> = []
    try {
      const queryEmbedding = await generateEmbedding(`${estimate.project_name} ${message}`)
      const { data: docs } = await adminClient.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.4,
        match_count: 4,
        p_user_id: user.id,
      })
      if (docs && docs.length > 0) {
        sources = docs
        contextText = docs
          .map(
            (d: { name: string; project_name?: string; content?: string }, i: number) =>
              `【資料${i + 1}】${d.name}${d.project_name ? `（${d.project_name}）` : ''}\n${(d.content || '').slice(0, 600)}`
          )
          .join('\n\n---\n\n')
      }
    } catch (e) {
      console.warn('Chat vector search failed:', e)
    }

    const systemPrompt = buildChatSystemPrompt({
      estimateSummary: estimate.summary,
      items: (items as EstimateItem[]) || [],
      hasContext: !!contextText,
      contextText,
    })

    const messages = [
      ...((history || []).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }))),
      { role: 'user' as const, content: message },
    ]

    const response = await anthropic.messages.create({
      model: ESTIMATE_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    })

    const answer = response.content[0]?.type === 'text' ? response.content[0].text : ''

    await adminClient.from('estimate_messages').insert([
      { estimate_id: id, user_id: user.id, role: 'user', content: message },
      {
        estimate_id: id,
        user_id: user.id,
        role: 'assistant',
        content: answer,
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
          project_name: s.project_name,
          document_date: s.document_date,
          category: s.category,
          file_url: s.file_url,
        })),
      },
    ])

    return NextResponse.json({
      answer,
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        project_name: s.project_name,
        document_date: s.document_date,
        category: s.category,
        file_url: s.file_url,
      })),
    })
  } catch (error) {
    console.error('Estimate chat error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
