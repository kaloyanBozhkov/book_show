import { prisma } from "../prisma";
import { DiagnosticUpdateData } from "./types";

/**
 * Updates an existing chapter parsing diagnostic record
 * @param chapterId - ID of the chapter
 * @param updates - Fields to update
 * @returns Promise<ChapterDiagnostic> - The updated diagnostic record
 */
export async function updateChapterDiagnostic(
  chapterId: string,
  updates: DiagnosticUpdateData
) {
  return await prisma.chapter_parsing_diagnostic.update({
    where: { chapter_id: chapterId },
    data: {
      ...(updates.chapterParsingStatus && { chapter_parsing_status: updates.chapterParsingStatus }),
      ...(updates.factsExtractionStatus && { facts_extraction_status: updates.factsExtractionStatus }),
      ...(updates.factPageNumbersStatus && { fact_page_numbers_status: updates.factPageNumbersStatus }),
      ...(updates.errorMessage !== undefined && { error_message: updates.errorMessage }),
      ...(updates.factsCount !== undefined && { facts_count: updates.factsCount }),
      ...(updates.factsWithPageNumbers !== undefined && { facts_with_page_numbers: updates.factsWithPageNumbers }),
    },
  });
}

/**
 * Updates chapter parsing status
 * @param chapterId - ID of the chapter
 * @param status - New parsing status
 * @param errorMessage - Optional error message if status is FAILED
 */
export async function updateChapterParsingStatus(
  chapterId: string,
  status: 'SUCCESS' | 'FAILED',
  errorMessage?: string
) {
  return await updateChapterDiagnostic(chapterId, {
    chapterParsingStatus: status,
    errorMessage: errorMessage || undefined,
  });
}

/**
 * Updates facts extraction status
 * @param chapterId - ID of the chapter
 * @param status - New extraction status
 * @param factsCount - Number of facts extracted
 * @param errorMessage - Optional error message if status is FAILED
 */
export async function updateFactsExtractionStatus(
  chapterId: string,
  status: 'SUCCESS' | 'FAILED',
  factsCount: number = 0,
  errorMessage?: string
) {
  return await updateChapterDiagnostic(chapterId, {
    factsExtractionStatus: status,
    factsCount,
    errorMessage: errorMessage || undefined,
  });
}

/**
 * Updates fact page numbers status
 * @param chapterId - ID of the chapter
 * @param status - New page numbers status
 * @param factsWithPageNumbers - Number of facts with page numbers
 * @param errorMessage - Optional error message if status is FAILED
 */
export async function updateFactPageNumbersStatus(
  chapterId: string,
  status: 'SUCCESS' | 'FAILED',
  factsWithPageNumbers: number = 0,
  errorMessage?: string
) {
  return await updateChapterDiagnostic(chapterId, {
    factPageNumbersStatus: status,
    factsWithPageNumbers,
    errorMessage: errorMessage || undefined,
  });
}
