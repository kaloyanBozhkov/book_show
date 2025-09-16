import { z } from "zod";
import { getLLMResponse } from "./getLLMResponse";
import { EXTRACT_CHAPTER_FACTS_SYSTEM_MESSAGE } from "./system_messages";
import { retry } from "@/helpers/retry";

export interface FactExtractionResult {
  success: boolean;
  facts?: string[];
  error?: string;
}

/**
 * Extracts facts from chapter content using LLM
 * @param chapterContent - The HTML/text content of the chapter
 * @param chapterTitle - The title of the chapter (for context)
 * @returns Promise<FactExtractionResult> - Extracted facts or error
 */
export async function extractFactsFromChapter(
  chapterContent: string,
  chapterTitle?: string
): Promise<FactExtractionResult> {
  try {
    // Clean the chapter content (remove HTML tags, normalize whitespace)
    const cleanContent = cleanChapterContent(chapterContent);

    // Create the prompt with chapter context
    const prompt = createFactExtractionPrompt(cleanContent, chapterTitle);

    // Get LLM response
    const response = await retry(async () => {
      return await getLLMResponse({
        systemMessage: EXTRACT_CHAPTER_FACTS_SYSTEM_MESSAGE,
        userMessage: prompt,
        schema: z.array(z.string()),
      });
    }, 3);

    if (response.length === 0) {
      return {
        success: false,
        error: "No facts were extracted from the chapter",
      };
    }

    return {
      success: true,
      facts: response,
    };
  } catch (error) {
    console.error("Error extracting facts from chapter:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Cleans chapter content by removing HTML tags and normalizing whitespace
 */
function cleanChapterContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, " ") // Remove HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Creates the prompt for fact extraction
 */
function createFactExtractionPrompt(
  content: string,
  chapterTitle?: string
): string {
  let prompt =
    "Please extract all meaningful facts from the following chapter content:\n\n";

  if (chapterTitle) {
    prompt += `Chapter Title: ${chapterTitle}\n\n`;
  }

  prompt += `Chapter Content:\n${content}`;

  return prompt;
}

/**
 * Parses facts from LLM response, handling various response formats
 */
function parseFactsFromResponse(response: string): string[] {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (fact) => typeof fact === "string" && fact.trim().length > 0
      );
    }
  } catch {
    // If JSON parsing fails, try to extract facts from other formats
  }

  // Try to extract facts from markdown-style list
  const markdownFacts = response
    .split("\n")
    .map((line) => line.replace(/^[-*+]\s*/, "").trim())
    .filter(
      (line) =>
        line.length > 0 && !line.startsWith("#") && !line.startsWith("##")
    );

  if (markdownFacts.length > 0) {
    return markdownFacts;
  }

  // Try to extract facts from numbered list
  const numberedFacts = response
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0 && !line.match(/^\d+\./));

  if (numberedFacts.length > 0) {
    return numberedFacts;
  }

  // Fallback: split by sentences and filter meaningful ones
  const sentences = response
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20 && sentence.length < 200);

  return sentences;
}
