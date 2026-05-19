import { ChatMessage } from '@/types'
import { HardHat, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import SourceCard from './SourceCard'

interface Props {
  message: ChatMessage
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3 message-enter', isUser && 'flex-row-reverse')}>
      {/* アバター */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1',
          isUser ? 'bg-slate-700' : 'bg-blue-600'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <HardHat className="w-4 h-4 text-white" />
        )}
      </div>

      <div className={cn('flex flex-col gap-2 max-w-[80%]', isUser && 'items-end')}>
        {/* メッセージ本文 */}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'bg-slate-800 text-white rounded-tr-sm'
              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
          )}
        >
          {message.content}
        </div>

        {/* 参照ソース */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs text-slate-400 font-medium px-1">参照した資料</p>
            <div className="space-y-1.5">
              {message.sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
