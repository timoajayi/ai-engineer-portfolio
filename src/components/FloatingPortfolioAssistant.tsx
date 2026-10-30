"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./FloatingPortfolioAssistant.css";

const API_URL = process.env.NEXT_PUBLIC_AI_ASSISTANT_API_URL;

const REQUEST_TIMEOUT_MS = 60_000;

type Message = {
  role: "user" | "assistant";
  content: string;
};

const suggestedQuestions = [
  "What AI projects has Timothy built?",
  "What experience does Timothy have with MLOps?",
  "Has Timothy worked with RAG and agentic AI?",
];

const followUpQuestions = [
  "What experience does Timothy have with MLOps?",
  "What did Timothy build with RAG?",
  "What is Timothy currently working on?",
];

export default function FloatingPortfolioAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const assistantId = useId();
  const headingId = `${assistantId}-heading`;
  const inputId = `${assistantId}-input`;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef<{
    controller: AbortController;
    timeout: number;
  } | null>(null);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    // Reveal it before React commits the closed state so focus can return now.
    if (launcherRef.current) {
      launcherRef.current.hidden = false;
      launcherRef.current.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const request = requestRef.current;
      requestRef.current = null;
      if (request) {
        window.clearTimeout(request.timeout);
        request.controller.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const container = viewportRef.current;
    const viewport = window.visualViewport;

    function updateViewport() {
      if (!container) return;
      const height = viewport?.height ?? window.innerHeight;
      const bottom = viewport
        ? Math.max(0, window.innerHeight - height - viewport.offsetTop)
        : 0;

      container.style.setProperty("--assistant-viewport-height", `${height}px`);
      container.style.setProperty("--assistant-viewport-bottom", `${bottom}px`);
      container.style.setProperty(
        "--assistant-panel-bottom",
        height < 500 ? "1rem" : "1.5rem"
      );
    }

    updateViewport();
    window.addEventListener("resize", updateViewport);
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      container?.style.removeProperty("--assistant-viewport-height");
      container?.style.removeProperty("--assistant-viewport-bottom");
      container?.style.removeProperty("--assistant-panel-bottom");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const conversation = conversationRef.current;
    const latestMessage = latestMessageRef.current;
    if (!conversation || !latestMessage) return;

    const latestRect = latestMessage.getBoundingClientRect();
    const turnStart =
      messages[messages.length - 1]?.role === "assistant"
        ? latestMessage.previousElementSibling ?? latestMessage
        : latestMessage;
    const turnRect = turnStart.getBoundingClientRect();
    const padding = Number.parseFloat(
      window.getComputedStyle(conversation).paddingTop
    );
    const availableHeight = conversation.clientHeight - padding * 2;
    // Keep a short exchange intact; start long answers at their beginning.
    // Scrolling past the answer to its suggestions could clip the user bubble
    // into a thin cyan strip directly beneath the header.
    const target =
      latestRect.bottom - turnRect.top <= availableHeight ? turnRect : latestRect;

    conversation.scrollTo({
      top: Math.max(
        0,
        conversation.scrollTop +
          target.top -
          conversation.getBoundingClientRect().top -
          padding
      ),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [messages, loading, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Focus a non-editable element on touch devices to avoid opening a keyboard.
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      (inputRef.current?.readOnly ? headingRef.current : inputRef.current)?.focus({
        preventScroll: true,
      });
    } else {
      headingRef.current?.focus({ preventScroll: true });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.isComposing && !event.defaultPrevented) {
        event.preventDefault();
        closeAssistant();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeAssistant]);

  async function sendMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || requestRef.current) return;

    if (!API_URL) {
      setError("The AI Portfolio Assistant is temporarily unavailable.");
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: trimmedMessage,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setLoading(true);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    requestRef.current = { controller, timeout };

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("The assistant request failed.");
      }

      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("answer" in data) ||
        typeof data.answer !== "string" ||
        !data.answer.trim()
      ) {
        throw new Error("The assistant returned an invalid response.");
      }

      if (requestRef.current?.controller !== controller) return;
      if (controller.signal.aborted) throw new Error("The request was aborted.");

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch {
      if (requestRef.current?.controller !== controller) return;
      setError(
        timedOut
          ? "The assistant took too long to respond. Please try again."
          : "I couldn't reach the AI Portfolio Assistant. Please try again."
      );
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current?.controller === controller) {
        requestRef.current = null;
      }
      // Fast Refresh can restart effects while preserving loading state. Release
      // that state after cancellation, without unlocking a newer active request.
      if (mountedRef.current && !requestRef.current) {
        setLoading(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function resetConversation() {
    setMessages([]);
    setInput("");
    setError("");
    conversationRef.current?.scrollTo({ top: 0, behavior: "instant" });
    headingRef.current?.focus({ preventScroll: true });
  }

  return (
    <div
      ref={viewportRef}
      className="[--assistant-viewport-height:100vh] supports-[height:100dvh]:[--assistant-viewport-height:100dvh] [--assistant-viewport-bottom:0px] [--assistant-panel-bottom:1.5rem]"
    >
      {/* Floating chat window */}
      {isOpen && (
        <div
          id={assistantId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          className="
            fixed bottom-[calc(var(--assistant-viewport-bottom)+var(--assistant-panel-bottom)+env(safe-area-inset-bottom,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] z-[70]
            flex h-[min(640px,max(0px,calc(var(--assistant-viewport-height)-var(--assistant-panel-bottom)-env(safe-area-inset-bottom,0px)-1rem)))]
            w-[calc(100vw-2rem-env(safe-area-inset-right,0px))] max-w-[420px]
            flex-col overflow-hidden
            rounded-2xl border border-zinc-800
            bg-zinc-950 shadow-2xl
            sm:right-[calc(1.5rem+env(safe-area-inset-right,0px))]
          "
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-300">
                AI
              </div>

              <div className="min-w-0">
                <h2
                  id={headingId}
                  ref={headingRef}
                  tabIndex={-1}
                  className="truncate text-sm font-medium text-white"
                >
                  Timothy&apos;s AI Assistant
                </h2>

                <div className="mt-1 truncate text-xs text-zinc-400">
                  Ask about Timothy&apos;s portfolio
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetConversation}
                  disabled={loading}
                  className="whitespace-nowrap rounded-lg px-2 py-2 text-xs text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  New chat
                </button>
              )}

              <button
                type="button"
                onClick={closeAssistant}
                aria-label="Close AI assistant"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>

          {/* Chat area */}
          <div
            ref={conversationRef}
            role="region"
            aria-label="Scrollable assistant conversation"
            tabIndex={0}
            className="portfolio-assistant-scrollable min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-400/60 sm:px-5"
          >
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col justify-center">
                <p className="text-base font-medium text-zinc-100">
                  Hi, I&apos;m Timothy&apos;s AI Portfolio Assistant.
                </p>

                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Ask me about Timothy&apos;s AI projects, technical skills,
                  engineering experience, or the systems he has built.
                </p>

                <p className="mt-4 text-xs text-zinc-400">
                  Try a question
                </p>

                <div className="mt-3 flex flex-col gap-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void sendMessage(question)}
                      disabled={loading}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left text-sm leading-5 text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-5">
              <div
                role="log"
                aria-label="Conversation with Timothy's AI assistant"
                aria-relevant="additions"
                className="space-y-5"
              >
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    ref={index === messages.length - 1 ? latestMessageRef : null}
                    className={
                      message.role === "user"
                        ? "flex min-w-0 justify-end"
                        : "flex min-w-0 justify-start"
                    }
                  >
                    <div
                      className={
                        message.role === "user"
                          ? "min-w-0 max-w-[88%] [overflow-wrap:anywhere] rounded-2xl rounded-br-md bg-cyan-400 px-4 py-3 text-sm leading-6 text-zinc-950"
                          : "min-w-0 w-full max-w-full [overflow-wrap:anywhere] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-6 text-zinc-200"
                      }
                    >
                      <span className="sr-only">
                        {message.role === "user" ? "You: " : "Assistant: "}
                      </span>
                      {message.role === "assistant" ? (
                        <div className="portfolio-assistant-markdown">
                          <ReactMarkdown
                            components={{
                              pre: ({ children }) => (
                                <pre
                                  tabIndex={0}
                                  role="region"
                                  aria-label="Code block"
                                  className="portfolio-assistant-scrollable portfolio-assistant-code focus-visible:outline-2 focus-visible:outline-cyan-400/60"
                                >
                                  {children}
                                </pre>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Loading indicator */}
              {loading && (
                <div aria-hidden="true" className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-4">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              {/* Follow-up suggestions */}
              {!loading &&
                messages[messages.length - 1]?.role === "assistant" && (
                  <div className="pt-1">
                    <p className="mb-2 text-xs text-zinc-400">
                      Continue exploring
                    </p>

                    <div className="flex flex-col gap-2">
                      {followUpQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => void sendMessage(question)}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs leading-5 text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>

          <div role="status" className="sr-only">
            {loading ? "Assistant is responding." : ""}
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="portfolio-assistant-scrollable max-h-[25%] shrink-0 overflow-y-auto border-t border-red-500/20 bg-red-500/5 px-5 py-3 text-xs text-red-300"
            >
              {error}
            </div>
          )}

          {/* Message input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-zinc-800 p-3"
          >
            <label htmlFor={inputId} className="sr-only">
              Message Timothy&apos;s AI assistant
            </label>
            <div className="flex gap-2">
              <input
                id={inputId}
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about Timothy..."
                readOnly={loading}
                maxLength={1000}
                className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-400 focus:border-cyan-400/60 read-only:cursor-not-allowed read-only:opacity-60 sm:text-sm"
              />

              <button
                type="submit"
                aria-label="Send message"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating AI launcher */}
      <button
        ref={launcherRef}
        hidden={isOpen}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={
          isOpen
            ? "Close AI Portfolio Assistant"
            : "Open AI Portfolio Assistant"
        }
        aria-expanded={isOpen}
        aria-controls={assistantId}
        aria-haspopup="dialog"
        className="
          fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] z-[70]
          flex h-14 items-center gap-3
          rounded-full border border-cyan-400/30
          bg-zinc-950 px-4
          text-sm font-medium text-white
          shadow-2xl transition
          hover:border-cyan-400/60 hover:bg-zinc-900
          sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:right-[calc(1.5rem+env(safe-area-inset-right,0px))]
        "
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-zinc-950">
          AI
        </span>

        <span className="hidden sm:inline">
          {isOpen ? "Close Assistant" : "Ask Timothy's AI"}
        </span>
      </button>
    </div>
  );
}
