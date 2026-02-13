interface PlanApprovalCardProps {
  onExecuteAutoAccept: () => void
  onExecuteManual: () => void
  onExecuteClearContext: () => void
  onRevise: () => void
}

export default function PlanApprovalCard({
  onExecuteAutoAccept,
  onExecuteManual,
  onExecuteClearContext,
  onRevise,
}: PlanApprovalCardProps) {
  return (
    <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        <span className="text-purple-700 text-sm font-medium">Plan Ready</span>
      </div>

      <p className="text-xs text-gray-600 mb-3">
        Claude has finished planning. How would you like to proceed?
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onExecuteClearContext}
          className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          Execute (clear context)
        </button>
        <button
          onClick={onExecuteAutoAccept}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors"
        >
          Execute (auto-accept edits)
        </button>
        <button
          onClick={onExecuteManual}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors"
        >
          Execute (manual approval)
        </button>
        <button
          onClick={onRevise}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors"
        >
          Revise plan
        </button>
      </div>
    </div>
  )
}
