const TITLE_CASE_MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in",
  "nor", "of", "on", "or", "per", "so", "the", "to", "up", "vs", "yet",
]);

// UPC/product databases often return titles in all-lowercase (or otherwise
// uninitialized) text. Only strings that are currently all-lowercase get
// re-cased here — anything with existing capitalization (e.g. "The Matrix",
// "iPhone", "McDonald's") is left alone rather than risk mangling it.
export function toTitleCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed !== trimmed.toLowerCase()) return text;

  const words = trimmed.split(/\s+/);
  return words
    .map((word, index) => {
      const isEdge = index === 0 || index === words.length - 1;
      if (!isEdge && TITLE_CASE_MINOR_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
