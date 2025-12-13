import { kv as vercelKv } from "@vercel/kv";

import { serverEnv } from "./env";

export const kv =
  serverEnv.KV_REST_API_URL && serverEnv.KV_REST_API_TOKEN ? vercelKv : null;
