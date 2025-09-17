import EPub from "epub";
import * as fs from "fs";
import * as path from "path";
import { BookIndex, BookIndexEntry, EPUBParseResult } from "./types";

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
