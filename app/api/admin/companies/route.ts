import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin, startOfCurrentMonthIso } from '@/lib/admin'
import type { Company, UserPlan } from '@/types'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const adminClient = await createAdminClient()

    const [{ data: companies, error: cErr }, { data: users, error: uErr }, { data: msgs, error: mErr }] =
      await Promise.all([
        adminClient.from('companies').select('id, name, plan, created_at, updated_at').order('name'),
        adminClient.from('users').select('id, company_id'),
        adminClient
          .from('chat_messages')
          .select('user_id')
          .eq('role', 'user')
          .gte('created_at', startOfCurrentMonthIso()),
      ])

    if (cErr) throw cErr
    if (uErr) throw uErr
    if (mErr) throw mErr

    const userToCompany = new Map<string, string | null>(
      (users ?? []).map((u) => [u.id, u.company_id])
    )

    const userCount = new Map<string, number>()
    for (const u of users ?? []) {
      if (u.company_id) userCount.set(u.company_id, (userCount.get(u.company_id) ?? 0) + 1)
    }

    const qCount = new Map<string, number>()
    for (const m of msgs ?? []) {
      const cid = userToCompany.get(m.user_id)
      if (cid) qCount.set(cid, (qCount.get(cid) ?? 0) + 1)
    }

    const result: Company[] = (companies ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      plan: c.plan as UserPlan,
      user_count: userCount.get(c.id) ?? 0,
      monthly_questions_used: qCount.get(c.id) ?? 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }))

    return NextResponse.json({ companies: result })
  } catch (error) {
    console.error('Admin companies GET error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await req.json().catch(() => null) as { name?: string; plan?: UserPlan } | null
    const name = body?.name?.trim()
    if (!name) return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 })
    const plan: UserPlan = body?.plan === 'standard' ? 'standard' : 'small'

    const adminClient = await createAdminClient()
    const { data, error } = await adminClient
      .from('companies')
      .insert({ name, plan })
      .select('id, name, plan')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '同じ名前の会社が既に存在します' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ company: data })
  } catch (error) {
    console.error('Admin companies POST error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
