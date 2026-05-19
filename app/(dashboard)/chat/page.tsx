'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types'
import MessageBubble from '@/components/chat/MessageBubble'
import TypingIndicator from '@/components/chat/TypingIndicator'
import { Send, Sparkles } from 'lucide-react'

const SUGGESTIONS = [
  '騒音クレームの過去の対応事例を教えて',
  '基礎工事でのトラブル対応方法は？',
  '○○工事の施工図はある？',
  '協力会社との過去のやり取りを確認したい',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function adjustTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || 'エラーが発生しました。もう一度お試しください。')
      }

      const data = await res.json()
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'エラーが発生しました。もう一度お試しください。'
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `申し訳ありません。${reason}`,
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <h1 className="font-bold text-slate-800 text-lg">AI 検索</h1>
        <p className="text-xs text-slate-400 mt-0.5">過去の書類・対応事例を自然な言葉で検索できます</p>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">
        {messages.length === 0 ? (
          /* ウェルカム画面 */
          <div className="flex flex-col items-center justify-center h-full gap-8 py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-700">何でも聞いてください</h2>
              <p className="text-slate-500 text-sm mt-2 max-w-sm">
                過去の対応事例、書類、クレーム履歴など<br />自然な言葉で検索できます
              </p>
            </div>

            <div className="w-full max-w-lg space-y-2">
              <p className="text-xs font-medium text-slate-400 text-center mb-3">よくある質問</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="shrink-0 px-4 md:px-6 py-4 bg-white border-t border-slate-100">
        <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:bg-white transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustTextarea() }}
            onKeyDown={handleKeyDown}
            placeholder="質問を入力（例：去年の騒音クレームの対応方法は？）"
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-slate-800 placeholder:text-slate-400 text-sm leading-relaxed"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-4 h-4 text-white disabled:text-slate-400" />
          </button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">
          Enter で送信 / Shift+Enter で改行
        </p>
      </div>
    </div>
  )
}
