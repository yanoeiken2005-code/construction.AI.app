'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calculator, Plus, Loader2, FileCheck2, FilePen, FileSearch,
  AlertCircle, ChevronRight,
} from 'lucide-react'
import type { Estimate, EstimateStatus } from '@/types'
import { formatDate } from '@/lib/utils'

const STATUS_META: Record<EstimateStatus, { label: string; color: string; Icon: typeof FilePen }> = {
  draft: { label: '下書き', color: 'bg-slate-100 text-slate-600', Icon: FilePen },
  analyzing: { label: 'AI解析中', color: 'bg-blue-100 text-blue-700', Icon: Loader2 },
  pending_questions: { label: '質問あり', color: 'bg-amber-100 text-amber-700', Icon: AlertCircle },
  ready: { label: '完成', color: 'bg-emerald-100 text-emerald-700', Icon: FileCheck2 },
  archived: { label: '保管', color: 'bg-slate-100 text-slate-500', Icon: FileSearch },
}

export default function EstimatesListPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/estimates')
        if (!res.ok) throw new Error((await res.json()).error || '読み込みに失敗しました')
        const data = await res.json()
        setEstimates(data.estimates || [])
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            見積もり
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">設計図から土木工事の概算見積もりを作成します</p>
        </div>
        <Link
          href="/estimates/new"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-3 rounded-xl text-base shadow-sm transition-colors"
        >
          <Plus className="w-5 h-5" />
          新しい見積もり
        </Link>
      </div>

      {/* リスト */}
      <div className="flex-1 px-4 md:px-6 py-6 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
            {error}
          </div>
        ) : estimates.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {estimates.map((e) => {
              const meta = STATUS_META[e.status]
              const Icon = meta.Icon
              return (
                <Link
                  key={e.id}
                  href={`/estimates/${e.id}`}
                  className="block bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm rounded-2xl p-5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-800 text-base truncate">
                          {e.project_name}
                        </h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.color}`}>
                          <Icon className={`w-3 h-3 ${e.status === 'analyzing' ? 'animate-spin' : ''}`} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2">
                        {e.summary || '概要未生成'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                        <span>{e.prefecture ?? '地域未設定'}</span>
                        <span>·</span>
                        <span>{e.work_type}</span>
                        <span>·</span>
                        <span>{formatDate(e.updated_at)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-emerald-700">
                        {e.total_amount_tax_included
                          ? `¥${Math.round(e.total_amount_tax_included).toLocaleString()}`
                          : '—'}
                      </p>
                      <p className="text-xs text-slate-400">税込</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors mt-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-5">
        <Calculator className="w-10 h-10 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-700">まだ見積もりがありません</h2>
      <p className="text-slate-500 text-sm mt-2 max-w-md">
        右上の「新しい見積もり」ボタンから、<br />
        設計図をアップロードして概算見積もりを作成できます。
      </p>
      <Link
        href="/estimates/new"
        className="mt-6 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl text-base transition-colors"
      >
        <Plus className="w-5 h-5" />
        新しい見積もりを作る
      </Link>
    </div>
  )
}
