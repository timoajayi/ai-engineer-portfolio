import "server-only";
import { createChatGateway } from "./chat-gateway";
import { canonicalVisitorIP } from "./gateway-assertions";
import { TrustedVisitorIdentityProvider, VisitorIdentityContext } from "./visitor-identity";

export const VERCEL_INGRESS_POLICY = "vercel-direct-v1";
type Dependencies = Omit<Parameters<typeof createChatGateway>[0], "identityProvider"> & {
  readRuntime: () => { VERCEL?: string; VERCEL_ENV?: string; NODE_ENV?: string };
};

/** Valid only inside a directly served Vercel production Function. Runtime
 * attestation comes from server environment, NEVER an HTTP header. Vercel's
 * documented overwritten ingress header supplies the IP; there is no fallback.
 * https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
 */
export function createVercelChatGateway(dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const environment = dependencies.readEnvironment();
    const unavailable = createChatGateway({ ...dependencies, readEnvironment: () => environment });
    if (request.method !== "POST" || environment.CHAT_ENABLED !== "true") return unavailable(request);
    const runtime = dependencies.readRuntime();
    if (runtime.VERCEL !== "1" || runtime.VERCEL_ENV !== "production" || runtime.NODE_ENV !== "production" ||
      environment.GATEWAY_INGRESS_POLICY !== VERCEL_INGRESS_POLICY) return unavailable(request);
    try {
      // Preserve the generic gateway's original ingress bounds, including the
      // transport headers that are about to be removed.
      let bytes = 0, count = 0;
      for (const [name, value] of request.headers) { bytes += name.length + value.length; count++; }
      if (bytes > 8192 || count > 32) throw new Error();
      const raw = request.headers.get("x-vercel-forwarded-for");
      if (!raw || raw !== raw.trim()) throw new Error();
      const address = canonicalVisitorIP(raw);
      // These aliases are documented as identical at direct Vercel ingress.
      // Conflicts/lists are rejected, never used to override the dedicated field.
      for (const name of ["x-forwarded-for", "x-real-ip"]) {
        const value = request.headers.get(name);
        if (value !== null && (value !== value.trim() || canonicalVisitorIP(value) !== address)) throw new Error();
      }
      const headers = new Headers(request.headers);
      // Do not pass proxy metadata to the generic gateway or use Forwarded as
      // identity. It may be emitted by the platform but has no authority here.
      for (const name of ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip", "forwarded"]) headers.delete(name);
      class VercelIdentity extends TrustedVisitorIdentityProvider {
        constructor() { super(VERCEL_INGRESS_POLICY); }
        protected async resolveEvidence(context: VisitorIdentityContext) {
          return { visitorIP: address, ingressPolicy: VERCEL_INGRESS_POLICY,
            requestId: context.requestId, evidenceId: context.requestId };
        }
      }
      return createChatGateway({ ...dependencies, readEnvironment: () => environment,
        identityProvider: new VercelIdentity() })(new Request(request, { headers }));
    } catch {
      return Response.json({ detail: "The AI assistant is temporarily unavailable." }, {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }
  };
}
