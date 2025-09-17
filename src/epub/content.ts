import EPub from "epub";
import * as path from "path";

/**
 * Extracts chapter content from an already-parsed EPUB instance
 * @param epub - The parsed EPub instance
 * @param chapterHref - Href of the chapter to extract
 * @returns Promise<string> - Chapter content as HTML/text
 */
export async function extractChapterContent(
  epub: any,
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
        const chapter = epub.flow.find((item: any) => item.href === chapterHref);
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
