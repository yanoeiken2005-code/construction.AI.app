'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, Mail, Trash2, UserPlus, Search,
  Building2, Plus, Users as UsersIcon, MessageSquare, Calendar,
} from 'lucide-react'
import type { AppUser, Company, UserPlan } from '@/types'
import { PLAN_LABELS, PLAN_LIMITS } from '@/types'

type Tab = 'invite' | 'users' | 'companies'

function formatLastSignIn(iso?: string | null): string {
  if (!iso) return '未ログイン'
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  })
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('invite')
  const [users, setUsers] = useState<AppUser[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [flash, setFlash] = useState<{ type: 'ok' | 'ng'; msg: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // --- 招待フォーム state ---
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('existing')
  const [inviteCompanyId, setInviteCompanyId] = useState('')
  const [inviteNewCompanyName, setInviteNewCompanyName] = useState('')
  const [inviteNewCompanyPlan, setInviteNewCompanyPlan] = useState<UserPlan>('small')
  const [inviting, setInviting] = useState(false)

  // --- ユーザー一覧の絞り込み ---
  const [userQuery, setUserQuery] = useState('')

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

  // ============================================
  // 招待: 新規会社作成 → ユーザー招待 を一連で
  // ============================================
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || inviting) return

    setInviting(true)
    try {
      let companyId = inviteCompanyId

      if (inviteMode === 'new') {
        if (!inviteNewCompanyName.trim()) {
          setFlash({ type: 'ng', msg: '会社名を入力してください' })
          return
        }
        const res = await fetch('/api/admin/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: inviteNewCompanyName.trim(), plan: inviteNewCompanyPlan }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setFlash({ type: 'ng', msg: data.error || '会社作成に失敗しました' })
          return
        }
        companyId = data.company.id
      }

      if (!companyId) {
        setFlash({ type: 'ng', msg: '所属会社を選択または新規作成してください' })
        return
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), company_id: companyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || '招待に失敗しました' })
      } else {
        setFlash({ type: 'ok', msg: `${inviteEmail} に招待メールを送信しました` })
        setInviteEmail('')
        setInviteCompanyId('')
        setInviteNewCompanyName('')
        setInviteNewCompanyPlan('small')
        setInviteMode('existing')
        fetchAll()
      }
    } finally {
      setInviting(false)
    }
  }

  // ============================================
  // ユーザー操作
  // ============================================
  async function handleDeleteUser(u: AppUser) {
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

  async function handleUserCompanyChange(u: AppUser, companyId: string) {
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

  // ユーザー一覧から「プラン変更」する場合は、所属会社のプランを変更する
  async function handleUserPlanChange(u: AppUser, plan: UserPlan) {
    if (!u.company_id || plan === u.company_plan) return
    if (!confirm(`${u.company_name ?? '所属会社'} のプランを「${PLAN_LABELS[plan]}」に変更します。\n（同じ会社の他のユーザーにも影響します）`)) return
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/companies/${u.company_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || 'プラン変更に失敗しました' })
      } else {
        // 同じ会社のユーザー全員のプラン表示を更新
        setUsers((prev) => prev.map((x) =>
          x.company_id === u.company_id ? { ...x, company_plan: plan } : x
        ))
        setCompanies((prev) => prev.map((c) =>
          c.id === u.company_id ? { ...c, plan } : c
        ))
        setFlash({ type: 'ok', msg: `プランを${PLAN_LABELS[plan]}に変更しました` })
      }
    } finally {
      setBusyId(null)
    }
  }

  // ============================================
  // 会社操作
  // ============================================
  async function handleCompanyPlanChange(c: Company, plan: UserPlan) {
    if (plan === c.plan) return
    setBusyId(c.id)
    try {
      const res = await fetch(`/api/admin/companies/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || 'プラン変更に失敗しました' })
      } else {
        setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, plan } : x))
        setUsers((prev) => prev.map((u) =>
          u.company_id === c.id ? { ...u, company_plan: plan } : u
        ))
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleCompanyDelete(c: Company) {
    if (!confirm(`${c.name} を削除しますか？\n（所属ユーザーは未割当になります）`)) return
    setBusyId(c.id)
    try {
      const res = await fetch(`/api/admin/companies/${c.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || '削除に失敗しました' })
      } else {
        setFlash({ type: 'ok', msg: `${c.name} を削除しました` })
        setCompanies((prev) => prev.filter((x) => x.id !== c.id))
        setUsers((prev) => prev.map((u) =>
          u.company_id === c.id ? { ...u, company_id: null, company_name: null, company_plan: null } : u
        ))
      }
    } finally {
      setBusyId(null)
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!userQuery) return true
    const q = userQuery.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.company_name ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="hidden md:block px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <h1 className="font-bold text-slate-800 text-lg">管理画面</h1>
        <p className="text-xs text-slate-400 mt-0.5">ユーザー招待・会社管理・利用状況を管理します</p>
      </div>

      {/* タブ */}
      <div className="bg-white border-b border-slate-100 shrink-0 px-2 md:px-6 flex gap-1 overflow-x-auto">
        <TabButton active={tab === 'invite'} onClick={() => setTab('invite')} icon={<UserPlus className="w-4 h-4" />}>
          招待
        </TabButton>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<UsersIcon className="w-4 h-4" />}>
          ユーザー一覧 <span className="ml-1 text-xs text-slate-400">({users.length})</span>
        </TabButton>
        <TabButton active={tab === 'companies'} onClick={() => setTab('companies')} icon={<Building2 className="w-4 h-4" />}>
          会社一覧 <span className="ml-1 text-xs text-slate-400">({companies.length})</span>
        </TabButton>
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

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* ================== タブ: 招待 ================== */}
            {tab === 'invite' && (
              <form onSubmit={handleInvite} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">新しいユーザーを招待</p>
                  <p className="text-xs text-slate-400 mt-1">入力されたメールアドレスに招待リンクを送信します</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">メールアドレス</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 会社モード切り替え */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">所属会社</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setInviteMode('existing')}
                      className={`flex-1 text-xs py-2 rounded-lg border ${
                        inviteMode === 'existing'
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      既存の会社から選ぶ
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteMode('new')}
                      className={`flex-1 text-xs py-2 rounded-lg border ${
                        inviteMode === 'new'
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      新規に会社を登録
                    </button>
                  </div>

                  {inviteMode === 'existing' ? (
                    <select
                      required
                      value={inviteCompanyId}
                      onChange={(e) => setInviteCompanyId(e.target.value)}
                      disabled={companies.length === 0}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50"
                    >
                      <option value="">
                        {companies.length === 0 ? '会社が未登録です（「新規」を選択してください）' : '会社を選択...'}
                      </option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{PLAN_LABELS[c.plan]} / {c.user_count}/{PLAN_LIMITS[c.plan].maxUsers}名）
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">新しい会社名</label>
                        <input
                          type="text"
                          placeholder="例: ○○建設株式会社"
                          value={inviteNewCompanyName}
                          onChange={(e) => setInviteNewCompanyName(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">契約プラン</label>
                        <div className="flex gap-2">
                          {(['solo', 'small', 'standard'] as UserPlan[]).map((p) => (
                            <label key={p} className={`flex-1 text-xs text-center py-2 rounded-lg border cursor-pointer ${
                              inviteNewCompanyPlan === p
                                ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}>
                              <input
                                type="radio"
                                className="hidden"
                                checked={inviteNewCompanyPlan === p}
                                onChange={() => setInviteNewCompanyPlan(p)}
                              />
                              {PLAN_LABELS[p]}
                              <div className="text-[10px] text-slate-400 mt-0.5 font-normal">
                                {PLAN_LIMITS[p].maxUsers}名
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  招待メールを送信
                </button>
              </form>
            )}

            {/* ================== タブ: ユーザー一覧 ================== */}
            {tab === 'users' && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="メール・会社名で絞り込み..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {filteredUsers.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-12">
                    {userQuery ? '該当するユーザーがいません' : 'まだユーザーが登録されていません'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-medium">{filteredUsers.length}件</p>
                    {filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-700 truncate">{u.email}</p>
                              {u.role === 'admin' ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                  管理者
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                                  一般
                                </span>
                              )}
                              {u.company_plan && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                  {PLAN_LABELS[u.company_plan]}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {u.company_name ?? '会社未割当'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                最終ログイン: {formatLastSignIn(u.last_sign_in_at)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={busyId === u.id || u.role === 'admin'}
                            title={u.role === 'admin' ? '管理者は削除できません' : '削除'}
                            className="text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors p-1 shrink-0"
                          >
                            {busyId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* 操作行 */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-1">会社</label>
                            <select
                              value={u.company_id ?? ''}
                              onChange={(e) => handleUserCompanyChange(u, e.target.value)}
                              disabled={busyId === u.id}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">会社未割当</option>
                              {companies.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-1">プラン（会社単位）</label>
                            <select
                              value={u.company_plan ?? ''}
                              onChange={(e) => handleUserPlanChange(u, e.target.value as UserPlan)}
                              disabled={busyId === u.id || !u.company_id}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                            >
                              {!u.company_id && <option value="">会社未割当</option>}
                              <option value="solo">{PLAN_LABELS.solo}</option>
                              <option value="small">{PLAN_LABELS.small}</option>
                              <option value="standard">{PLAN_LABELS.standard}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ================== タブ: 会社一覧 ================== */}
            {tab === 'companies' && (
              <>
                {/* プラン早見表 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700 mb-1">プラン上限</p>
                  <p>• ソロ: {PLAN_LIMITS.solo.maxUsers}名 / 月{PLAN_LIMITS.solo.monthlyQuestions}回</p>
                  <p>• スモール: {PLAN_LIMITS.small.maxUsers}名 / 月{PLAN_LIMITS.small.monthlyQuestions}回</p>
                  <p>• スタンダード: {PLAN_LIMITS.standard.maxUsers}名 / 月{PLAN_LIMITS.standard.monthlyQuestions}回</p>
                </div>

                {companies.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-12">
                    会社がまだ登録されていません。「招待」タブから新規会社を登録できます
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-medium">{companies.length}社</p>
                    {companies.map((c) => {
                      const limits = PLAN_LIMITS[c.plan]
                      const userPct = Math.min(100, Math.round((c.user_count / limits.maxUsers) * 100))
                      const qPct = Math.min(100, Math.round((c.monthly_questions_used / limits.monthlyQuestions) * 100))
                      return (
                        <div
                          key={c.id}
                          className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{c.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> 作成日: {formatDate(c.created_at)}
                              </p>
                            </div>
                            <select
                              value={c.plan}
                              onChange={(e) => handleCompanyPlanChange(c, e.target.value as UserPlan)}
                              disabled={busyId === c.id}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="solo">{PLAN_LABELS.solo}</option>
                              <option value="small">{PLAN_LABELS.small}</option>
                              <option value="standard">{PLAN_LABELS.standard}</option>
                            </select>
                            <button
                              onClick={() => handleCompanyDelete(c)}
                              disabled={busyId === c.id}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1"
                            >
                              {busyId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                <UsersIcon className="w-3 h-3" /> ユーザー
                              </div>
                              <p className="text-sm font-semibold text-slate-700">
                                {c.user_count} <span className="text-xs font-normal text-slate-400">/ {limits.maxUsers}</span>
                              </p>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                <div className={`h-1.5 rounded-full ${userPct >= 100 ? 'bg-red-500' : userPct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${userPct}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                <MessageSquare className="w-3 h-3" /> 今月のAI質問
                              </div>
                              <p className="text-sm font-semibold text-slate-700">
                                {c.monthly_questions_used} <span className="text-xs font-normal text-slate-400">/ {limits.monthlyQuestions}</span>
                              </p>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                <div className={`h-1.5 rounded-full ${qPct >= 100 ? 'bg-red-500' : qPct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${qPct}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active, onClick, icon, children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
