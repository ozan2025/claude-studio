import type { Extension } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { sql } from '@codemirror/lang-sql'
import { php } from '@codemirror/lang-php'

export function getLanguageExtension(lang: string): Extension[] {
  switch (lang) {
    case 'typescript':
      return [javascript({ typescript: true, jsx: true })]
    case 'javascript':
      return [javascript({ jsx: true })]
    case 'json':
      return [json()]
    case 'markdown':
      return [markdown()]
    case 'python':
      return [python()]
    case 'rust':
      return [rust()]
    case 'css':
      return [css()]
    case 'html':
      return [html()]
    case 'xml':
      return [xml()]
    case 'yaml':
      return [yaml()]
    case 'java':
      return [java()]
    case 'cpp':
      return [cpp()]
    case 'go':
      return [go()]
    case 'sql':
      return [sql()]
    case 'php':
      return [php()]
    default:
      return []
  }
}
