import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/admin'
import type { EstimateDrawingFile, EstimateWorkType } from '@/types'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { data: estimates, error } = await supabase
      .from('estimates')
      .select('id, project_name, prefecture, work_type, status, total_amount, total_amount_tax_included, summary, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ estimates })
  } catch (error) {
    console.error('Estimates list error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const profile = await getCurrentUserProfile()
    const formData = await request.formData()
    const projectName = (formData.get('projectName') as string || '').trim()
    const prefecture = (formData.get('prefecture') as string || '').trim() || null
    const workType = ((formData.get('workType') as string) || '道路') as EstimateWorkType
    const files = formData.getAll('files') as File[]

    if (!projectName) {
      return NextResponse.json({ error: '工事名を入力してください' }, { status: 400 })
    }
    if (files.length === 0) {
      return NextResponse.json({ error: '設計図ファイルを1つ以上添付してください' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    // Storage にファイルをアップロード
    const drawingFiles: EstimateDrawingFile[] = []
    for (const f of files) {
      const safeName = f.name.replace(/[^\w.\-\u3000-\u9fff]+/g, '_')
      const path = `${user.id}/${Date.now()}_${safeName}`
      const buf = await f.arrayBuffer()
      const { error: upErr } = await adminClient.storage
        .from('estimates')
        .upload(path, buf, { contentType: f.type || 'application/octet-stream', upsert: false })
      if (upErr) {
        console.error('Upload error:', upErr)
        return NextResponse.json({ error: `${f.name} のアップロードに失敗しました` }, { status: 500 })
      }
      const { data: { publicUrl } } = adminClient.storage.from('estimates').getPublicUrl(path)
      drawingFiles.push({
        url: publicUrl,
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
      })
    }

    // 案件レコード作成
    const { data: estimate, error: insertErr } = await adminClient
      .from('estimates')
      .insert({
        user_id: user.id,
        company_id: profile?.company_id ?? null,
        project_name: projectName,
        prefecture,
        work_type: workType,
        status: 'analyzing',
        drawing_files: drawingFiles,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Estimate insert error:', insertErr)
      return NextResponse.json({ error: '案件の保存に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ estimate })
  } catch (error) {
    console.error('Estimates create error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
