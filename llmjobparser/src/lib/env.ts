import { z } from "zod";

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),

    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_BASE_URL: z.string().url().optional(),

    POSTGRES_URL: z.string().url().optional(),

    KV_REST_API_URL: z.string().url().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
  })
  .passthrough();

export const serverEnv = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,

  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || undefined,
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || undefined,

  POSTGRES_URL: process.env.POSTGRES_URL || undefined,

  KV_REST_API_URL: process.env.KV_REST_API_URL || undefined,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN || undefined,
});
