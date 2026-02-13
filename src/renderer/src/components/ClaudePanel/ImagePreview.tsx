interface ImagePreviewProps {
  images: { dataUrl: string; name: string }[]
  onRemove: (index: number) => void
}

export default function ImagePreview({ images, onRemove }: ImagePreviewProps) {
  if (images.length === 0) return null

  return (
    <div className="flex gap-2 px-2 py-1.5 overflow-x-auto bg-gray-50 border-t border-gray-200">
      {images.map((img, idx) => (
        <div key={idx} className="relative flex-shrink-0 group">
          <img
            src={img.dataUrl}
            alt={img.name}
            className="h-16 w-auto rounded border border-gray-300 object-cover"
          />
          <button
            onClick={() => onRemove(idx)}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
