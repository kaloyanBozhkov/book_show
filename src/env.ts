import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

export const env = createEnv({
  server: {
    // Server
    PORT: z.coerce
      .number()
      .default(3000)
      .describe("Port for the server to run on"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development")
      .describe("Node environment"),

    // CORS
    CORS_ORIGIN: z
      .string()
      .url()
      .default("http://localhost:8081")
      .describe("CORS origin URL"),

    // OpenAI
    OPEN_AI_API_KEY: z.string().describe("OpenAI API key"),
    OPENROUTER_API_KEY: z.string().describe("OpenRouter API key"),
  },

  /**
   * What object holds the environment variables at runtime.
   * Often `process.env` or `import.meta.env`
   */
  runtimeEnv: process.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
});
