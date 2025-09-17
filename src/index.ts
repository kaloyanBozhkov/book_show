import EPub from "epub";
import * as fs from "fs";
import * as path from "path";
import { extractFactsFromChapter } from "./ai/extractFacts";
import { getChapterMemory } from "./ai/memory";
import { extractFactPageNumbers } from "./ai/extractFactPageNumbers";
import { updateFactPageNumbersForChapter } from "./queries/facts/updateFactPageNumbers";
import { prisma } from "./queries/prisma";
import { parsePageNumbers } from "./helpers/pageParser";

export interface BookIndexEntry {
  title: string;
  href: string;
  id: string;
  level: number;
  children?: BookIndexEntry[];
}

export interface BookIndex {
  entries: BookIndexEntry[];
  title?: string;
  author?: string;
  language?: string;
  publisher?: string;
  description?: string;
  totalChapters: number;
  filePath?: string;
}

export interface EPUBParseResult {
  success: boolean;
  data?: BookIndex;
  error?: string;
  epub?: EPub; // The parsed EPub instance for extracting chapter content
}

/**
 * Loads and parses an EPUB book file to extract its table of contents/index
 * @param filePath - Path to the EPUB file
 * @returns Promise<EPUBParseResult> - The parsed book index or error information
 */
export async function parseEPUBBook(
  filePath: string
): Promise<EPUBParseResult> {
  return new Promise((resolve) => {
    try {
      // Resolve to absolute path
      const absolutePath = path.resolve(filePath);

      // Validate file path
      if (!fs.existsSync(absolutePath)) {
        resolve({
          success: false,
          error: `File not found: ${absolutePath}`,
        });
        return;
      }

      // Check if file is an EPUB
      const ext = path.extname(absolutePath).toLowerCase();
      if (ext !== ".epub") {
        resolve({
          success: false,
          error: "File must be an EPUB (.epub extension)",
        });
        return;
      }

      // Create EPUB instance
      const epub = new EPub(absolutePath);

      epub.on("end", () => {
        try {
          // Extract metadata
          const title =
            epub.metadata.title || path.basename(absolutePath, ".epub");
          const author = epub.metadata.creator || "Unknown";
          const language = epub.metadata.language || "Unknown";
          const publisher = (epub.metadata as any).publisher || "Unknown";
          const description = epub.metadata.description || "";

          // Parse table of contents
          const entries = parseEPUBTOC(epub.toc);

          resolve({
            success: true,
            data: {
              entries,
              title,
              author,
              language,
              publisher,
              description,
              totalChapters: epub.toc.length,
              filePath: absolutePath,
            },
            epub: epub,
          });
        } catch (error) {
          console.error("Error processing EPUB data:", error);
          resolve({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Error processing EPUB data",
          });
        }
      });

      epub.on("error", (error: any) => {
        console.error("Error parsing EPUB:", error);
        resolve({
          success: false,
          error:
            error instanceof Error ? error.message : "Error parsing EPUB file",
        });
      });

      // Start parsing
      epub.parse();
    } catch (error) {
      console.error("Error initializing EPUB parser:", error);
      resolve({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  });
}

/**
 * Parses the EPUB table of contents into a structured book index
 * @param toc - The EPUB table of contents array
 * @returns BookIndexEntry[] - Structured index entries
 */
function parseEPUBTOC(toc: any[]): BookIndexEntry[] {
  if (!toc || !Array.isArray(toc)) {
    return [];
  }

  return toc.map((item, index) => {
    const entry: BookIndexEntry = {
      title: item.title || `Chapter ${index + 1}`,
      href: item.href || "",
      id: item.id || `chapter-${index + 1}`,
      level: 0, // EPUB TOC is typically flat, but we can detect nesting if needed
    };

    // EPUB TOC can have nested structure in some cases
    if (item.children && item.children.length > 0) {
      entry.children = item.children.map((child: any, childIndex: number) => ({
        title: child.title || `Section ${childIndex + 1}`,
        href: child.href || "",
        id: child.id || `section-${childIndex + 1}`,
        level: 1,
      }));
    }

    return entry;
  });
}

/**
 * Extracts chapter content from an already-parsed EPUB instance
 * @param epub - The parsed EPub instance
 * @param chapterHref - Href of the chapter to extract
 * @returns Promise<string> - Chapter content as HTML/text
 */
export async function extractChapterContent(
  epub: EPub,
  chapterHref: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Attempting to extract chapter with href: ${chapterHref}`);

    // First try with the original href
    epub.getChapter(chapterHref, (error: any, text: string) => {
      if (error) {
        console.error(
          `❌ Failed to extract chapter "${chapterHref}":`,
          error.message
        );

        // Try using the chapter ID instead of href
        const chapter = epub.flow.find((item) => item.href === chapterHref);
        if (chapter && chapter.id) {
          console.log(`🔄 Trying with chapter ID: ${chapter.id}`);
          epub.getChapter(chapter.id, (error2: any, text2: string) => {
            if (error2) {
              console.error(
                `❌ Failed with chapter ID "${chapter.id}":`,
                error2.message
              );

              // Try using the raw chapter data
              try {
                epub.getChapterRaw(chapter.id, (error3: any, text3: string) => {
                  if (error3) {
                    reject(
                      new Error(
                        `Could not extract chapter using any method. Original error: ${error.message}, Raw error: ${error3.message}`
                      )
                    );
                  } else {
                    console.log(
                      `✅ Successfully extracted chapter using getChapterRaw (${text3.length} characters)`
                    );
                    resolve(text3);
                  }
                });
              } catch (rawError) {
                reject(
                  new Error(
                    `Could not extract chapter using any method. Original error: ${error.message}, Raw error: ${rawError}`
                  )
                );
              }
            } else {
              console.log(
                `✅ Successfully extracted chapter content using ID (${text2.length} characters)`
              );
              resolve(text2);
            }
          });
        } else {
          reject(new Error(`Could not find chapter with href: ${chapterHref}`));
        }
      } else {
        console.log(
          `✅ Successfully extracted chapter content (${text.length} characters)`
        );
        resolve(text);
      }
    });
  });
}

/**
 * Gets all available chapters from an EPUB file
 * @param filePath - Path to the EPUB file
 * @returns Promise<Array<{id: string, title: string, href: string}>> - List of chapters
 */
export async function getEPUBChapters(
  filePath: string
): Promise<Array<{ id: string; title: string; href: string }>> {
  return new Promise((resolve, reject) => {
    try {
      const absolutePath = path.resolve(filePath);
      const epub = new EPub(absolutePath);

      epub.on("end", () => {
        const chapters = epub.flow.map((item: any) => ({
          id: item.id,
          title: item.title,
          href: item.href,
        }));
        resolve(chapters);
      });

      epub.on("error", (error: any) => {
        reject(new Error(`Error parsing EPUB: ${error.message}`));
      });

      epub.parse();
    } catch (error) {
      reject(new Error(`Error initializing EPUB parser: ${error}`));
    }
  });
}

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
  try {
    if (!epubResult.success || !epubResult.data || !epubResult.epub) {
      console.error("❌ Invalid EPUB result provided");
      return false;
    }

    console.log(`📖 Processing chapter: ${chapterEntry.title}`);

    // Extract chapter content using the already-parsed EPub instance
    const chapterContent = await extractChapterContent(
      epubResult.epub,
      chapterEntry.href
    );
    console.log(`✅ Extracted content (${chapterContent.length} characters)`);

    // Extract facts using LLM
    console.log("🤖 Extracting facts using LLM...");
    const factResult = await extractFactsFromChapter(
      chapterContent,
      chapterEntry.title
    );

    if (!factResult.success || !factResult.facts) {
      console.error("❌ Failed to extract facts:", factResult.error);
      return false;
    }

    console.log(`✅ Extracted ${factResult.facts.length} facts`);

    // Create or find the book in database
    const book = await createOrFindBook(epubResult.data);

    // Create or find the chapter in database
    const chapter = await createOrFindChapter(
      book.id,
      chapterEntry,
      chapterContent
    );

    // Store facts in database using memory system
    const memory = getChapterMemory();
    const storedFacts = await memory.addFacts(chapter.id, factResult.facts);

    console.log(`✅ Stored ${storedFacts.length} facts in database`);

    // Extract page numbers for the facts
    console.log("🔍 Extracting page numbers for facts...");
    const factTexts = factResult.facts;
    const pageMapping = await extractFactPageNumbers(factTexts, chapterContent);
    
    if (Object.keys(pageMapping).length > 0) {
      const updatedCount = await updateFactPageNumbersForChapter(chapter.id, pageMapping);
      console.log(`✅ Updated page numbers for ${updatedCount} facts`);
    } else {
      console.log("⚠️ No page numbers could be extracted for facts");
    }

    console.log(`📊 Chapter processed successfully: ${chapterEntry.title}`);

    return true;
  } catch (error) {
    console.error(`❌ Error processing chapter ${chapterEntry.title}:`, error);
    return false;
  }
}

/**
 * Creates or finds a book in the database
 */
async function createOrFindBook(bookData: BookIndex) {
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

// Example usage function
export async function exampleUsage() {
  // Get filepath from command line arguments
  const filePath = process.argv[3];
  const stopAtChapter = process.argv[4];

  if (!filePath) {
    console.error("❌ Please provide a filepath as an argument");
    console.log("Usage: npm start <path-to-epub-file> [stop-at-chapter|just-X]");
    console.log("Examples:");
    console.log("  npm start /path/to/your/book.epub                    # Process all chapters");
    console.log("  npm start /path/to/your/book.epub 3                  # Process first 3 chapters");
    console.log("  npm start /path/to/your/book.epub just-5             # Process only chapter 5");
    process.exit(1);
  }

  // Parse and validate the stop-at-chapter parameter
  let maxChapters: number | undefined;
  let justChapter: number | undefined;
  
  if (stopAtChapter) {
    // Check if it's a "just-X" format
    if (stopAtChapter.startsWith('just-')) {
      const chapterNum = stopAtChapter.substring(5); // Remove "just-" prefix
      const parsedChapter = parseInt(chapterNum);
      if (isNaN(parsedChapter) || parsedChapter < 1) {
        console.error("❌ Invalid chapter number after 'just-'. Must be a positive integer.");
        console.log("Usage: npm start <path-to-epub-file> [stop-at-chapter|just-X]");
        console.log("Example: npm start /path/to/your/book.epub just-3");
        process.exit(1);
      }
      justChapter = parsedChapter;
      console.log(`🎯 Will process only chapter ${justChapter}`);
    } else {
      // Regular stop-at-chapter format
      const parsedChapter = parseInt(stopAtChapter);
      if (isNaN(parsedChapter) || parsedChapter < 1) {
        console.error("❌ Invalid chapter number. Must be a positive integer or 'just-X' format.");
        console.log("Usage: npm start <path-to-epub-file> [stop-at-chapter|just-X]");
        console.log("Example: npm start /path/to/your/book.epub 3");
        console.log("Example: npm start /path/to/your/book.epub just-3");
        process.exit(1);
      }
      maxChapters = parsedChapter;
      console.log(`🛑 Will stop processing at chapter ${maxChapters}`);
    }
  }

  console.log(`📚 Processing EPUB file: ${filePath}`);
  const result = await parseEPUBBook(filePath);

  if (result.success && result.data) {
    console.log("✅ Book Index extracted successfully:");
    console.log(formatBookIndex(result.data));

    // Process chapters (with optional limit or specific chapter)
    if (result.data.entries.length > 0) {
      const totalChapters = result.data.entries.length;
      let chaptersToProcess: number;
      let startIndex = 0;
      let endIndex: number;
      
      if (justChapter) {
        // Process only a specific chapter
        if (justChapter > totalChapters) {
          console.error(`❌ Chapter ${justChapter} does not exist. Book has only ${totalChapters} chapters.`);
          process.exit(1);
        }
        startIndex = justChapter - 1; // Convert to 0-based index
        endIndex = justChapter;
        chaptersToProcess = 1;
        console.log(`\n🎯 Processing only chapter ${justChapter}: ${result.data.entries[startIndex].title}`);
      } else {
        // Process with optional limit
        chaptersToProcess = maxChapters ? Math.min(maxChapters, totalChapters) : totalChapters;
        endIndex = chaptersToProcess;
        
        if (maxChapters && maxChapters < totalChapters) {
          console.log(`\n🚀 Processing first ${chaptersToProcess} of ${totalChapters} chapters...`);
        } else {
          console.log(`\n🚀 Processing all ${totalChapters} chapters...`);
        }
      }
      
      let successCount = 0;
      let failureCount = 0;
      
      for (let i = startIndex; i < endIndex; i++) {
        const chapter = result.data.entries[i];
        const displayIndex = i + 1;
        const displayTotal = justChapter ? 1 : chaptersToProcess;
        console.log(`\n📖 [${displayIndex}/${displayTotal}] Processing: ${chapter.title}`);

        try {
          const success = await processChapter(result, chapter);
          if (success) {
            successCount++;
            console.log(`✅ Chapter ${displayIndex} processed successfully!`);
          } else {
            failureCount++;
            console.log(`❌ Failed to process chapter ${displayIndex}`);
          }
        } catch (error) {
          failureCount++;
          console.error(`❌ Error processing chapter ${displayIndex}:`, error);
        }
      }
      
      console.log(`\n📊 Processing Summary:`);
      console.log(`✅ Successfully processed: ${successCount} chapters`);
      console.log(`❌ Failed to process: ${failureCount} chapters`);
      console.log(`📈 Success rate: ${((successCount / chaptersToProcess) * 100).toFixed(1)}%`);
      
      if (justChapter) {
        console.log(`📝 Note: Processed only chapter ${justChapter} of ${totalChapters} total chapters`);
      } else if (maxChapters && maxChapters < totalChapters) {
        console.log(`📝 Note: Processed ${chaptersToProcess} of ${totalChapters} total chapters`);
      }
    }

    // Example: Search for a specific term
    const searchResults = searchInBookIndex(result.data, "chapter");
    if (searchResults.length > 0) {
      console.log('\n🔍 Search results for "chapter":');
      searchResults.forEach((entry) => {
        console.log(`  • ${entry.title}`);
      });
    }
  } else {
    console.error("❌ Failed to extract book index:", result.error);
  }
}

exampleUsage();
