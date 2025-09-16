import { prisma } from "../prisma";
import type { FactWithEmbedding } from "./types";
import type { Prisma } from "~/prisma/client";

export const getFacts = async (chapterId: string, texts?: string[]): Promise<FactWithEmbedding[]> => {
  const whereClause: Prisma.factWhereInput = {
    chapter_id: chapterId,
  };

  if (texts && texts.length > 0) {
    whereClause.text = {
      in: texts,
    };
  }

  return await prisma.fact.findMany({
    where: whereClause,
    include: {
      embedding: true,
      chapter: {
        include: {
          book: true,
        },
      },
    },
  }) as FactWithEmbedding[];
};
