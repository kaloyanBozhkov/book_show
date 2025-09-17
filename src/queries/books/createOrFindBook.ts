import { BookIndex } from "@/epub";
import { prisma } from "../prisma";
import * as path from "path";

/**
 * Creates or finds a book in the database
 */
export async function createOrFindBook(bookData: BookIndex, totalPages?: number | null) {
  const filePath = bookData.filePath!;

  // Try to find existing book
  let book = await prisma.book.findFirst({
    where: {
      OR: [{ file_path: filePath }, { title: bookData.title }],
    },
  });

  // Create new book if not found
  if (!book) {
    book = await prisma.book.create({
      data: {
        title: bookData.title || path.basename(filePath, ".epub"),
        author: bookData.author || null,
        file_path: filePath,
        status: "PARSING",
        total_pages: totalPages || 0,
      },
    });
    console.log(`📚 Created new book: ${book.title} (status: PARSING, pages: ${totalPages || 0})`);
  } else {
    // Update total_pages if we have new information and the current value is 0
    if (totalPages && totalPages > 0 && book.total_pages === 0) {
      book = await prisma.book.update({
        where: { id: book.id },
        data: { total_pages: totalPages },
      });
      console.log(`📚 Updated book total pages: ${book.title} (pages: ${totalPages})`);
    } else {
      console.log(
        `📚 Found existing book: ${book.title} (status: ${book.status}, pages: ${book.total_pages})`
      );
    }
  }

  return book;
}
