'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Calculator, ChevronLeft, Download, Loader2, Send, AlertCircle,
  FileCheck2, Sparkles, RefreshCw, FileText, Trash2,
} from 'lucide-react'
import type {
  Estimate, EstimateItem, EstimateMessage, EstimatePendingQuestion,
} from '@/types'
import { formatDate } from '@/lib/utils'

type DetailData = {
  estimate: Estimate
  items: EstimateItem[]
  messages: EstimateMessage[]
}

export default function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const autoAnalyze = searchParams.get('autoAnalyze') === '1'
  const router = useRouter()

  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoTriggeredRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/estimates/${id}`)
      if (!res.ok) throw new Error((await res.json()).error || '読み込みに失敗しました')
      const json = (await res.json()) as DetailData
      setData(json)
      const initial: Record<string, string> = {}
      for (const q of json.estimate.pending_questions || []) {
        initial[q.id] = (json.estimate.user_answers as Record<string, string>)?.[q.id] || ''
      }
      setAnswers(initial)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  const analyze = useCallback(async (extraAnswers?: Record<string, string>) => {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch(`/api/estimates/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAnswers: extraAnswers ?? answers }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error || 'AI解析に失敗しました')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI解析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }, [id, answers, load])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => {
    if (autoAnalyze && data && !autoTriggeredRef.current && data.estimate.status === 'analyzing') {
      autoTriggeredRef.current = true
      void analyze()
    }
  }, [autoAnalyze, data, analyze])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages.length, chatSending])

  async function submitAnswers() {
    const merged = { ...((data?.estimate.user_answers as Record<string, string>) || {}), ...answers }
    await analyze(merged)
  }

  async function sendChat() {
    if (!chatInput.trim() || chatSending) return
    const text = chatInput.trim()
    setChatInput('')
    setChatSending(true)

    // 楽観的UI
    const optimistic: EstimateMessage = {
      id: `tmp-${Date.now()}`,
      estimate_id: id,
      user_id: '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setData((prev) => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev)

    try {
      const res = await fetch(`/api/estimates/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error || 'チャットに失敗しました')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'チャットに失敗しました')
    } finally {
      setChatSending(false)
    }
  }

  async function handleDelete() {
    if (!confirm('この見積もりを削除します。よろしいですか？')) return
    try {
      const res = await fetch(`/api/estimates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      router.push('/estimates')
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-slate-500">{error || '見積もりが見つかりませんでした'}</p>
        <Link href="/estimates" className="text-emerald-600 underline">一覧へ戻る</Link>
      </div>
    )
  }

  const { estimate, items, messages } = data
  const pendingQuestions = (estimate.pending_questions as EstimatePendingQuestion[]) || []
  const showAnalyzingOverlay = analyzing || estimate.status === 'analyzing'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0 flex items-center gap-3">
        <Link href="/estimates" className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-500">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-800 text-lg truncate flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600 shrink-0" />
            {estimate.project_name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {estimate.prefecture ?? '地域未設定'} ・ {estimate.work_type} ・ {formatDate(estimate.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void analyze()}
            disabled={analyzing}
            className="hidden sm:flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            再解析
          </button>
          <a
            href={`/api/estimates/${id}/excel`}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel出力
          </a>
          <button
            onClick={handleDelete}
            className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            aria-label="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 max-w-5xl mx-auto w-full space-y-6">
        {showAnalyzingOverlay && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin shrink-0" />
            <div>
              <p className="font-bold text-blue-800">AIが設計図を読み取って見積もりを作成しています...</p>
              <p className="text-sm text-blue-700/80 mt-1">図面の量により1〜3分かかることがあります。</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* 概要 */}
        {estimate.summary && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <p className="font-semibold text-slate-700">工事概要（AIサマリ）</p>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">{estimate.summary}</p>
          </div>
        )}

        {/* 不明点質問 */}
        {pendingQuestions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <p className="font-bold text-amber-800">AIから {pendingQuestions.length}件の確認があります</p>
            </div>
            <p className="text-sm text-amber-700/80">
              わかる範囲で答えてください。空欄でも送信できます（「不明」と扱われます）。
            </p>
            <div className="space-y-3">
              {pendingQuestions.map((q, i) => (
                <div key={q.id} className="bg-white border border-amber-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800 text-sm mb-1">
                    {i + 1}. {q.question}
                  </p>
                  {q.hint && <p className="text-xs text-slate-500 mb-2">ヒント: {q.hint}</p>}
                  <input
                    type="text"
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="回答を入力（不明な場合は空欄でOK）"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={submitAnswers}
              disabled={analyzing}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold py-3 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <><Loader2 className="w-5 h-5 animate-spin" />更新中...</>
              ) : (
                <>回答して見積もりを更新</>
              )}
            </button>
          </div>
        )}

        {/* 金額サマリ */}
        {estimate.total_amount_tax_included !== null && (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-emerald-700 font-medium mb-1">直接工事費（税抜）</p>
                <p className="text-2xl font-bold text-emerald-800">
                  ¥{Math.round(estimate.total_amount ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-emerald-700 font-medium mb-1">合計（税込）</p>
                <p className="text-3xl font-bold text-emerald-700">
                  ¥{Math.round(estimate.total_amount_tax_included).toLocaleString()}
                </p>
              </div>
            </div>
            {estimate.ai_notes && (
              <p className="text-xs text-emerald-700/80 mt-4 border-t border-emerald-200 pt-3">
                ※ {estimate.ai_notes}
              </p>
            )}
          </div>
        )}

        {/* 明細 */}
        {items.length > 0 ? (
          <ItemsTable items={items} />
        ) : (
          !showAnalyzingOverlay && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">明細はまだ生成されていません</p>
              <button
                onClick={() => void analyze()}
                className="mt-4 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
              >
                <Sparkles className="w-4 h-4" />
                AIに解析を依頼
              </button>
            </div>
          )
        )}

        {/* 添付資料 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            添付された設計図・資料
          </p>
          <ul className="space-y-2 text-sm">
            {(estimate.drawing_files || []).map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-slate-600">
                <span className="text-base">📎</span>
                <span className="truncate">{f.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* チャット */}
        <div className="bg-white border border-slate-200 rounded-2xl">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <p className="font-semibold text-slate-700">AIに追加で質問する</p>
          </div>
          <div className="p-5 max-h-96 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-6">
                例：「擁壁部分だけの見積もりは？」「3ページ目の図面の合計は？」「単価の根拠を教えて」
              </div>
            ) : (
              messages.map((m) => (
                <ChatBubble key={m.id} message={m} />
              ))
            )}
            {chatSending && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                考えています...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void sendChat()
                  }
                }}
                rows={1}
                placeholder="質問を入力（例：擁壁部分の見積もりは？）"
                className="flex-1 bg-transparent resize-none outline-none text-slate-800 placeholder:text-slate-400 text-sm leading-relaxed py-1.5"
              />
              <button
                onClick={() => void sendChat()}
                disabled={!chatInput.trim() || chatSending}
                className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 rounded-xl flex items-center justify-center transition-colors shrink-0"
                aria-label="送信"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {estimate.status === 'ready' && (
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
            <FileCheck2 className="w-4 h-4" />
            この見積もりは完成しています
          </div>
        )}
      </div>
    </div>
  )
}

function ItemsTable({ items }: { items: EstimateItem[] }) {
  // セクションごとにまとめる
  const grouped = new Map<string, EstimateItem[]>()
  for (const it of items) {
    const key = it.section || 'その他'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(it)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <p className="font-semibold text-slate-700">見積もり明細</p>
        <p className="text-xs text-slate-400">{items.length} 項目</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">項目名</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">規格</th>
              <th className="text-right px-3 py-2 font-medium">数量</th>
              <th className="text-left px-2 py-2 font-medium">単位</th>
              <th className="text-right px-3 py-2 font-medium">単価</th>
              <th className="text-right px-3 py-2 font-medium">金額</th>
              <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">根拠</th>
              <th className="text-center px-2 py-2 font-medium">信頼度</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([section, rows]) => (
              <SectionRows key={section} section={section} rows={rows} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionRows({ section, rows }: { section: string; rows: EstimateItem[] }) {
  const sectionTotal = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  return (
    <>
      <tr className="bg-emerald-50/50 border-t border-emerald-100">
        <td colSpan={8} className="px-3 py-2 font-bold text-emerald-700 text-sm">{section}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
          <td className="px-3 py-2 font-medium text-slate-700">{r.name}</td>
          <td className="px-3 py-2 text-slate-500 hidden md:table-cell">{r.spec || '-'}</td>
          <td className="px-3 py-2 text-right text-slate-600">
            {r.quantity !== null ? r.quantity.toLocaleString() : '-'}
          </td>
          <td className="px-2 py-2 text-slate-500">{r.unit || '-'}</td>
          <td className="px-3 py-2 text-right text-slate-600">
            {r.unit_price !== null ? `¥${Math.round(r.unit_price).toLocaleString()}` : '-'}
          </td>
          <td className="px-3 py-2 text-right font-semibold text-slate-800">
            {r.amount !== null ? `¥${Math.round(r.amount).toLocaleString()}` : '-'}
          </td>
          <td className="px-3 py-2 text-xs text-slate-500 hidden lg:table-cell max-w-[18rem] truncate">
            {r.source || '-'}
          </td>
          <td className="px-2 py-2 text-center text-xs">
            <ConfidenceBadge level={r.confidence} />
          </td>
        </tr>
      ))}
      <tr className="border-t border-emerald-100 bg-emerald-50/30">
        <td colSpan={5} className="px-3 py-2 text-right text-xs font-medium text-emerald-700">
          {section} 小計
        </td>
        <td className="px-3 py-2 text-right font-bold text-emerald-800">
          ¥{Math.round(sectionTotal).toLocaleString()}
        </td>
        <td colSpan={2}></td>
      </tr>
    </>
  )
}

function ConfidenceBadge({ level }: { level: '高' | '中' | '低' }) {
  const color =
    level === '高' ? 'bg-emerald-100 text-emerald-700' :
    level === '低' ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded-full font-medium ${color}`}>{level}</span>
}

function ChatBubble({ message }: { message: EstimateMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
      }`}>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-300/30 text-xs">
            <p className="font-medium opacity-70 mb-1">参照資料</p>
            <ul className="space-y-0.5 opacity-80">
              {message.sources.map((s) => (
                <li key={s.id}>・{s.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
