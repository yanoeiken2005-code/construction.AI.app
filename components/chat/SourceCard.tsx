import { DocumentSource } from '@/types'
import { formatDate, getFileIcon } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

export default function SourceCard({ source }: { source: DocumentSource }) {
  return (
    <a
      href={source.file_url || '#'}
      target={source.file_url ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors group cursor-pointer"
    >
      <span className="text-xl shrink-0">{getFileIcon()}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-700">
          {source.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {source.project_name && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {source.project_name}
            </span>
          )}
          {source.document_date && (
            <span className="text-xs text-slate-400">{formatDate(source.document_date)}</span>
          )}
          {source.category && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {source.category}
            </span>
          )}
        </div>
      </div>
      {source.file_url && (
        <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0 mt-0.5" />
      )}
    </a>
  )
}
