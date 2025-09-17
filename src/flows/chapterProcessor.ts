import { extractFactsFromChapter } from "../ai/extractFacts";
import { getChapterMemory } from "../ai/memory";
import { extractFactPageNumbers } from "../ai/extractFactPageNumbers";
import { updateFactPageNumbersForChapter } from "../queries/facts/updateFactPageNumbers";
import { prisma } from "../queries/prisma";
import { parsePageNumbers } from "../helpers/pageParser";
import { EPUBParseResult } from "../epub/types";
import { BookIndexEntry } from "../epub/types";
import { extractChapterContent } from "../epub/content";
import { 
  createInitialDiagnostic, 
  updateChapterParsingStatus, 
  updateFactsExtractionStatus, 
  updateFactPageNumbersStatus 
} from "../queries/diagnostics";
import * as path from "path";

/**
 * Processes a single chapter: extracts content, extracts facts, and stores them in the database
 * @param epubResult - The parsed EPUB result containing book data
 * @param chapterEntry - Chapter entry from the book index
 * @returns Promise<boolean> - Success status
 */
export async function processChapter(
  epubResult: EPUBParseResult,
  chapterEntry: BookIndexEntry
): Promise<boolean> {
  let chapterId: string | null = null;
  let diagnosticCreated = false;

  try {
    if (!epubResult.success || !epubResult.data || !epubResult.epub) {
      console.error("❌ Invalid EPUB result provided");
      return false;
    }

    console.log(`📖 Processing chapter: ${chapterEntry.title}`);

    // Create or find the book in database first
    const book = await createOrFindBook(epubResult.data);

    // Create or find the chapter in database
    const chapter = await createOrFindChapter(
      book.id,
      chapterEntry,
      "" // We'll update content after extraction
    );
    chapterId = chapter.id;

    // Create initial diagnostic record
    await createInitialDiagnostic(chapter.id, chapterEntry.title);
    diagnosticCreated = true;
    console.log(`📊 Created diagnostic record for chapter`);

    // Extract chapter content using the already-parsed EPub instance
    const chapterContent = await extractChapterContent(
      epubResult.epub,
      chapterEntry.href
    );
    console.log(`✅ Extracted content (${chapterContent.length} characters)`);

    // Update chapter content in database
    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { content: chapterContent },
    });

    // Update diagnostic: chapter parsing successful
    await updateChapterParsingStatus(chapter.id, 'SUCCESS');
    console.log(`📊 Updated diagnostic: chapter parsing SUCCESS`);

    // Extract facts using LLM
    console.log("🤖 Extracting facts using LLM...");
    const factResult = await extractFactsFromChapter(
      chapterContent,
      chapterEntry.title
    );

    if (!factResult.success || !factResult.facts) {
      console.error("❌ Failed to extract facts:", factResult.error);
      await updateFactsExtractionStatus(chapter.id, 'FAILED', 0, factResult.error);
      return false;
    }

    console.log(`✅ Extracted ${factResult.facts.length} facts`);

    // Store facts in database using memory system
    const memory = getChapterMemory();
    const storedFacts = await memory.addFacts(chapter.id, factResult.facts);

    console.log(`✅ Stored ${storedFacts.length} facts in database`);

    // Update diagnostic: facts extraction successful
    await updateFactsExtractionStatus(chapter.id, 'SUCCESS', storedFacts.length);
    console.log(`📊 Updated diagnostic: facts extraction SUCCESS (${storedFacts.length} facts)`);

    // Extract page numbers for the facts
    console.log("🔍 Extracting page numbers for facts...");
    const factTexts = factResult.facts;
    const pageMapping = await extractFactPageNumbers(factTexts, chapterContent);
    
    let factsWithPageNumbers = 0;
    if (Object.keys(pageMapping).length > 0) {
      const updatedCount = await updateFactPageNumbersForChapter(chapter.id, pageMapping);
      factsWithPageNumbers = updatedCount;
      console.log(`✅ Updated page numbers for ${updatedCount} facts`);
      
      // Update diagnostic: page numbers assignment successful
      await updateFactPageNumbersStatus(chapter.id, 'SUCCESS', factsWithPageNumbers);
      console.log(`📊 Updated diagnostic: page numbers assignment SUCCESS (${factsWithPageNumbers} facts)`);
    } else {
      console.log("⚠️ No page numbers could be extracted for facts");
      await updateFactPageNumbersStatus(chapter.id, 'FAILED', 0, 'No page numbers could be extracted');
      console.log(`📊 Updated diagnostic: page numbers assignment FAILED`);
    }

    console.log(`📊 Chapter processed successfully: ${chapterEntry.title}`);

    return true;
  } catch (error) {
    console.error(`❌ Error processing chapter ${chapterEntry.title}:`, error);
    
    // Update diagnostic with error if we have a chapter ID
    if (chapterId && diagnosticCreated) {
      try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Try to determine which step failed and update accordingly
        if (!chapterId) {
          await updateChapterParsingStatus(chapterId, 'FAILED', errorMessage);
        } else {
          // If we got to chapter creation but failed later, mark chapter parsing as success
          // and try to determine which other step failed
          const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
          if (chapter && chapter.content) {
            await updateChapterParsingStatus(chapterId, 'SUCCESS');
            // If we have content but failed, it's likely facts extraction
            await updateFactsExtractionStatus(chapterId, 'FAILED', 0, errorMessage);
          } else {
            await updateChapterParsingStatus(chapterId, 'FAILED', errorMessage);
          }
        }
        console.log(`📊 Updated diagnostic with error: ${errorMessage}`);
      } catch (diagnosticError) {
        console.error(`❌ Failed to update diagnostic:`, diagnosticError);
      }
    }
    
    return false;
  }
}

/**
 * Creates or finds a book in the database
 */
async function createOrFindBook(bookData: any) {
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
    console.log(`📚 Created new book: ${book.title}`);
  } else {
    console.log(`📚 Found existing book: ${book.title}`);
  }

  return book;
}

/**
 * Creates or finds a chapter in the database
 */
async function createOrFindChapter(
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
