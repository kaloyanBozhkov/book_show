import { prisma } from "../prisma";
import { parsePageNumbers } from "../../helpers/pageParser";
import { BookIndexEntry } from "../../epub/types";

/**
 * Creates or finds a chapter in the database
 */
export async function createOrFindChapter(
  bookId: string,
  chapterEntry: BookIndexEntry,
  content: string
) {
  // Parse page numbers from chapter content
  const pageRange = parsePageNumbers(content);
  
  // Try to find existing chapter
  let chapter = await prisma.chapter.findFirst({
    where: {
      book_id: bookId,
      title: chapterEntry.title,
    },
  });

  // Create new chapter if not found
  if (!chapter) {
    chapter = await prisma.chapter.create({
      data: {
        title: chapterEntry.title,
        chapter_number: parseInt(chapterEntry.id.replace(/\D/g, "")) || 1,
        content: content,
        page_start: pageRange.pageStart,
        page_end: pageRange.pageEnd,
        book_id: bookId,
      },
    });
    console.log(`📄 Created new chapter: ${chapter.title}`);
    if (pageRange.pageStart && pageRange.pageEnd) {
      console.log(`📖 Chapter spans pages ${pageRange.pageStart} to ${pageRange.pageEnd}`);
    } else {
      console.log(`⚠️ No page numbers found in chapter content`);
    }
  } else {
    console.log(`📄 Found existing chapter: ${chapter.title}`);
    // Update page numbers if they weren't set before
    if (!chapter.page_start && !chapter.page_end && (pageRange.pageStart || pageRange.pageEnd)) {
      chapter = await prisma.chapter.update({
        where: { id: chapter.id },
        data: {
          page_start: pageRange.pageStart,
          page_end: pageRange.pageEnd,
        },
      });
      console.log(`📖 Updated page numbers: ${pageRange.pageStart} to ${pageRange.pageEnd}`);
    }
  }

  return chapter;
}
