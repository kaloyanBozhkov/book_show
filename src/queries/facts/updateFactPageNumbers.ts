import { prisma } from "../prisma";

export interface FactPageMapping {
  [factText: string]: number | null;
}

/**
 * Updates page numbers for facts in a specific chapter
 * First fetches all facts for the chapter, then updates them using their unique IDs
 * @param chapterId - ID of the chapter
 * @param factPageMapping - Object mapping fact text to page numbers
 * @returns Promise<number> - Number of facts updated
 */
export async function updateFactPageNumbersForChapter(
  chapterId: string,
  factPageMapping: FactPageMapping
): Promise<number> {
  try {
    // First, fetch all facts for this chapter to get their IDs
    const chapterFacts = await prisma.fact.findMany({
      where: {
        chapter_id: chapterId,
      },
      select: {
        id: true,
        text: true,
      },
    });

    console.log(
      `📋 Found ${chapterFacts.length} facts in chapter ${chapterId}`
    );

    let updatedCount = 0;

    // Update each fact using its unique ID
    for (const fact of chapterFacts) {
      const pageNumber = factPageMapping[fact.text];

      if (pageNumber !== undefined) {
        try {
          await prisma.fact.update({
            where: {
              id: fact.id,
            },
            data: {
              page_number: pageNumber,
            },
          });

          updatedCount++;
          console.log(
            `✅ Updated fact "${fact.text.substring(
              0,
              50
            )}..." to page ${pageNumber}`
          );
        } catch (error) {
          console.error(
            `Failed to update page number for fact ID ${fact.id}:`,
            error
          );
        }
      } else {
        console.log(
          `⚠️ No page number mapping found for fact: "${fact.text.substring(
            0,
            50
          )}..."`
        );
      }
    }

    return updatedCount;
  } catch (error) {
    console.error(
      `Failed to update fact page numbers for chapter ${chapterId}:`,
      error
    );
    return 0;
  }
}
