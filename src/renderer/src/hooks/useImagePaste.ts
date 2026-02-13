import { useState, useCallback } from 'react'

export interface PastedImage {
  dataUrl: string
  name: string
}

const MAX_WIDTH = 1920

export function useImagePaste() {
  const [images, setImages] = useState<PastedImage[]>([])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        const reader = new FileReader()
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string
          if (!dataUrl) return

          // Resize if needed
          resizeImage(dataUrl, MAX_WIDTH).then((resized) => {
            setImages((prev) => [...prev, { dataUrl: resized, name: `image_${Date.now()}.png` }])
          })
        }
        reader.readAsDataURL(file)
      }
    }
  }, [])

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearImages = useCallback(() => {
    setImages([])
  }, [])

  return { images, handlePaste, removeImage, clearImages }
}

function resizeImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width <= maxWidth) {
        resolve(dataUrl)
        return
      }

      const ratio = maxWidth / img.width
      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = img.height * ratio

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = dataUrl
  })
}
