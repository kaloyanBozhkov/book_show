import { sleep } from "deverything";

export const retry = async <T>(
  fn: () => T,
  retries = 3,
  exponentialBackoff = false
): Promise<Awaited<T>> => {
  if (retries <= 0) {
    throw new Error("retries must be greater than 0");
  }

  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (exponentialBackoff) {
        await sleep(500 * 2 ** attempt - 500);
      }
    }
  }
  throw lastError;
};
