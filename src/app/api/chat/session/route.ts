import "server-only";
import { createSessionGateway, rejectSessionMethod } from "@/lib/server/session-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

export const POST = createSessionGateway({
  readEnvironment: () => ({
    CHAT_SESSION_ENABLED: process.env.CHAT_SESSION_ENABLED,
    APP_ORIGIN: process.env.APP_ORIGIN,
    AI_ASSISTANT_BACKEND_URL: process.env.AI_ASSISTANT_BACKEND_URL,
    AI_ASSISTANT_BACKEND_TOKEN: process.env.AI_ASSISTANT_BACKEND_TOKEN,
  }),
  fetch: (input, init) => fetch(input, init),
});

export const GET = rejectSessionMethod;
export const HEAD = rejectSessionMethod;
export const PUT = rejectSessionMethod;
export const PATCH = rejectSessionMethod;
export const DELETE = rejectSessionMethod;
export const OPTIONS = rejectSessionMethod;
