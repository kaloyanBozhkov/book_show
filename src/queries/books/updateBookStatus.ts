import { prisma } from "../prisma";

/**
 * Updates the status of a book
 * @param bookId - ID of the book
 * @param status - New status for the book
 * @returns Promise<Book> - The updated book record
 */
export async function updateBookStatus(bookId: string, status: 'PARSING' | 'PARSED' | 'PROCESSING_FACTS' | 'COMPLETED' | 'ERROR') {
  return await prisma.book.update({
    where: { id: bookId },
    data: { status },
  });
}

/**
 * Updates book status by file path (useful when we only have the file path)
 * @param filePath - File path of the book
 * @param status - New status for the book
 * @returns Promise<Book | null> - The updated book record or null if not found
 */
export async function updateBookStatusByFilePath(filePath: string, status: 'PARSING' | 'PARSED' | 'PROCESSING_FACTS' | 'COMPLETED' | 'ERROR') {
  const book = await prisma.book.findFirst({
    where: { file_path: filePath },
  });

  if (!book) {
    return null;
  }

  return await updateBookStatus(book.id, status);
}

/**
 * Sets book status to PROCESSING_FACTS when starting fact extraction
 * @param bookId - ID of the book
 */
export async function setBookProcessingFacts(bookId: string) {
  return await updateBookStatus(bookId, 'PROCESSING_FACTS');
}

/**
 * Sets book status to COMPLETED when all processing is done
 * @param bookId - ID of the book
 */
export async function setBookCompleted(bookId: string) {
  return await updateBookStatus(bookId, 'COMPLETED');
}

/**
 * Sets book status to ERROR when processing fails
 * @param bookId - ID of the book
 */
export async function setBookError(bookId: string) {
  return await updateBookStatus(bookId, 'ERROR');
}
