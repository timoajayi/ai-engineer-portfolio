"use client";

import { useEffect, useRef, useState } from "react";

type Widget = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Widget } }
let widgetScript: Promise<Widget> | undefined;

function loadWidget(): Promise<Widget> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (widgetScript) return widgetScript;
  widgetScript = new Promise<Widget>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 10_000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Verification unavailable."));
    }
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    document.head.appendChild(script);
  }).catch((error) => { widgetScript = undefined; throw error; });
  return widgetScript;
}

export default function PortfolioBotVerification({ siteKey, onProof }: {
  siteKey?: string;
  onProof: (proof: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Complete verification before sending your first message.");
  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    let widget: Widget | undefined;
    let id: string | undefined;
    void loadWidget().then((api) => {
      if (cancelled || !container.current) return;
      widget = api;
      id = api.render(container.current, {
        sitekey: siteKey, action: "portfolio_session", theme: "dark", size: "compact",
        retry: "never", "refresh-expired": "manual", "response-field": false,
        callback: (proof: unknown) => {
          if (cancelled) return;
          if (typeof proof !== "string" || !proof || proof.length > 2048 || /[^!-~]/.test(proof)) {
            onProof(null); setStatus("Verification failed. Close and reopen the assistant to try again."); return;
          }
          onProof(proof); setStatus("Verification complete. You can send your message.");
        },
        "expired-callback": () => {
          if (cancelled) return;
          onProof(null); setStatus("Verification expired. Close and reopen the assistant to verify again.");
        },
        "error-callback": () => {
          if (cancelled) return;
          onProof(null); setStatus("Verification is unavailable. Please try again later.");
        },
      });
    }).catch(() => {
      if (!cancelled) { onProof(null); setStatus("Verification is unavailable. Please try again later."); }
    });
    return () => {
      cancelled = true;
      if (widget && id !== undefined) widget.remove(id);
    };
  }, [siteKey, onProof]);
  return (
    <div className="mb-4 min-w-0 space-y-2">
      <p role="status" className="text-xs leading-5 text-zinc-400">
        {siteKey ? status : "The AI Portfolio Assistant is temporarily unavailable."}
      </p>
      <div ref={container} aria-label="Bot verification" />
    </div>
  );
}
