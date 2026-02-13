import { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
}

export default function ResizeHandle({ onResize }: ResizeHandleProps) {
  const isDragging = useRef(false)
  const lastX = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      lastX.current = e.clientX

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return
        const delta = moveEvent.clientX - lastX.current
        lastX.current = moveEvent.clientX
        onResize(delta)
      }

      const onMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [onResize],
  )

  return (
    <div
      className="w-1 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors flex-shrink-0"
      onMouseDown={onMouseDown}
    />
  )
}
