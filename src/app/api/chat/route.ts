import "server-only";
import { rejectChatMethod } from "@/lib/server/chat-gateway";
import { createVercelChatGateway } from "@/lib/server/vercel-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

export const POST = createVercelChatGateway({
  readEnvironment: () => ({
    CHAT_ENABLED: process.env.CHAT_ENABLED,
    APP_ORIGIN: process.env.APP_ORIGIN,
    AI_ASSISTANT_BACKEND_URL: process.env.AI_ASSISTANT_BACKEND_URL,
    AI_ASSISTANT_CHAT_TOKEN: process.env.AI_ASSISTANT_CHAT_TOKEN,
    AI_ASSISTANT_BACKEND_TOKEN: process.env.AI_ASSISTANT_BACKEND_TOKEN,
    GATEWAY_ASSERTION_ISSUER: process.env.GATEWAY_ASSERTION_ISSUER,
    GATEWAY_ASSERTION_AUDIENCE: process.env.GATEWAY_ASSERTION_AUDIENCE,
    GATEWAY_ASSERTION_KEY_ID: process.env.GATEWAY_ASSERTION_KEY_ID,
    GATEWAY_ASSERTION_KEY: process.env.GATEWAY_ASSERTION_KEY,
    GATEWAY_ASSERTION_KEY_NOT_BEFORE: process.env.GATEWAY_ASSERTION_KEY_NOT_BEFORE,
    GATEWAY_ASSERTION_KEY_NOT_AFTER: process.env.GATEWAY_ASSERTION_KEY_NOT_AFTER,
    GATEWAY_INGRESS_POLICY: process.env.GATEWAY_INGRESS_POLICY,
  }),
  fetch: (input, init) => fetch(input, init),
  readRuntime: () => ({ VERCEL: process.env.VERCEL, VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV }),
});

export const GET = rejectChatMethod;
export const HEAD = rejectChatMethod;
export const PUT = rejectChatMethod;
export const PATCH = rejectChatMethod;
export const DELETE = rejectChatMethod;
export const OPTIONS = rejectChatMethod;
