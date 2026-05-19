import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import type { AppUser, UserPlan } from '@/types'
import { PLAN_LIMITS } from '@/types'

type JoinedRow = {
  id: string
  email: string
  role: 'admin' | 'user'
  company_id: string | null
  created_at: string
  updated_at: string
  companies: { name: string; plan: UserPlan } | { name: string; plan: UserPlan }[] | null
}

function flatten(row: JoinedRow): AppUser {
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    company_id: row.company_id,
    company_name: company?.name ?? null,
    company_plan: company?.plan ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const supabase = await createClient()
    const { data: profiles, error } = await supabase
      .from('users')
      .select('id, email, role, company_id, created_at, updated_at, companies(name, plan)')
      .order('created_at', { ascending: false })

    if (error) throw error

    const adminClient = await createAdminClient()
    const { data: authUsersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const signInMap = new Map<string, string | null>()
    for (const u of authUsersData?.users ?? []) {
      signInMap.set(u.id, u.last_sign_in_at ?? null)
    }

    const users: AppUser[] = (profiles ?? []).map((row) => {
      const flat = flatten(row as JoinedRow)
      return { ...flat, last_sign_in_at: signInMap.get(flat.id) ?? null }
    })

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
      company_id?: string
    } | null

    const email = body?.email?.trim()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'メールアドレスが正しくありません' }, { status: 400 })
    }
    const companyId = body?.company_id?.trim() || null
    if (!companyId) {
      return NextResponse.json({ error: '会社を選択してください' }, { status: 400 })
    }

    const adminClient = await createAdminClient()
    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id, name, plan')
      .eq('id', companyId)
      .maybeSingle()
    if (companyErr || !company) {
      return NextResponse.json({ error: '指定された会社が見つかりません' }, { status: 400 })
    }

    const { count: currentUserCount } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
    const limit = PLAN_LIMITS[company.plan as UserPlan].maxUsers
    if ((currentUserCount ?? 0) >= limit) {
      return NextResponse.json({
        error: `${company.name} はユーザー数上限（${limit}名）に達しています。プランを変更するか、既存ユーザーを削除してください。`,
      }, { status: 400 })
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { company_id: companyId, role: 'user' },
    })

    if (error) {
      return NextResponse.json({ error: `招待に失敗しました: ${error.message}` }, { status: 400 })
    }

    if (data.user) {
      await adminClient
        .from('users')
        .update({ company_id: companyId })
        .eq('id', data.user.id)
    }

    return NextResponse.json({ ok: true, user_id: data.user?.id })
  } catch (error) {
    console.error('Admin users POST error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
