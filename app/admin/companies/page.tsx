'use client'

import { useEffect, useState } from 'react'
import { Loader2, Building2 } from 'lucide-react'
import type { Company } from '@/types'
import { PLAN_LABELS } from '@/types'

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/companies')
        if (res.ok) {
          const data = await res.json()
          setCompanies(data.companies ?? [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="hidden md:block px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <h1 className="font-bold text-slate-800 text-lg">会社一覧</h1>
        <p className="text-xs text-slate-400 mt-0.5">契約プランとユーザー数を確認できます</p>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 max-w-3xl mx-auto w-full space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">会社が登録されていません</p>
        ) : (
          <>
            <p className="text-xs text-slate-400 font-medium">{companies.length}社</p>
            {companies.map((c) => (
              <div
                key={c.company_name}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{c.company_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.user_count} ユーザー</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${
                  c.plan === 'standard'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {PLAN_LABELS[c.plan]}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
