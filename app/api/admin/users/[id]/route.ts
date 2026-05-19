import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import type { UserPlan, UserRole } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { id } = await ctx.params
    const body = await req.json().catch(() => null) as {
      plan?: UserPlan
      role?: UserRole
      company_name?: string | null
    } | null

    const update: Record<string, unknown> = {}
    if (body?.plan === 'small' || body?.plan === 'standard') update.plan = body.plan
    if (body?.role === 'admin' || body?.role === 'user') update.role = body.role
    if (typeof body?.company_name === 'string') update.company_name = body.company_name.trim() || null
    else if (body?.company_name === null) update.company_name = null

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    const adminClient = await createAdminClient()
    const { error } = await adminClient.from('users').update(update).eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin user PATCH error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { id } = await ctx.params
    if (id === admin.id) {
      return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
    }

    const adminClient = await createAdminClient()
    const { error } = await adminClient.auth.admin.deleteUser(id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin user DELETE error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
