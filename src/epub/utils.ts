import { BookIndex, BookIndexEntry } from "./types";

/**
 * Formats the book index as a readable string
 * @param index - Book index to format
 * @returns string - Formatted index
 */
export function formatBookIndex(index: BookIndex): string {
  let output = `📚 Book: ${index.title}\n`;
  output += `✍️  Author: ${index.author}\n`;
  output += `🌍 Language: ${index.language}\n`;
  output += `🏢 Publisher: ${index.publisher}\n`;
  output += `📖 Total Chapters: ${index.totalChapters}\n`;

  if (index.description) {
    output += `📝 Description: ${index.description}\n`;
  }

  output += `\n📑 Table of Contents:\n`;
  output += formatIndexEntries(index.entries);
  return output;
}

/**
 * Recursively formats index entries with proper indentation
 * @param entries - Index entries to format
 * @returns string - Formatted entries
 */
function formatIndexEntries(entries: BookIndexEntry[]): string {
  return entries
    .map((entry, index) => {
      const indent = "  ".repeat(entry.level);
      const number = entry.level === 0 ? `${index + 1}. ` : "  • ";
      let line = `${indent}${number}${entry.title}`;

      if (entry.href) {
        line += ` (${entry.href})`;
      }

      if (entry.children && entry.children.length > 0) {
        line += "\n" + formatIndexEntries(entry.children);
      }

      return line;
    })
    .join("\n");
}

/**
 * Searches for entries in the book index
 * @param index - Book index to search
 * @param searchTerm - Term to search for
 * @returns BookIndexEntry[] - Matching entries
 */
export function searchInBookIndex(
  index: BookIndex,
  searchTerm: string
): BookIndexEntry[] {
  const results: BookIndexEntry[] = [];
  const term = searchTerm.toLowerCase();

  function searchRecursive(entryList: BookIndexEntry[]) {
    for (const entry of entryList) {
      if (entry.title.toLowerCase().includes(term)) {
        results.push(entry);
      }

      if (entry.children) {
        searchRecursive(entry.children);
      }
    }
  }

  searchRecursive(index.entries);
  return results;
}
