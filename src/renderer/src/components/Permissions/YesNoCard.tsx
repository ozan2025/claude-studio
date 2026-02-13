interface YesNoCardProps {
  question: string
  onYes: () => void
  onNo: () => void
}

export default function YesNoCard({ question, onYes, onNo }: YesNoCardProps) {
  return (
    <div className="rounded-lg border-2 border-teal-300 bg-teal-50 p-3 my-2">
      <div className="text-sm text-gray-700 mb-2">{question}</div>

      <div className="flex gap-2">
        <button
          onClick={onYes}
          className="px-4 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
        >
          Yes (Y)
        </button>
        <button
          onClick={onNo}
          className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
        >
          No (N)
        </button>
      </div>
    </div>
  )
}
