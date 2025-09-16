import { prisma } from "@/queries/prisma";
import { Prisma } from "~/prisma/client";
import type { CachedEmbeddingWithVector, RawCachedEmbedding } from "./types";

export const getCachedEmbedding = async (text: string): Promise<CachedEmbeddingWithVector | null> => {
  const embeddings = await prisma.$queryRaw<RawCachedEmbedding[]>(
    Prisma.sql`
    SELECT id, text, created_at, updated_at, embedding::text FROM ai_cached_embedding 
    WHERE text = ${text} 
    LIMIT 1
  `
  );

  if (!embeddings || embeddings.length === 0) {
    return null;
  }

  const rawEmbedding = embeddings[0];
  return {
    id: rawEmbedding.id,
    text: rawEmbedding.text,
    created_at: rawEmbedding.created_at,
    updated_at: rawEmbedding.updated_at,
    feature_type: rawEmbedding.feature_type,
    embedding: JSON.parse(rawEmbedding.embedding) as number[],
  };
};
