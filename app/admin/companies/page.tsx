'use client'

import { useEffect, useState } from 'react'
import { Loader2, Building2, Plus, Trash2, Users, MessageSquare } from 'lucide-react'
import type { Company, UserPlan } from '@/types'
import { PLAN_LABELS, PLAN_LIMITS } from '@/types'

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlan, setNewPlan] = useState<UserPlan>('small')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: 'ok' | 'ng'; msg: string } | null>(null)

  async function fetchCompanies() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/companies')
      if (res.ok) {
        const data = await res.json()
        setCompanies(data.companies ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompanies() }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(t)
  }, [flash])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), plan: newPlan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || '会社の追加に失敗しました' })
      } else {
        setFlash({ type: 'ok', msg: `${newName} を追加しました` })
        setNewName('')
        setNewPlan('small')
        setShowCreate(false)
        fetchCompanies()
      }
    } finally {
      setCreating(false)
    }
  }

  async function handlePlanChange(c: Company, plan: UserPlan) {
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
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(c: Company) {
    if (!confirm(`${c.name} を削除しますか？`)) return
    setBusyId(c.id)
    try {
      const res = await fetch(`/api/admin/companies/${c.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFlash({ type: 'ng', msg: data.error || '削除に失敗しました' })
      } else {
        setFlash({ type: 'ok', msg: `${c.name} を削除しました` })
        setCompanies((prev) => prev.filter((x) => x.id !== c.id))
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="hidden md:block px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <h1 className="font-bold text-slate-800 text-lg">会社一覧</h1>
        <p className="text-xs text-slate-400 mt-0.5">契約プランとユーザー数・AI質問回数を管理します</p>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 max-w-3xl mx-auto w-full space-y-3">
        {flash && (
          <div className={`text-sm rounded-xl px-4 py-3 ${
            flash.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {flash.msg}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl"
          >
            <Plus className="w-4 h-4" /> 会社を追加
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">新しい会社を追加</p>
            <input
              type="text"
              required
              placeholder="会社名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <label className={`flex-1 text-sm text-center py-2 rounded-lg border cursor-pointer ${newPlan === 'small' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                <input type="radio" className="hidden" checked={newPlan === 'small'} onChange={() => setNewPlan('small')} />
                スモール
              </label>
              <label className={`flex-1 text-sm text-center py-2 rounded-lg border cursor-pointer ${newPlan === 'standard' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                <input type="radio" className="hidden" checked={newPlan === 'standard'} onChange={() => setNewPlan('standard')} />
                スタンダード
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">キャンセル</button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}追加
              </button>
            </div>
          </form>
        )}

        {/* プラン早見表 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700 mb-1">プラン上限</p>
          <p>• スモール: {PLAN_LIMITS.small.maxUsers}名 / 月{PLAN_LIMITS.small.monthlyQuestions}回</p>
          <p>• スタンダード: {PLAN_LIMITS.standard.maxUsers}名 / 月{PLAN_LIMITS.standard.monthlyQuestions}回</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">会社がまだ登録されていません</p>
        ) : (
          <>
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{c.name}</p>
                    </div>
                    <select
                      value={c.plan}
                      onChange={(e) => handlePlanChange(c, e.target.value as UserPlan)}
                      disabled={busyId === c.id}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="small">{PLAN_LABELS.small}</option>
                      <option value="standard">{PLAN_LABELS.standard}</option>
                    </select>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={busyId === c.id}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    >
                      {busyId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <Users className="w-3 h-3" /> ユーザー
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
          </>
        )}
      </div>
    </div>
  )
}
