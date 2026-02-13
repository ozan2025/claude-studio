import { StateField, StateEffect, type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

// Effect to set diff decorations
export const setDiffDecorations = StateEffect.define<DecorationSet>()

// Effect to clear diff decorations
export const clearDiffDecorations = StateEffect.define<void>()

const addedLineDecoration = Decoration.line({ class: 'cm-diff-added-line' })
const removedLineDecoration = Decoration.line({ class: 'cm-diff-removed-line' })

// StateField that holds the current diff decorations
const diffField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDiffDecorations)) {
        return effect.value
      }
      if (effect.is(clearDiffDecorations)) {
        return Decoration.none
      }
    }
    return decorations.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

export function diffExtension(): Extension {
  return [diffField]
}

// Create decorations from line numbers
export function createDiffDecorations(
  view: EditorView,
  addedLines: number[],
  removedLines: number[],
): DecorationSet {
  const decorations: { from: number; decoration: Decoration }[] = []
  const doc = view.state.doc

  for (const lineNum of addedLines) {
    if (lineNum <= doc.lines) {
      const line = doc.line(lineNum)
      decorations.push({ from: line.from, decoration: addedLineDecoration })
    }
  }

  for (const lineNum of removedLines) {
    if (lineNum <= doc.lines) {
      const line = doc.line(lineNum)
      decorations.push({ from: line.from, decoration: removedLineDecoration })
    }
  }

  decorations.sort((a, b) => a.from - b.from)
  return Decoration.set(decorations.map((d) => d.decoration.range(d.from)))
}
