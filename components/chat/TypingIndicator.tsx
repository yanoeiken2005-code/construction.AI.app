import { HardHat } from 'lucide-react'

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 message-enter">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
        <HardHat className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-slate-100 shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        <span className="w-2 h-2 bg-blue-400 rounded-full dot-1" />
        <span className="w-2 h-2 bg-blue-400 rounded-full dot-2" />
        <span className="w-2 h-2 bg-blue-400 rounded-full dot-3" />
      </div>
    </div>
  )
}
