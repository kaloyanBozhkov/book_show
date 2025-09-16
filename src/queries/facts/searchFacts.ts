import { prisma } from "../prisma";
import { TextEmbedding } from "../../ai/embeddings";
import { getSimilarityExpression, VectorSimilarityType } from "../../ai/embeddings";
import { vectorize } from "../../helpers/sql";
import type { FactSearchResult, RawSearchResult } from "./types";

export type SearchCursor = {
  lastId: string;
  lastSimilarity: number;
};

export type SearchFactsResult = {
  facts: FactSearchResult[];
  nextCursor?: SearchCursor;
};

export const searchFactsQuery = async ({
  searchEmbedding,
  minSimilarity = 0.2,
  limit = 10,
  cursor,
}: {
  searchEmbedding: TextEmbedding;
  minSimilarity?: number;
  limit?: number;
  cursor?: SearchCursor;
}): Promise<SearchFactsResult> => {
  const embeddingArray = vectorize(searchEmbedding.embedding, false);
  const similarityExpression = getSimilarityExpression({
    type: VectorSimilarityType.COSINE,
    embedding: searchEmbedding.embedding,
    embeddingColumn: "ace.embedding",
  });

  let cursorCondition = "";
  if (cursor) {
    cursorCondition = `AND (${similarityExpression} < ${cursor.lastSimilarity} OR (${similarityExpression} = ${cursor.lastSimilarity} AND f.id < '${cursor.lastId}'))`;
  }

  const query = `
    SELECT 
      f.id,
      f.text,
      ${similarityExpression} as similarity,
      c.id as chapter_id,
      c.title as chapter_title,
      c.chapter_number,
      b.id as book_id,
      b.title as book_title,
      b.author as book_author
    FROM fact f
    JOIN ai_cached_embedding ace ON f.embedding_id = ace.id
    JOIN chapter c ON f.chapter_id = c.id
    JOIN book b ON c.book_id = b.id
    WHERE ${similarityExpression} >= ${minSimilarity}
    ${cursorCondition}
    ORDER BY ${similarityExpression} DESC, f.id DESC
    LIMIT ${limit + 1}
  `;

  const results = await prisma.$queryRawUnsafe<RawSearchResult[]>(query);

  const hasMore = results.length > limit;
  const facts = hasMore ? results.slice(0, limit) : results;

  const formattedFacts = facts.map((fact: RawSearchResult) => ({
    id: fact.id,
    text: fact.text,
    similarity: fact.similarity,
    chapter: {
      id: fact.chapter_id,
      title: fact.chapter_title,
      chapter_number: fact.chapter_number,
      book: {
        id: fact.book_id,
        title: fact.book_title,
        author: fact.book_author,
      },
    },
  }));

  let nextCursor: SearchCursor | undefined;
  if (hasMore && facts.length > 0) {
    const lastFact = facts[facts.length - 1];
    nextCursor = {
      lastId: lastFact.id,
      lastSimilarity: lastFact.similarity,
    };
  }

  return {
    facts: formattedFacts,
    nextCursor,
  };
};
