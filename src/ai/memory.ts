import { getEmbeddings, getManyEmbeddings } from "./embeddings";
import {
  addFactsQuery,
  addFactQuery,
} from "../queries/facts/addFacts";
import {
  type SearchCursor,
  searchFactsQuery,
  SearchFactsResult,
} from "../queries/facts/searchFacts";
import {
  deleteFactQuery,
  deleteAllFactsQuery,
} from "../queries/facts/deleteFact";
import { updateFactQuery } from "../queries/facts/updateFact";
import { fact } from "@prisma/client";
import { getFacts } from "../queries/facts/getFacts";
import type { FactWithEmbedding } from "../queries/facts/types";

type SearchFactsParams = {
  searchTopic?: string;
  similarity?: number;
  limit?: number;
  cursor?: SearchCursor;
};

type SearchFactsByChapterParams = {
  searchTopic?: string;
  similarity?: number;
  limit?: number;
  cursor?: SearchCursor;
};

export const getChapterMemory = () => {
  const memory = {
    /**
     * Add multiple facts to a chapter
     */
    async addFacts(chapterId: string, facts: string[]): Promise<fact[]> {
      if (facts.length === 0) return [];

      try {
        const embeddings = await getManyEmbeddings({ texts: facts });
        await addFactsQuery({ chapterId, embeddings });
        // Return the facts that were just added by fetching them
        return await getFacts(chapterId, facts);
      } catch (error) {
        console.error("Failed to add facts:", error);
        throw new Error("Failed to add facts to chapter");
      }
    },

    /**
     * Add a single fact to a chapter
     */
    async addFact(chapterId: string, factText: string): Promise<fact> {
      try {
        const embedding = await getEmbeddings({ text: factText.trim() });
        return await addFactQuery({ chapterId, embedding });
      } catch (error) {
        console.error("Failed to add fact:", error);
        throw new Error("Failed to add fact to chapter");
      }
    },

    /**
     * Search facts by semantic similarity or list all facts
     */
    async searchFacts({
      searchTopic,
      similarity = 0.2,
      limit = 10,
      cursor,
    }: SearchFactsParams): Promise<SearchFactsResult> {
      try {
        if (!searchTopic) {
          // List all facts when no search topic is provided
          return { facts: [] };
        }
        // TODO expand search query

        // Search by semantic similarity
        const searchEmbedding = await getEmbeddings({ text: searchTopic });
        return searchFactsQuery({
          searchEmbedding,
          minSimilarity: similarity,
          limit,
          cursor,
        });
      } catch (error) {
        console.error("Failed to search facts:", error);
        return { facts: [] };
      }
    },

    /**
     * Search facts by semantic similarity (alias for searchFacts)
     */
    async searchFactsByChapter({
      searchTopic,
      similarity = 0.2,
      limit = 10,
      cursor,
    }: SearchFactsByChapterParams) {
      return this.searchFacts({
        searchTopic,
        similarity,
        limit,
        cursor,
      });
    },

    /**
     * Delete a specific fact
     */
    async deleteFact(chapterId: string, factId: string): Promise<void> {
      try {
        await deleteFactQuery({ factId, chapterId });
      } catch (error) {
        console.error("Failed to delete fact:", error);
        throw new Error("Failed to delete fact");
      }
    },

    async deleteFacts(chapterId: string, factIds: string[]): Promise<void> {
      for (const factId of factIds) {
        await deleteFactQuery({ factId, chapterId });
      }
    },

    /**
     * Delete all facts for a chapter
     */
    async deleteAllFacts(chapterId: string): Promise<void> {
      try {
        await deleteAllFactsQuery({ chapterId });
      } catch (error) {
        console.error("Failed to delete all facts:", error);
        throw new Error("Failed to delete all facts");
      }
    },

    /**
     * Update a fact's text (and regenerate embedding if text changes)
     */
    async updateFact(
      chapterId: string,
      factId: string,
      newText: string
    ): Promise<fact> {
      try {
        const newTextTrimmed = newText.trim();
        const embedding = await getEmbeddings({ text: newTextTrimmed });
        return await updateFactQuery({
          factId,
          chapterId,
          text: newTextTrimmed,
          embedding,
        });
      } catch (error) {
        console.error("Failed to update fact:", error);
        throw new Error("Failed to update fact");
      }
    },

    /**
     * Update multiple facts
     */
    async updateFacts(
      chapterId: string,
      facts: { id: string; text: string }[]
    ): Promise<fact[]> {
      const updatedFacts = [];
      for (const fact of facts) {
        const updatedFact = await this.updateFact(
          chapterId,
          fact.id,
          fact.text
        );
        updatedFacts.push(updatedFact);
      }
      return updatedFacts;
    },

    /**
     * upsert multiple facts
     */
    async upsertFacts(
      chapterId: string,
      facts: string[],
      withDelete = true
    ): Promise<fact[]> {
      if (facts.length === 0) return [];

      const fetchedFacts = await getFacts(chapterId, facts);
      const newFacts = facts.filter(
        (fact) => !fetchedFacts.some((f: FactWithEmbedding) => f.text === fact)
      );
      const updatedFacts = facts.filter((fact) =>
        fetchedFacts.some((f: FactWithEmbedding) => f.text === fact)
      );
      const deletedFacts = fetchedFacts.filter((f: FactWithEmbedding) => !facts.includes(f.text));

      const newlyAddedFacts = await this.addFacts(chapterId, newFacts);
      const justUpdatedFacts = await this.updateFacts(
        chapterId,
        fetchedFacts.filter((f: FactWithEmbedding) => updatedFacts.includes(f.text))
      );
      if (withDelete) {
        await this.deleteFacts(
          chapterId,
          deletedFacts.map((f: FactWithEmbedding) => f.id)
        );
      }

      return [...newlyAddedFacts, ...justUpdatedFacts];
    },

    /**
     * Find facts similar to a given fact (useful for deduplication)
     */
    async findSimilarFacts(
      factText: string,
      { similarity = 0.9, limit = 5 } = {}
    ) {
      return await this.searchFacts({
        searchTopic: factText,
        similarity,
        limit,
      });
    },

    /**
     * Check if a fact already exists (high similarity threshold)
     */
    async factExists(
      factText: string,
      { similarity = 0.95 } = {}
    ): Promise<boolean> {
      const result = await this.findSimilarFacts(factText, {
        similarity,
        limit: 1,
      });
      return result.facts.length > 0;
    },

    /**
     * Add fact only if it doesn't already exist
     */
    async addFactIfNew(
      chapterId: string,
      factText: string,
      { similarity = 0.9 } = {}
    ): Promise<fact | null> {
      const exists = await this.factExists(factText, { similarity });
      if (exists) {
        return null;
      }
      return await this.addFact(chapterId, factText);
    },
  };

  return memory;
};
