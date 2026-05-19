import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import type { UserPlan } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { id } = await ctx.params
    const body = await req.json().catch(() => null) as { name?: string; plan?: UserPlan } | null

    const update: Record<string, unknown> = {}
    if (typeof body?.name === 'string' && body.name.trim()) update.name = body.name.trim()
    if (body?.plan === 'solo' || body?.plan === 'small' || body?.plan === 'standard') update.plan = body.plan

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    const adminClient = await createAdminClient()
    const { error } = await adminClient.from('companies').update(update).eq('id', id)
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '同じ名前の会社が既に存在します' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin company PATCH error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { id } = await ctx.params
    const adminClient = await createAdminClient()

    const { count } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)

    if ((count ?? 0) > 0) {
      return NextResponse.json({
        error: 'この会社にはまだユーザーが所属しています。先にユーザーを削除するか別会社へ移してください。',
      }, { status: 400 })
    }

    const { error } = await adminClient.from('companies').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin company DELETE error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
