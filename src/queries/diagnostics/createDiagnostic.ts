import { prisma } from "../prisma";
import { ChapterDiagnosticData } from "./types";

/**
 * Creates a new chapter parsing diagnostic record
 * @param data - Diagnostic data for the chapter
 * @returns Promise<ChapterDiagnostic> - The created diagnostic record
 */
export async function createChapterDiagnostic(data: ChapterDiagnosticData) {
  return await prisma.chapter_parsing_diagnostic.create({
    data: {
      chapter_id: data.chapterId,
      chapter_title: data.chapterTitle,
      chapter_parsing_status: data.chapterParsingStatus,
      facts_extraction_status: data.factsExtractionStatus,
      fact_page_numbers_status: data.factPageNumbersStatus,
      error_message: data.errorMessage || null,
      facts_count: data.factsCount,
      facts_with_page_numbers: data.factsWithPageNumbers,
    },
  });
}

/**
 * Creates a diagnostic record with default TODO statuses
 * @param chapterId - ID of the chapter
 * @param chapterTitle - Title of the chapter
 * @returns Promise<ChapterDiagnostic> - The created diagnostic record
 */
export async function createInitialDiagnostic(chapterId: string, chapterTitle: string) {
  return await createChapterDiagnostic({
    chapterId,
    chapterTitle,
    chapterParsingStatus: 'TODO',
    factsExtractionStatus: 'TODO',
    factPageNumbersStatus: 'TODO',
    factsCount: 0,
    factsWithPageNumbers: 0,
  });
}
