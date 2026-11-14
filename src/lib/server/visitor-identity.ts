import "server-only";
import { canonicalVisitorIP } from "./gateway-assertions";

export type VisitorIdentityContext = Readonly<{
  requestId: string;
  origin: string;
  method: "POST";
  path: "/api/chat";
  sessionSHA256: string;
  bodySHA256: string;
}>;
export type VisitorIdentityEvidence = Readonly<{
  visitorIP: string;
  ingressPolicy: string;
  evidenceId: string;
  requestId: string;
}>;

/** Trusted SERVER composition only. No production implementation or environment
 * selector exists. Subclasses must independently verify ingress evidence; neither
 * browser headers nor signing an address establishes provenance. */
export abstract class TrustedVisitorIdentityProvider {
  #policy: string;
  constructor(approvedPolicy: string) {
    if (typeof approvedPolicy !== "string" ||
      approvedPolicy.match(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/)?.[0] !== approvedPolicy) throw new Error("Identity unavailable.");
    this.#policy = approvedPolicy;
  }
  protected abstract resolveEvidence(context: VisitorIdentityContext): Promise<VisitorIdentityEvidence | null>;

  async authorizedIdentity(context: VisitorIdentityContext, expectedPolicy: string): Promise<VisitorIdentityEvidence> {
    if (this.#policy !== expectedPolicy || !Object.isFrozen(context)) throw new Error("Identity unavailable.");
    const evidence = await this.resolveEvidence(context);
    if (!evidence || Object.keys(evidence).length !== 4 ||
      evidence.ingressPolicy !== expectedPolicy || evidence.requestId !== context.requestId ||
      typeof evidence.visitorIP !== "string" || canonicalVisitorIP(evidence.visitorIP) !== evidence.visitorIP ||
      typeof evidence.evidenceId !== "string" ||
      evidence.evidenceId.match(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)?.[0] !== evidence.evidenceId) {
      throw new Error("Identity unavailable.");
    }
    // Snapshot evidence. No raw Request, Cookie or forwarding headers are given
    // to a provider. Future hosting-specific adapters need a separately reviewed
    // trusted evidence source bound to this server-generated request context.
    return Object.freeze({ visitorIP: evidence.visitorIP, ingressPolicy: evidence.ingressPolicy,
      requestId: evidence.requestId, evidenceId: evidence.evidenceId });
  }
}
