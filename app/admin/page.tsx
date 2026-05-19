'use client'

import { useEffect, useState } from 'react'
import { Loader2, Mail, Trash2, UserPlus, Search } from 'lucide-react'
import type { AppUser, Company } from '@/types'
import { PLAN_LABELS } from '@/types'

function formatLastSignIn(iso?: string | null): string {
  if (!iso) return '未ログイン'
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCompany, setInviteCompany] = useState('')
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: 'ok' | 'ng'; msg: string } | null>(null)

  async function fetchAll() {
    setLoading(true)
    try {
      const [uRes, cRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/companies'),
      ])
      if (uRes.ok) setUsers((await uRes.json()).users ?? [])
      if (cRes.ok) setCompanies((await cRes.json()).companies ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(t)
  }, [flash])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteCompany || inviting) return
    setInviting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), company_id: inviteCompany }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || '招待に失敗しました' })
      } else {
        setFlash({ type: 'ok', msg: `${inviteEmail} に招待メールを送信しました` })
        setInviteEmail('')
        setInviteCompany('')
        setShowInvite(false)
        fetchAll()
      }
    } finally {
      setInviting(false)
    }
  }

  async function handleDelete(u: AppUser) {
    if (!confirm(`${u.email} を削除してアクセスを停止しますか？`)) return
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || '削除に失敗しました' })
      } else {
        setFlash({ type: 'ok', msg: `${u.email} を削除しました` })
        setUsers((prev) => prev.filter((x) => x.id !== u.id))
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleCompanyChange(u: AppUser, companyId: string) {
    if (companyId === u.company_id) return
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || '会社の変更に失敗しました' })
      } else {
        const company = companies.find((c) => c.id === companyId)
        setUsers((prev) => prev.map((x) => x.id === u.id ? {
          ...x,
          company_id: companyId || null,
          company_name: company?.name ?? null,
          company_plan: company?.plan ?? null,
        } : x))
      }
    } finally {
      setBusyId(null)
    }
  }

  const filtered = users.filter((u) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.company_name ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="hidden md:block px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <h1 className="font-bold text-slate-800 text-lg">ユーザー管理</h1>
        <p className="text-xs text-slate-400 mt-0.5">利用者の招待・削除・所属会社の変更を行います</p>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 max-w-5xl mx-auto w-full space-y-4">
        {flash && (
          <div className={`text-sm rounded-xl px-4 py-3 ${
            flash.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {flash.msg}
          </div>
        )}

        <div className="flex gap-2 items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="メール・会社名で絞り込み..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={() => setShowInvite((v) => !v)}
            disabled={companies.length === 0}
            title={companies.length === 0 ? '先に会社を登録してください' : '招待'}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl shrink-0"
          >
            <UserPlus className="w-4 h-4" /> 招待
          </button>
        </div>

        {showInvite && (
          <form onSubmit={handleInvite} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">新しい利用者を招待</p>
            <input
              type="email"
              required
              placeholder="メールアドレス"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              required
              value={inviteCompany}
              onChange={(e) => setInviteCompany(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">所属会社を選択...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{PLAN_LABELS[c.plan]}）
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >キャンセル</button>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim() || !inviteCompany}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                招待メール送信
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">
            {query ? '該当するユーザーがいません' : 'まだユーザーが登録されていません'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">{filtered.length}件</p>
            {filtered.map((u) => (
              <div
                key={u.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-700 truncate">{u.email}</p>
                    {u.role === 'admin' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">管理者</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
                    {u.company_plan && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                        {PLAN_LABELS[u.company_plan]}
                      </span>
                    )}
                    <span className="text-slate-400">
                      最終ログイン: {formatLastSignIn(u.last_sign_in_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={u.company_id ?? ''}
                    onChange={(e) => handleCompanyChange(u, e.target.value)}
                    disabled={busyId === u.id}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px]"
                  >
                    <option value="">会社未割当</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={busyId === u.id || u.role === 'admin'}
                    title={u.role === 'admin' ? '管理者は削除できません' : '削除'}
                    className="text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors p-1"
                  >
                    {busyId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
