import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { data: estimate, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    if (!estimate) return NextResponse.json({ error: '見積もりが見つかりません' }, { status: 404 })

    const { data: items } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', id)
      .order('display_order', { ascending: true })

    const { data: messages } = await supabase
      .from('estimate_messages')
      .select('*')
      .eq('estimate_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      estimate,
      items: items || [],
      messages: messages || [],
    })
  } catch (error) {
    console.error('Estimate get error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await request.json()
    const allowed: Record<string, unknown> = {}
    for (const key of [
      'project_name',
      'prefecture',
      'work_type',
      'status',
      'user_answers',
      'summary',
      'ai_notes',
      'pending_questions',
    ]) {
      if (key in body) allowed[key] = body[key]
    }

    const { data: estimate, error } = await supabase
      .from('estimates')
      .update(allowed)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ estimate })
  } catch (error) {
    console.error('Estimate update error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const adminClient = await createAdminClient()

    // ストレージのファイルも削除
    const { data: est } = await adminClient
      .from('estimates')
      .select('drawing_files')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (est?.drawing_files && Array.isArray(est.drawing_files)) {
      const paths: string[] = []
      for (const f of est.drawing_files) {
        const path = (f.url as string)?.split('/estimates/')[1]
        if (path) paths.push(path)
      }
      if (paths.length > 0) await adminClient.storage.from('estimates').remove(paths)
    }

    const { error } = await adminClient
      .from('estimates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Estimate delete error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
