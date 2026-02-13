import { useState, useCallback } from 'react'

interface QuestionOption {
  label: string
  description: string
}

interface Question {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect: boolean
}

interface AskUserQuestionCardProps {
  questions: Question[]
  onSubmit: (answers: Record<string, string>) => void
}

export default function AskUserQuestionCard({ questions, onSubmit }: AskUserQuestionCardProps) {
  // Track selected answers per question index
  const [answers, setAnswers] = useState<Record<string, string>>({})
  // Track "Other" text per question index
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})
  // Track which questions have "Other" expanded
  const [showOther, setShowOther] = useState<Record<string, boolean>>({})

  const allAnswered = questions.every((_, i) => answers[String(i)]?.length > 0)

  const handleSingleSelect = useCallback(
    (qIdx: number, label: string) => {
      const key = String(qIdx)
      setAnswers((prev) => ({ ...prev, [key]: label }))
      // If only one question, submit immediately
      if (questions.length === 1) {
        onSubmit({ [key]: label })
      }
    },
    [questions.length, onSubmit],
  )

  const handleMultiToggle = useCallback((qIdx: number, label: string) => {
    const key = String(qIdx)
    setAnswers((prev) => {
      const current = prev[key] ?? ''
      const selected = current ? current.split(', ') : []
      const idx = selected.indexOf(label)
      if (idx >= 0) {
        selected.splice(idx, 1)
      } else {
        selected.push(label)
      }
      return { ...prev, [key]: selected.join(', ') }
    })
  }, [])

  const handleOtherSubmit = useCallback(
    (qIdx: number) => {
      const key = String(qIdx)
      const text = otherTexts[key]?.trim()
      if (!text) return
      setAnswers((prev) => ({ ...prev, [key]: text }))
      if (questions.length === 1) {
        onSubmit({ [key]: text })
      }
    },
    [otherTexts, questions.length, onSubmit],
  )

  const handleFinalSubmit = useCallback(() => {
    if (allAnswered) {
      onSubmit(answers)
    }
  }, [allAnswered, answers, onSubmit])

  return (
    <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-3 my-2">
      {questions.map((q, qIdx) => {
        const key = String(qIdx)
        const currentAnswer = answers[key] ?? ''
        const selectedSet = q.multiSelect
          ? new Set(currentAnswer ? currentAnswer.split(', ') : [])
          : null

        return (
          <div key={qIdx} className={qIdx > 0 ? 'mt-3 pt-3 border-t border-purple-200' : ''}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 bg-purple-200 rounded-full">
                {q.header}
              </span>
            </div>
            <div className="text-sm text-gray-700 mb-2 font-medium">{q.question}</div>

            <div className="space-y-1.5 mb-2">
              {q.options.map((opt) => {
                const isSelected = q.multiSelect
                  ? selectedSet!.has(opt.label)
                  : currentAnswer === opt.label

                return (
                  <button
                    key={opt.label}
                    onClick={() =>
                      q.multiSelect
                        ? handleMultiToggle(qIdx, opt.label)
                        : handleSingleSelect(qIdx, opt.label)
                    }
                    className={`w-full text-left px-3 py-2 text-xs border rounded-md transition-colors ${
                      isSelected
                        ? 'bg-purple-200 border-purple-400 ring-1 ring-purple-400'
                        : 'bg-white border-purple-200 hover:bg-purple-100 hover:border-purple-400'
                    }`}
                  >
                    {q.multiSelect && (
                      <span className="inline-block w-4 mr-1.5 text-center">
                        {isSelected ? '\u2611' : '\u2610'}
                      </span>
                    )}
                    <span className="font-medium text-gray-800">{opt.label}</span>
                    {opt.description && (
                      <span className="text-gray-500 ml-1">&mdash; {opt.description}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {!showOther[key] ? (
              <button
                onClick={() => setShowOther((prev) => ({ ...prev, [key]: true }))}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                Other...
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otherTexts[key] ?? ''}
                  onChange={(e) => setOtherTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleOtherSubmit(qIdx)}
                  placeholder="Type your response..."
                  className="flex-1 px-2 py-1 text-xs border border-purple-300 rounded focus:outline-none focus:border-purple-500"
                  autoFocus
                />
                <button
                  onClick={() => handleOtherSubmit(qIdx)}
                  disabled={!otherTexts[key]?.trim()}
                  className="px-2 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:bg-gray-300"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        )
      })}

      {questions.length > 1 && (
        <button
          onClick={handleFinalSubmit}
          disabled={!allAnswered}
          className="mt-3 w-full px-3 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:bg-gray-300 transition-colors"
        >
          Submit
        </button>
      )}
    </div>
  )
}
