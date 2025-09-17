import { parseEPUBBook } from "../epub/parser";
import { formatBookIndex, searchInBookIndex } from "../epub/utils";
import { processChapter } from "./chapterProcessor";
import { getBookDiagnosticStats } from "../queries/diagnostics";
import { prisma } from "../queries/prisma";
import { updateBookStatusByFilePath } from "../queries/books";
import { getTotalPagesFromLastChapter } from "../epub/totalPages";


// Example usage function
export async function exampleUsage() {
  // Get filepath from command line arguments
  const filePath = process.argv[3];
  const stopAtChapter = process.argv[4];

  if (!filePath) {
    console.error("❌ Please provide a filepath as an argument");
    console.log(
      "Usage: npm start <path-to-epub-file> [stop-at-chapter|just-X|from-X]"
    );
    console.log("Examples:");
    console.log(
      "  npm start /path/to/your/book.epub                    # Process all chapters"
    );
    console.log(
      "  npm start /path/to/your/book.epub 3                  # Process first 3 chapters"
    );
    console.log(
      "  npm start /path/to/your/book.epub just-5             # Process only chapter 5"
    );
    console.log(
      "  npm start /path/to/your/book.epub from-3             # Process from chapter 3 to end"
    );
    process.exit(1);
  }

  // Parse and validate the stop-at-chapter parameter
  let maxChapters: number | undefined;
  let justChapter: number | undefined;
  let fromChapter: number | undefined;

  if (stopAtChapter) {
    // Check if it's a "just-X" format
    if (stopAtChapter.startsWith("just-")) {
      const chapterNum = stopAtChapter.substring(5); // Remove "just-" prefix
      const parsedChapter = parseInt(chapterNum);
      if (isNaN(parsedChapter) || parsedChapter < 1) {
        console.error(
          "❌ Invalid chapter number after 'just-'. Must be a positive integer."
        );
        console.log(
          "Usage: npm start <path-to-epub-file> [stop-at-chapter|just-X|from-X]"
        );
        console.log("Example: npm start /path/to/your/book.epub just-3");
        process.exit(1);
      }
      justChapter = parsedChapter;
      console.log(`🎯 Will process only chapter ${justChapter}`);
    } else if (stopAtChapter.startsWith("from-")) {
      // Check if it's a "from-X" format
      const chapterNum = stopAtChapter.substring(5); // Remove "from-" prefix
      const parsedChapter = parseInt(chapterNum);
      if (isNaN(parsedChapter) || parsedChapter < 1) {
        console.error(
          "❌ Invalid chapter number after 'from-'. Must be a positive integer."
        );
        console.log(
          "Usage: npm start <path-to-epub-file> [stop-at-chapter|just-X|from-X]"
        );
        console.log("Example: npm start /path/to/your/book.epub from-3");
        process.exit(1);
      }
      fromChapter = parsedChapter;
      console.log(`🚀 Will process from chapter ${fromChapter} to end`);
    } else {
      // Regular stop-at-chapter format
      const parsedChapter = parseInt(stopAtChapter);
      if (isNaN(parsedChapter) || parsedChapter < 1) {
        console.error(
          "❌ Invalid chapter number. Must be a positive integer, 'just-X', or 'from-X' format."
        );
        console.log(
          "Usage: npm start <path-to-epub-file> [stop-at-chapter|just-X|from-X]"
        );
        console.log("Example: npm start /path/to/your/book.epub 3");
        console.log("Example: npm start /path/to/your/book.epub just-3");
        console.log("Example: npm start /path/to/your/book.epub from-3");
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

    // Calculate total pages from the last chapter before processing
    let totalPages: number | null = null;
    try {
      console.log("🔍 Calculating total pages from last chapter...");
      totalPages = await getTotalPagesFromLastChapter(result.epub, result.data);
      if (totalPages && totalPages > 0) {
        console.log(`📖 Total pages determined: ${totalPages}`);
      } else {
        console.log("⚠️ Could not determine total pages from last chapter");
      }
    } catch (error) {
      console.error("❌ Error calculating total pages:", error);
    }

    // Process chapters (with optional limit, specific chapter, or from chapter)
    if (result.data.entries.length > 0) {
      const totalChapters = result.data.entries.length;
      let chaptersToProcess: number;
      let startIndex = 0;
      let endIndex: number;

      if (justChapter) {
        // Process only a specific chapter
        if (justChapter > totalChapters) {
          console.error(
            `❌ Chapter ${justChapter} does not exist. Book has only ${totalChapters} chapters.`
          );
          process.exit(1);
        }
        startIndex = justChapter - 1; // Convert to 0-based index
        endIndex = justChapter;
        chaptersToProcess = 1;
        console.log(
          `\n🎯 Processing only chapter ${justChapter}: ${result.data.entries[startIndex].title}`
        );
      } else if (fromChapter) {
        // Process from a specific chapter to the end
        if (fromChapter > totalChapters) {
          console.error(
            `❌ Chapter ${fromChapter} does not exist. Book has only ${totalChapters} chapters.`
          );
          process.exit(1);
        }
        startIndex = fromChapter - 1; // Convert to 0-based index
        endIndex = totalChapters;
        chaptersToProcess = totalChapters - startIndex;
        console.log(
          `\n🚀 Processing from chapter ${fromChapter} to end (${chaptersToProcess} chapters):`
        );
        console.log(
          `   Starting with: ${result.data.entries[startIndex].title}`
        );
        console.log(
          `   Ending with: ${result.data.entries[endIndex - 1].title}`
        );
      } else {
        // Process with optional limit (first X chapters)
        chaptersToProcess = maxChapters
          ? Math.min(maxChapters, totalChapters)
          : totalChapters;
        endIndex = chaptersToProcess;

        if (maxChapters && maxChapters < totalChapters) {
          console.log(
            `\n🚀 Processing first ${chaptersToProcess} of ${totalChapters} chapters...`
          );
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
        console.log(
          `\n📖 [${displayIndex}/${displayTotal}] Processing: ${chapter.title}`
        );

        try {
          const success = await processChapter(result, chapter, totalPages);
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
      console.log(
        `📈 Success rate: ${((successCount / chaptersToProcess) * 100).toFixed(
          1
        )}%`
      );

      if (justChapter) {
        console.log(
          `📝 Note: Processed only chapter ${justChapter} of ${totalChapters} total chapters`
        );
      } else if (fromChapter) {
        console.log(
          `📝 Note: Processed from chapter ${fromChapter} to end (${chaptersToProcess} of ${totalChapters} total chapters)`
        );
      } else if (maxChapters && maxChapters < totalChapters) {
        console.log(
          `📝 Note: Processed ${chaptersToProcess} of ${totalChapters} total chapters`
        );
      }

      // Show diagnostic statistics
      try {
        const book = await prisma.book.findFirst({
          where: { file_path: filePath },
        });

        if (book) {
          const diagnosticStats = await getBookDiagnosticStats(book.id);
          console.log(`\n📊 Diagnostic Statistics:`);
          console.log(
            `📖 Chapters parsed: ${diagnosticStats.chaptersParsed}/${diagnosticStats.totalChapters}`
          );
          console.log(
            `🤖 Facts extracted: ${diagnosticStats.factsExtracted}/${diagnosticStats.totalChapters}`
          );
          console.log(
            `📄 Page numbers assigned: ${diagnosticStats.pageNumbersAssigned}/${diagnosticStats.totalChapters}`
          );
          console.log(`📝 Total facts: ${diagnosticStats.totalFacts}`);
          console.log(
            `🔢 Facts with page numbers: ${diagnosticStats.totalFactsWithPageNumbers}`
          );
          console.log(`📚 Total pages: ${book.total_pages}`);

          if (
            diagnosticStats.failedChapters > 0 ||
            diagnosticStats.failedFactsExtraction > 0 ||
            diagnosticStats.failedPageNumbers > 0
          ) {
            console.log(`\n❌ Failures:`);
            if (diagnosticStats.failedChapters > 0)
              console.log(
                `  • Chapter parsing: ${diagnosticStats.failedChapters}`
              );
            if (diagnosticStats.failedFactsExtraction > 0)
              console.log(
                `  • Facts extraction: ${diagnosticStats.failedFactsExtraction}`
              );
            if (diagnosticStats.failedPageNumbers > 0)
              console.log(
                `  • Page numbers: ${diagnosticStats.failedPageNumbers}`
              );
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not retrieve diagnostic statistics: ${error}`);
      }

      // Update book status based on processing results
      try {
        if (failureCount === 0) {
          // All chapters processed successfully
          await updateBookStatusByFilePath(filePath, "COMPLETED");
          console.log(`📚 Updated book status to COMPLETED`);
        } else if (successCount === 0) {
          // All chapters failed
          await updateBookStatusByFilePath(filePath, "ERROR");
          console.log(`📚 Updated book status to ERROR (all chapters failed)`);
        } else {
          // Some chapters succeeded, some failed - still mark as completed
          // since we processed what we could
          await updateBookStatusByFilePath(filePath, "COMPLETED");
          console.log(
            `📚 Updated book status to COMPLETED (${failureCount} chapters failed)`
          );
        }
      } catch (error) {
        console.log(`⚠️ Could not update book status: ${error}`);
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

    // Update book status to ERROR if EPUB parsing failed
    try {
      await updateBookStatusByFilePath(filePath, "ERROR");
      console.log(`📚 Updated book status to ERROR (EPUB parsing failed)`);
    } catch (error) {
      console.log(`⚠️ Could not update book status: ${error}`);
    }
  }
}