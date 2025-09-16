import { enquote, vectorize } from "@/helpers/sql";
import { createId } from "@paralleldrive/cuid2";
import { embedding_feature_type, Prisma } from "~/prisma/client";
import { prisma } from "@/queries/prisma";
import type { CreatedCachedEmbedding } from "./types";

export const createCachedEmbedding = async (
  text: string,
  embedding: number[],
  featureType: embedding_feature_type[]
): Promise<CreatedCachedEmbedding> => {
  const createdEmbedding = await prisma.$queryRaw<
    Array<{
      id: string;
      text: string;
      created_at: Date;
      updated_at: Date;
    }>
  >(Prisma.sql`
    INSERT INTO ai_cached_embedding (id, text, embedding, feature_type)
    VALUES (${enquote(createId())}, ${enquote(text)}, ${vectorize(
    embedding
  )}, ARRAY[${featureType.join(", ")}]::embedding_feature_type[])
    RETURNING id, text, created_at, updated_at
  `);

  const result = createdEmbedding[0];
  return {
    id: result.id,
    text: result.text,
    created_at: result.created_at,
    updated_at: result.updated_at,
    embedding,
  };
};
