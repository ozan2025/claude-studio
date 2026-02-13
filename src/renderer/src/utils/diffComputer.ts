import { diffLines, type Change } from 'diff'

export interface LineDiff {
  type: 'added' | 'removed' | 'unchanged'
  value: string
  lineNumber: number
  oldLineNumber?: number
}

export function computeLineDiff(oldContent: string, newContent: string): LineDiff[] {
  const changes = diffLines(oldContent, newContent)
  const result: LineDiff[] = []
  let newLine = 1
  let oldLine = 1

  for (const change of changes) {
    const lines = change.value.split('\n')
    // Remove trailing empty string from split
    if (lines[lines.length - 1] === '') lines.pop()

    for (const line of lines) {
      if (change.added) {
        result.push({ type: 'added', value: line, lineNumber: newLine })
        newLine++
      } else if (change.removed) {
        result.push({ type: 'removed', value: line, lineNumber: oldLine, oldLineNumber: oldLine })
        oldLine++
      } else {
        result.push({ type: 'unchanged', value: line, lineNumber: newLine, oldLineNumber: oldLine })
        newLine++
        oldLine++
      }
    }
  }

  return result
}

export function getDiffStats(diffs: LineDiff[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const d of diffs) {
    if (d.type === 'added') added++
    if (d.type === 'removed') removed++
  }
  return { added, removed }
}
