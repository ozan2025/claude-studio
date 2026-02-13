import { useState, useCallback, useRef, useEffect } from 'react'

interface FreeTextCardProps {
  question: string
  onSubmit: (text: string) => void
}

export default function FreeTextCard({ question, onSubmit }: FreeTextCardProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    if (text.trim()) {
      onSubmit(text.trim())
    }
  }, [text, onSubmit])

  return (
    <div className="rounded-lg border-2 border-indigo-300 bg-indigo-50 p-3 my-2">
      <div className="text-sm text-gray-700 mb-2">{question}</div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Type your response..."
          className="flex-1 px-3 py-1.5 text-xs border border-indigo-300 rounded-md focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:bg-gray-300 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
