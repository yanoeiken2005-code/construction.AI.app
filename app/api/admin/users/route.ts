import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import type { AppUser, UserPlan } from '@/types'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const supabase = await createClient()
    const { data: profiles, error } = await supabase
      .from('users')
      .select('id, email, company_name, role, plan, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // 最終ログイン時刻は auth.users.last_sign_in_at から取得 (admin API)
    const adminClient = await createAdminClient()
    const { data: authUsersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const signInMap = new Map<string, string | null>()
    for (const u of authUsersData?.users ?? []) {
      signInMap.set(u.id, u.last_sign_in_at ?? null)
    }

    const users: AppUser[] = (profiles ?? []).map((p) => ({
      ...(p as AppUser),
      last_sign_in_at: signInMap.get((p as AppUser).id) ?? null,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin users GET error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await req.json().catch(() => null) as {
      email?: string
      company_name?: string
      plan?: UserPlan
    } | null

    const email = body?.email?.trim()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'メールアドレスが正しくありません' }, { status: 400 })
    }

    const plan: UserPlan = body?.plan === 'standard' ? 'standard' : 'small'
    const companyName = body?.company_name?.trim() || null

    const adminClient = await createAdminClient()
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        company_name: companyName,
        plan,
        role: 'user',
      },
    })

    if (error) {
      return NextResponse.json({ error: `招待に失敗しました: ${error.message}` }, { status: 400 })
    }

    // public.users は handle_new_user トリガーで自動作成されるが、
    // 念のため company_name/plan を確実に反映
    if (data.user) {
      await adminClient
        .from('users')
        .update({ company_name: companyName, plan })
        .eq('id', data.user.id)
    }

    return NextResponse.json({ ok: true, user_id: data.user?.id })
  } catch (error) {
    console.error('Admin users POST error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
