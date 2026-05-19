import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

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

    // ファイル URL を取得して Storage からも削除
    const { data: doc } = await adminClient
      .from('documents')
      .select('file_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (doc?.file_url) {
      const path = doc.file_url.split('/documents/')[1]
      if (path) await adminClient.storage.from('documents').remove([path])
    }

    const { error } = await adminClient
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete API error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
