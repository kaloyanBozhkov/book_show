import OpenAI from "openai";
import { env } from "../env";

let openAIInstance: OpenAI | null = null;

export const getOpenAISFWInstance = (): OpenAI => {
  if (openAIInstance === null) {
    openAIInstance = new OpenAI({
      apiKey: env.OPEN_AI_API_KEY,
    });
  }

  return openAIInstance;
};
