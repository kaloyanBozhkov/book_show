import { prisma } from "../prisma";
import { TextEmbedding } from "../../ai/embeddings";
import type { fact } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const addFactsQuery = async ({
  chapterId,
  embeddings,
}: {
  chapterId: string;
  embeddings: TextEmbedding[];
}): Promise<Prisma.BatchPayload> => {
  const factsData: Prisma.factCreateManyInput[] = embeddings.map((embedding) => ({
    text: embedding.text,
    embedding_id: embedding.cachedEmbeddingId,
    chapter_id: chapterId,
  }));

  return await prisma.fact.createMany({
    data: factsData,
  });
};

export const addFactQuery = async ({
  chapterId,
  embedding,
}: {
  chapterId: string;
  embedding: TextEmbedding;
}): Promise<fact> => {
  return await prisma.fact.create({
    data: {
      text: embedding.text,
      embedding_id: embedding.cachedEmbeddingId,
      chapter_id: chapterId,
    },
  });
};
