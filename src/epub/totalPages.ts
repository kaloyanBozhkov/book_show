import { extractChapterContent } from "./content";
import { parsePageNumbers } from "../helpers/pageParser";
import { BookIndex, BookIndexEntry } from "./types";

/**
 * Gets the total number of pages in a book by analyzing the last chapter
 * @param epub - The parsed EPub instance
 * @param bookIndex - The book index containing chapter information
 * @returns Promise<number | null> - Total pages or null if could not determine
 */
export async function getTotalPagesFromLastChapter(
  epub: any,
  bookIndex: BookIndex
): Promise<number | null> {
  try {
    if (!bookIndex.entries || bookIndex.entries.length === 0) {
      console.log("⚠️ No chapters found in book index");
      return null;
    }

    // Get the last chapter
    const lastChapter = bookIndex.entries[bookIndex.entries.length - 1];
    console.log(`🔍 Analyzing last chapter for total pages: ${lastChapter.title}`);

    // Extract content from the last chapter
    const chapterContent = await extractChapterContent(epub, lastChapter.href);
    
    if (!chapterContent) {
      console.log("⚠️ Could not extract content from last chapter");
      return null;
    }

    // Parse page numbers from the last chapter
    const pageRange = parsePageNumbers(chapterContent);
    
    if (pageRange.pageEnd) {
      console.log(`📖 Total pages determined from last chapter: ${pageRange.pageEnd}`);
      return pageRange.pageEnd;
    } else {
      console.log("⚠️ No page numbers found in last chapter");
      return null;
    }
  } catch (error) {
    console.error("❌ Error getting total pages from last chapter:", error);
    return null;
  }
}

/**
 * Alternative method that tries multiple chapters to find the highest page number
 * @param epub - The parsed EPub instance
 * @param bookIndex - The book index containing chapter information
 * @returns Promise<number | null> - Total pages or null if could not determine
 */
export async function getTotalPagesFromAllChapters(
  epub: any,
  bookIndex: BookIndex
): Promise<number | null> {
  try {
    if (!bookIndex.entries || bookIndex.entries.length === 0) {
      console.log("⚠️ No chapters found in book index");
      return null;
    }

    let maxPageNumber = 0;
    let chaptersAnalyzed = 0;

    // Analyze the last few chapters to find the highest page number
    const chaptersToCheck = Math.min(3, bookIndex.entries.length); // Check last 3 chapters
    const startIndex = Math.max(0, bookIndex.entries.length - chaptersToCheck);

    for (let i = startIndex; i < bookIndex.entries.length; i++) {
      const chapter = bookIndex.entries[i];
      console.log(`🔍 Analyzing chapter ${i + 1}/${bookIndex.entries.length}: ${chapter.title}`);

      try {
        const chapterContent = await extractChapterContent(epub, chapter.href);
        if (chapterContent) {
          const pageRange = parsePageNumbers(chapterContent);
          if (pageRange.pageEnd && pageRange.pageEnd > maxPageNumber) {
            maxPageNumber = pageRange.pageEnd;
          }
          chaptersAnalyzed++;
        }
      } catch (error) {
        console.log(`⚠️ Could not analyze chapter ${chapter.title}: ${error}`);
      }
    }

    if (maxPageNumber > 0) {
      console.log(`📖 Total pages determined from ${chaptersAnalyzed} chapters: ${maxPageNumber}`);
      return maxPageNumber;
    } else {
      console.log("⚠️ No page numbers found in any analyzed chapters");
      return null;
    }
  } catch (error) {
    console.error("❌ Error getting total pages from chapters:", error);
    return null;
  }
}
