import OpenAI from "openai";
import { env } from "../env";

let openRouterInstance: OpenAI | null = null;

export const getOpenRouterInstance = (): OpenAI => {
  if (openRouterInstance === null) {
    openRouterInstance = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }

  return openRouterInstance;
};
