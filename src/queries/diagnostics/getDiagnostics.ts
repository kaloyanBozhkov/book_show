import { prisma } from "../prisma";

/**
 * Gets diagnostic record for a specific chapter
 * @param chapterId - ID of the chapter
 * @returns Promise<ChapterDiagnostic | null> - The diagnostic record or null if not found
 */
export async function getChapterDiagnostic(chapterId: string) {
  return await prisma.chapter_parsing_diagnostic.findUnique({
    where: { chapter_id: chapterId },
  });
}

/**
 * Gets all diagnostic records for a book
 * @param bookId - ID of the book
 * @returns Promise<ChapterDiagnostic[]> - Array of diagnostic records
 */
export async function getBookDiagnostics(bookId: string) {
  return await prisma.chapter_parsing_diagnostic.findMany({
    where: {
      chapter: {
        book_id: bookId,
      },
    },
    include: {
      chapter: {
        select: {
          title: true,
          chapter_number: true,
        },
      },
    },
    orderBy: {
      chapter: {
        chapter_number: 'asc',
      },
    },
  });
}

/**
 * Gets diagnostic statistics for a book
 * @param bookId - ID of the book
 * @returns Promise<object> - Statistics object
 */
export async function getBookDiagnosticStats(bookId: string) {
  const diagnostics = await getBookDiagnostics(bookId);
  
  const stats = {
    totalChapters: diagnostics.length,
    chaptersParsed: diagnostics.filter(d => d.chapter_parsing_status === 'SUCCESS').length,
    factsExtracted: diagnostics.filter(d => d.facts_extraction_status === 'SUCCESS').length,
    pageNumbersAssigned: diagnostics.filter(d => d.fact_page_numbers_status === 'SUCCESS').length,
    totalFacts: diagnostics.reduce((sum, d) => sum + d.facts_count, 0),
    totalFactsWithPageNumbers: diagnostics.reduce((sum, d) => sum + d.facts_with_page_numbers, 0),
    failedChapters: diagnostics.filter(d => d.chapter_parsing_status === 'FAILED').length,
    failedFactsExtraction: diagnostics.filter(d => d.facts_extraction_status === 'FAILED').length,
    failedPageNumbers: diagnostics.filter(d => d.fact_page_numbers_status === 'FAILED').length,
  };

  return stats;
}
