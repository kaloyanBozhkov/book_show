import { prisma } from "@/queries/prisma";
import { Prisma } from "@prisma/client";
import type { CachedEmbeddingWithVector, RawCachedEmbedding } from "./types";

export const getManyCachedEmbeddings = async (texts: string[]): Promise<CachedEmbeddingWithVector[]> => {
  const embeddings = await prisma.$queryRaw<RawCachedEmbedding[]>(
    Prisma.sql`
      SELECT id, text, created_at, updated_at, embedding::text, feature_type FROM ai_cached_embedding 
      WHERE text IN (${Prisma.join(texts)})
    `
  );

  return embeddings.map((rawEmbedding: RawCachedEmbedding): CachedEmbeddingWithVector => ({
    id: rawEmbedding.id,
    text: rawEmbedding.text,
    created_at: rawEmbedding.created_at,
    updated_at: rawEmbedding.updated_at,
    feature_type: rawEmbedding.feature_type,
    embedding: JSON.parse(rawEmbedding.embedding) as number[],
  }));
};
