import { useState, useCallback } from 'react'

interface Option {
  label: string
  description: string
}

interface MultipleChoiceCardProps {
  question: string
  options: Option[]
  onSelect: (value: string) => void
}

export default function MultipleChoiceCard({
  question,
  options,
  onSelect,
}: MultipleChoiceCardProps) {
  const [otherText, setOtherText] = useState('')
  const [showOther, setShowOther] = useState(false)

  const handleOtherSubmit = useCallback(() => {
    if (otherText.trim()) {
      onSelect(otherText.trim())
    }
  }, [otherText, onSelect])

  return (
    <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-3 my-2">
      <div className="text-sm text-gray-700 mb-2 font-medium">{question}</div>

      <div className="space-y-1.5 mb-2">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.label)}
            className="w-full text-left px-3 py-2 text-xs bg-white border border-purple-200 rounded-md hover:bg-purple-100 hover:border-purple-400 transition-colors"
          >
            <span className="font-medium text-gray-800">{opt.label}</span>
            {opt.description && <span className="text-gray-500 ml-1">— {opt.description}</span>}
          </button>
        ))}
      </div>

      {!showOther ? (
        <button
          onClick={() => setShowOther(true)}
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          Other...
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleOtherSubmit()}
            placeholder="Type your response..."
            className="flex-1 px-2 py-1 text-xs border border-purple-300 rounded focus:outline-none focus:border-purple-500"
            autoFocus
          />
          <button
            onClick={handleOtherSubmit}
            disabled={!otherText.trim()}
            className="px-2 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:bg-gray-300"
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}
