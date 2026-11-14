import "server-only";
import { createChatGateway, rejectChatMethod } from "@/lib/server/chat-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

export const POST = createChatGateway({
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
  // No production identity provider exists. No environment variable selects one.
  // Trusted composition is a separate hosting-dependent implementation phase.
});

export const GET = rejectChatMethod;
export const HEAD = rejectChatMethod;
export const PUT = rejectChatMethod;
export const PATCH = rejectChatMethod;
export const DELETE = rejectChatMethod;
export const OPTIONS = rejectChatMethod;
