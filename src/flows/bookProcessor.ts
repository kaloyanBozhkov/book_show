import { parseEPUBBook } from "../epub/parser";
import { formatBookIndex, searchInBookIndex } from "../epub/utils";
import { processChapter } from "./chapterProcessor";
import { EPUBParseResult } from "../epub/types";

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
