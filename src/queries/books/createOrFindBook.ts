import { prisma } from "../prisma";
import * as path from "path";

/**
 * Creates or finds a book in the database
 */
export async function createOrFindBook(bookData: any) {
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
      },
    });
    console.log(`📚 Created new book: ${book.title} (status: PARSING)`);
  } else {
    console.log(`📚 Found existing book: ${book.title} (status: ${book.status})`);
  }

  return book;
}
