import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Splits text into segments around search term matches.
 * Returns an array of { text, isMatch } objects for rendering highlights.
 * Escapes regex special characters in the query for safe matching.
 */
export function highlightMatches(
  text: string,
  query: string
): { text: string; isMatch: boolean }[] {
  if (!query.trim()) return [{ text, isMatch: false }]

  // Escape regex special chars, then split on whitespace for multi-word queries
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (words.length === 0) return [{ text, isMatch: false }]

  const pattern = new RegExp(`(${words.join('|')})`, 'gi')
  const parts = text.split(pattern)

  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      isMatch: pattern.test(part) && (pattern.lastIndex = 0, true),
    }))
    // Re-check with a fresh test since lastIndex moves
    .map((part) => ({
      text: part.text,
      isMatch: words.some((w) => new RegExp(`^${w}$`, 'i').test(part.text)),
    }))
}
