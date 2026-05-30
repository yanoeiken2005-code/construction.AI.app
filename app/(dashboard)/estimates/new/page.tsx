'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import {
  Calculator, Upload, X, ChevronLeft, Loader2, Info,
} from 'lucide-react'
import { ESTIMATE_WORK_TYPES, PREFECTURES, type EstimateWorkType } from '@/types'
import { formatFileSize, getFileIcon, cn } from '@/lib/utils'

export default function NewEstimatePage() {
  const router = useRouter()
  const [projectName, setProjectName] = useState('')
  const [prefecture, setPrefecture] = useState<string>('')
  const [workType, setWorkType] = useState<EstimateWorkType>('道路')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt', '.dxf'],
      'application/octet-stream': ['.dxf', '.dwg'],
    },
    maxSize: 30 * 1024 * 1024,
  })

  async function handleSubmit() {
    if (!projectName.trim()) {
      setError('工事名を入力してください')
      return
    }
    if (files.length === 0) {
      setError('設計図ファイルを1つ以上添付してください')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('projectName', projectName.trim())
      fd.append('prefecture', prefecture)
      fd.append('workType', workType)
      for (const f of files) fd.append('files', f)

      const res = await fetch('/api/estimates', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || '作成に失敗しました')
      }
      const data = await res.json()
      router.push(`/estimates/${data.estimate.id}?autoAnalyze=1`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0 flex items-center gap-3">
        <Link
          href="/estimates"
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-500"
          aria-label="戻る"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            新しい見積もり
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">設計図と工事名を入力して、AIに概算見積もりを依頼します</p>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 max-w-2xl mx-auto w-full space-y-6">
        {/* 工事名 */}
        <div>
          <label className="block text-base font-semibold text-slate-700 mb-2">
            工事名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="例：○○町道△△線 舗装改良工事"
            className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* 都道府県 + 工事区分 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">都道府県</label>
            <select
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">未選択</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">工事区分</label>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value as EstimateWorkType)}
              className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {ESTIMATE_WORK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ドロップゾーン */}
        <div>
          <label className="block text-base font-semibold text-slate-700 mb-2">
            設計図・資料 <span className="text-red-500">*</span>
          </label>
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-300 hover:border-emerald-300 hover:bg-emerald-50/50'
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <Upload className="w-7 h-7 text-emerald-600" />
              </div>
              {isDragActive ? (
                <p className="text-emerald-600 font-semibold">ここにドロップしてください</p>
              ) : (
                <>
                  <p className="font-semibold text-slate-700 text-base">
                    クリックまたはドラッグ&ドロップ
                  </p>
                  <p className="text-sm text-slate-400">
                    PDF / 画像 / Excel / Word / DXF / DWG（最大 30MB）<br />
                    複数まとめてOK
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ファイル一覧 */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                <span className="text-2xl">{getFileIcon(f.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(f.size)}</p>
                </div>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="削除"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 案内 */}
        <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">AIから最大5件まで質問が来ます</p>
            <p className="text-blue-700/80">
              設計図に書かれていない寸法や材料指定があれば、画面で聞き返します。
              わかる範囲で答えれば、すぐに見積もりが更新されます。
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold py-4 rounded-xl text-base shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              準備中...
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5" />
              AIに見積もりを依頼する
            </>
          )}
        </button>
      </div>
    </div>
  )
}
