import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectName = formData.get('projectName') as string || ''
    const category = formData.get('category') as string || 'その他'
    const documentDate = formData.get('documentDate') as string || new Date().toISOString().slice(0, 10)
    const isSharedRequested = formData.get('isShared') === 'true'

    if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })

    // isShared が要求されている場合、管理者のみ許可
    let isShared = false
    if (isSharedRequested) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { error: '全社共有ナレッジへの登録は管理者のみ可能です' },
          { status: 403 }
        )
      }
      isShared = true
    }

    // Supabase Storage にアップロード
    // 共有ナレッジは shared/ 配下に置く（storage RLS により全ユーザー参照可）
    const fileName = isShared
      ? `shared/${Date.now()}_${file.name}`
      : `${user.id}/${Date.now()}_${file.name}`
    const fileBuffer = await file.arrayBuffer()

    const adminClient = await createAdminClient()
    const { error: uploadError } = await adminClient.storage
      .from('documents')
      .upload(fileName, fileBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: 'ファイルのアップロードに失敗しました' }, { status: 500 })
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('documents')
      .getPublicUrl(fileName)

    // テキスト抽出（MVP: テキストファイルのみ、他はファイル名ベース）
    let content = `ファイル名: ${file.name}\nカテゴリ: ${category}\n工事名: ${projectName}`
    if (file.type === 'text/plain') {
      content += '\n\n' + await file.text()
    }

    // ベクトル埋め込み生成
    let embedding: number[] | null = null
    try {
      const embeddingText = [
        file.name, projectName, category,
        content,
      ].filter(Boolean).join(' ')
      embedding = await generateEmbedding(embeddingText)
    } catch (e) {
      console.warn('Embedding generation failed:', e)
    }

    // DB に保存
    const { data: doc, error: dbError } = await adminClient
      .from('documents')
      .insert({
        user_id: user.id,
        name: file.name,
        content,
        file_url: publicUrl,
        file_type: file.type,
        project_name: projectName || null,
        document_date: documentDate,
        category,
        embedding,
        is_shared: isShared,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'データベースへの保存に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ document: doc })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
