interface HighlightedPathProps {
  path: string
  matches: number[]
}

export default function HighlightedPath({ path, matches }: HighlightedPathProps) {
  const matchSet = new Set(matches)

  return (
    <span className="font-mono text-xs">
      {path.split('').map((char, idx) => (
        <span key={idx} className={matchSet.has(idx) ? 'text-blue-600 font-bold' : 'text-gray-600'}>
          {char}
        </span>
      ))}
    </span>
  )
}
