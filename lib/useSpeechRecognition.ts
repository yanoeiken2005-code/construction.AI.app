'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((ev: { error: string }) => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type UseSpeechRecognitionResult = {
  isSupported: boolean
  isListening: boolean
  error: string | null
  start: () => void
  stop: () => void
}

export function useSpeechRecognition(opts: {
  lang?: string
  onTranscript: (text: string, isFinal: boolean) => void
}): UseSpeechRecognitionResult {
  const { lang = 'ja-JP', onTranscript } = opts
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTranscriptRef = useRef(onTranscript)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const isSupported = getSpeechRecognition() !== null

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('このブラウザは音声入力に対応していません')
      return
    }
    if (recognitionRef.current) return

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (ev) => {
      let interim = ''
      let finalText = ''
      for (let i = 0; i < ev.results.length; i++) {
        const result = ev.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += transcript
        else interim += transcript
      }
      if (finalText) onTranscriptRef.current(finalText, true)
      else if (interim) onTranscriptRef.current(interim, false)
    }

    recognition.onerror = (ev) => {
      const map: Record<string, string> = {
        'not-allowed': 'マイクの使用が許可されていません',
        'service-not-allowed': 'マイクの使用が許可されていません',
        'no-speech': '音声が検出されませんでした',
        'audio-capture': 'マイクが見つかりません',
        'network': 'ネットワークエラーが発生しました',
      }
      setError(map[ev.error] ?? `音声入力エラー: ${ev.error}`)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
      setError(null)
    } catch {
      setError('音声入力の開始に失敗しました')
    }
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  return { isSupported, isListening, error, start, stop }
}
