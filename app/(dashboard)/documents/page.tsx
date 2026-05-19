'use client'

import { useEffect, useState } from 'react'
import { Document } from '@/types'
import { formatDate, getFileIcon } from '@/lib/utils'
import { Trash2, Search, FileText, Loader2 } from 'lucide-react'

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchDocuments() {
    setLoading(true)
    try {
      const res = await fetch('/api/documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocuments() }, [])

  async function deleteDocument(id: string) {
    if (!confirm('このドキュメントを削除しますか？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (res.ok) setDocuments((prev) => prev.filter((d) => d.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = documents.filter((d) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      d.name.toLowerCase().includes(q) ||
      (d.project_name || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <h1 className="font-bold text-slate-800 text-lg">ドキュメント一覧</h1>
        <p className="text-xs text-slate-400 mt-0.5">登録済みの書類・資料を管理します</p>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 max-w-3xl mx-auto w-full space-y-4">
        {/* 検索バー */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ファイル名・工事名・カテゴリで絞り込み..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* ドキュメントリスト */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-600">
                {searchQuery ? '該当する書類がありません' : 'まだ書類がありません'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {!searchQuery && 'ファイル追加からアップロードしてください'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">{filtered.length}件</p>
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors"
              >
                <span className="text-2xl shrink-0">{getFileIcon(doc.file_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {doc.project_name && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {doc.project_name}
                      </span>
                    )}
                    {doc.category && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {doc.category}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  disabled={deletingId === doc.id}
                  className="text-slate-300 hover:text-red-500 transition-colors shrink-0 p-1"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
