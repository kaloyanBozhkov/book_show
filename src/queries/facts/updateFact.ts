import { prisma } from "../prisma";
import { TextEmbedding } from "../../ai/embeddings";
import type { fact } from "~/prisma/client";

export const updateFactQuery = async ({
  factId,
  chapterId,
  text,
  embedding,
}: {
  factId: string;
  chapterId: string;
  text: string;
  embedding: TextEmbedding;
}): Promise<fact> => {
  return await prisma.fact.update({
    where: {
      id: factId,
      chapter_id: chapterId,
    },
    data: {
      text,
      embedding_id: embedding.cachedEmbeddingId,
    },
  });
};
