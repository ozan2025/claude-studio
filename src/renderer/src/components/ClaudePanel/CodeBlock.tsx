import CopyButton from '../common/CopyButton'

interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <div className="my-2 rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 bg-gray-50 border-b border-gray-200">
        <span className="text-[10px] text-gray-500 font-mono">{language || 'code'}</span>
        <CopyButton text={code} />
      </div>
      <pre className="px-3 py-2 text-xs font-mono text-gray-800 bg-gray-50 overflow-x-auto whitespace-pre-wrap break-words">
        <code>{code}</code>
      </pre>
    </div>
  )
}
