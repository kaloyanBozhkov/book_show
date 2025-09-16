import z from "zod";
import { getLLMResponse } from "./getLLMResponse";
import { EXTRACT_FACT_PAGE_NUMBERS_SYSTEM_MESSAGE } from "./system_messages";

export interface FactPageMapping {
  [factText: string]: number | null;
}

const FactPageMappingSchema = z.record(z.string(), z.number().nullable());

/**
 * Extracts page numbers for facts from chapter content using LLM
 * @param facts - Array of fact texts
 * @param chapterContent - The HTML content of the chapter with page anchors
 * @returns Promise<FactPageMapping> - Mapping of fact text to page numbers
 */
export async function extractFactPageNumbers(
  facts: string[],
  chapterContent: string
): Promise<FactPageMapping> {
  try {
    console.log(`🔍 Extracting page numbers for ${facts.length} facts...`);
    
    const userMessage = [
      `Chapter Content:\n${chapterContent}`,
      `\nFacts to map to pages:\n${facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n')}`
    ];

    const result = await getLLMResponse<FactPageMapping>({
      userMessage,
      systemMessage: EXTRACT_FACT_PAGE_NUMBERS_SYSTEM_MESSAGE,
      schema: FactPageMappingSchema,
    });

    console.log(`✅ Successfully extracted page numbers for ${Object.keys(result).length} facts`);
    return result;
  } catch (error) {
    console.error("❌ Failed to extract fact page numbers:", error);
    // Return empty mapping on error
    return {};
  }
}
