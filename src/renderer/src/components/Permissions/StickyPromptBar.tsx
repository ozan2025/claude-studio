import { useEffect, useRef, useState } from 'react'

interface StickyPromptBarProps {
  toolName: string
  visible: boolean
  onAccept: () => void
  onReject: () => void
  onScrollToCard: () => void
}

export default function StickyPromptBar({
  toolName,
  visible,
  onAccept,
  onReject,
  onScrollToCard,
}: StickyPromptBarProps) {
  if (!visible) return null

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-orange-50 border-t-2 border-orange-300 px-3 py-2 flex items-center justify-between z-10 shadow-lg">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-orange-700 font-medium">Waiting: {toolName}</span>
        <button
          onClick={onScrollToCard}
          className="text-orange-600 hover:text-orange-800 underline ml-1"
        >
          Scroll to card
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
        >
          Accept (Y)
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          Reject (N)
        </button>
      </div>
    </div>
  )
}

// Hook to detect if an element is visible in viewport
export function useIntersectionVisible(ref: React.RefObject<HTMLElement | null>): boolean {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 },
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return isVisible
}
