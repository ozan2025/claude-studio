export interface FuzzyResult {
  path: string
  score: number
  matches: number[]
}

export function fuzzySearch(query: string, paths: string[]): FuzzyResult[] {
  if (!query) return paths.map((path) => ({ path, score: 0, matches: [] }))

  const lowerQuery = query.toLowerCase()
  const results: FuzzyResult[] = []

  for (const path of paths) {
    const result = fuzzyMatch(lowerQuery, path.toLowerCase(), path)
    if (result) {
      results.push(result)
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

function fuzzyMatch(query: string, lowerPath: string, originalPath: string): FuzzyResult | null {
  const matches: number[] = []
  let score = 0
  let qi = 0
  let lastMatchIdx = -1

  for (let pi = 0; pi < lowerPath.length && qi < query.length; pi++) {
    if (lowerPath[pi] === query[qi]) {
      matches.push(pi)

      // Consecutive match bonus
      if (lastMatchIdx === pi - 1) {
        score += 2
      }

      // Word boundary bonus (after /, -, _, .)
      if (pi === 0 || '/\\-_.'.includes(lowerPath[pi - 1])) {
        score += 3
      }

      // Filename start bonus
      const lastSlash = lowerPath.lastIndexOf('/')
      if (pi === lastSlash + 1) {
        score += 5
      }

      // Gap penalty
      if (lastMatchIdx >= 0) {
        const gap = pi - lastMatchIdx - 1
        score -= gap * 0.5
      }

      lastMatchIdx = pi
      qi++
    }
  }

  // All query chars must match
  if (qi !== query.length) return null

  // Shorter paths slightly preferred
  score -= originalPath.length * 0.01

  return { path: originalPath, score, matches }
}
