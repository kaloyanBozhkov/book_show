import z from "zod";
import { jsonrepair } from "jsonrepair";
import { getOpenAISFWInstance } from "./openai";

export const getLLMResponse = async <ResponseType>({
  userMessage,
  systemMessage,
  schema,
}: {
  userMessage: string | string[];
  systemMessage: string;
  schema: z.ZodSchema<ResponseType>;
}): Promise<ResponseType> => {
  const openai = getOpenAISFWInstance();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemMessage },
      ...(Array.isArray(userMessage)
        ? userMessage.map((message) => ({
            role: "user" as const,
            content: message,
          }))
        : [{ role: "user" as const, content: userMessage }]),
    ],
  });
  const responseText = response.choices[0].message.content;
  if (!responseText) {
    throw new Error("No response from LLM");
  }
  console.log("response before parsing", responseText);
  const parsedResponse = schema.parse(JSON.parse(jsonrepair(responseText)));
  return parsedResponse;
};
