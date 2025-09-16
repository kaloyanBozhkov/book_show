import { prisma } from "../prisma";
import type { fact } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const deleteFactQuery = async ({
  factId,
  chapterId,
}: {
  factId: string;
  chapterId: string;
}): Promise<fact> => {
  return await prisma.fact.delete({
    where: {
      id: factId,
      chapter_id: chapterId,
    },
  });
};

export const deleteAllFactsQuery = async ({
  chapterId,
}: {
  chapterId: string;
}): Promise<Prisma.BatchPayload> => {
  return await prisma.fact.deleteMany({
    where: {
      chapter_id: chapterId,
    },
  });
};
