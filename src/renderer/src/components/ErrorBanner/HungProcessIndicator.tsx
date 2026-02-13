interface HungProcessIndicatorProps {
  onCancel: () => void
}

export default function HungProcessIndicator({ onCancel }: HungProcessIndicatorProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-yellow-50 border-t border-yellow-300 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-yellow-700">Still working... This is taking longer than usual.</span>
      </div>
      <button
        onClick={onCancel}
        className="px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
