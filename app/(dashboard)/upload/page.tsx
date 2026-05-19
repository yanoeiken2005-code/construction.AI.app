'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react'
import { DOCUMENT_CATEGORIES } from '@/types'
import { formatFileSize, getFileIcon } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FileWithMeta {
  file: File
  projectName: string
  category: string
  documentDate: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMsg?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileWithMeta[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles: FileWithMeta[] = accepted.map((f) => ({
      file: f,
      projectName: '',
      category: 'その他',
      documentDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
    }))
    setFiles((prev) => [...prev, ...newFiles])
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
      'text/plain': ['.txt'],
    },
    maxSize: 20 * 1024 * 1024, // 20MB
  })

  function updateFile(index: number, updates: Partial<FileWithMeta>) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)))
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    const pending = files.filter((f) => f.status === 'pending')
    if (pending.length === 0) return

    setIsUploading(true)

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue

      updateFile(i, { status: 'uploading' })

      try {
        const formData = new FormData()
        formData.append('file', files[i].file)
        formData.append('projectName', files[i].projectName)
        formData.append('category', files[i].category)
        formData.append('documentDate', files[i].documentDate)

        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'アップロードに失敗しました')
        }
        updateFile(i, { status: 'done' })
      } catch (e) {
        updateFile(i, { status: 'error', errorMsg: (e as Error).message })
      }
    }

    setIsUploading(false)
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <h1 className="font-bold text-slate-800 text-lg">ファイル追加</h1>
        <p className="text-xs text-slate-400 mt-0.5">書類・写真・資料をアップロードしてナレッジに追加します</p>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 space-y-6 max-w-2xl mx-auto w-full">
        {/* ドロップゾーン */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Upload className="w-7 h-7 text-blue-600" />
            </div>
            {isDragActive ? (
              <p className="text-blue-600 font-semibold">ここにドロップしてください</p>
            ) : (
              <>
                <p className="font-semibold text-slate-700">
                  クリックまたはドラッグ&ドロップ
                </p>
                <p className="text-sm text-slate-400">
                  PDF、Excel、Word、画像（最大 20MB）
                </p>
              </>
            )}
          </div>
        </div>

        {/* ファイルリスト */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((item, index) => (
              <div
                key={index}
                className={cn(
                  'bg-white border rounded-2xl p-4 space-y-3 transition-colors',
                  item.status === 'done' ? 'border-green-200 bg-green-50' :
                  item.status === 'error' ? 'border-red-200 bg-red-50' :
                  'border-slate-200'
                )}
              >
                {/* ファイル情報 */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getFileIcon(item.file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.file.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(item.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {item.status === 'done' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {item.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* エラーメッセージ */}
                {item.status === 'error' && (
                  <p className="text-xs text-red-600">{item.errorMsg}</p>
                )}

                {/* メタデータ入力 */}
                {item.status === 'pending' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="工事名（例：○○橋梁補修工事）"
                        value={item.projectName}
                        onChange={(e) => updateFile(index, { projectName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <select
                      value={item.category}
                      onChange={(e) => updateFile(index, { category: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={item.documentDate}
                      onChange={(e) => updateFile(index, { documentDate: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-2"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* アップロードボタン */}
        {pendingCount > 0 && (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                アップロード中...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                {pendingCount}件をアップロード
              </>
            )}
          </button>
        )}

        {files.length > 0 && pendingCount === 0 && !isUploading && (
          <button
            onClick={() => setFiles([])}
            className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            クリア
          </button>
        )}
      </div>
    </div>
  )
}
