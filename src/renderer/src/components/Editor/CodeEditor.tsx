import { useMemo, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { getLanguageExtension } from './languageExtensions'

interface CodeEditorProps {
  content: string
  language: string
  filePath: string
  onChange: (value: string) => void
}

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: '#1a56db', fontWeight: 'bold', fontSize: '1.4em' },
  { tag: tags.heading2, color: '#1a56db', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading3, color: '#1a56db', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading, color: '#1a56db', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#6b21a8', fontStyle: 'italic' },
  { tag: tags.strong, color: '#9f1239', fontWeight: 'bold' },
  { tag: tags.link, color: '#0369a1', textDecoration: 'underline' },
  { tag: tags.url, color: '#0284c7' },
  { tag: tags.monospace, color: '#059669', backgroundColor: '#f0fdf4', borderRadius: '2px' },
  { tag: tags.quote, color: '#6b7280', fontStyle: 'italic' },
  { tag: tags.list, color: '#d97706' },
  { tag: tags.processingInstruction, color: '#9ca3af' },
])

const baseTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
  },
  '.cm-gutters': {
    backgroundColor: '#fafafa',
    borderRight: '1px solid #e5e7eb',
    color: '#9ca3af',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f3f4f6',
  },
  '.cm-activeLine': {
    backgroundColor: '#f8fafc',
  },
})

export default function CodeEditor({ content, language, onChange }: CodeEditorProps) {
  const extensions = useMemo(
    () => [
      baseTheme,
      EditorView.lineWrapping,
      ...(language === 'markdown' ? [syntaxHighlighting(markdownHighlight)] : []),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...getLanguageExtension(language),
    ],
    [language],
  )

  const handleChange = useCallback(
    (value: string) => {
      onChange(value)
    },
    [onChange],
  )

  return (
    <div className="h-full overflow-auto">
      <CodeMirror
        value={content}
        extensions={extensions}
        onChange={handleChange}
        height="100%"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          indentOnInput: true,
          tabSize: 2,
        }}
      />
    </div>
  )
}
