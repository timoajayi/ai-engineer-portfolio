"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = process.env.NEXT_PUBLIC_AI_ASSISTANT_API_URL;

type ChatResponse = {
  answer: string;
};

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

export default function PortfolioAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages, loading]);

  async function sendMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || loading) {
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

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
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

      const data: ChatResponse = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      console.error(error);

      setError(
        "I couldn't reach the AI Portfolio Assistant. Please try again."
      );
    } finally {
      setLoading(false);
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
  }

  return (
    <section
      id="assistant"
      className="mx-auto max-w-6xl px-6 py-24"
    >
      <div className="mb-10 max-w-3xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
          AI Portfolio Assistant
        </p>

        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ask about my work.
        </h2>

        <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
          Explore my projects, technical skills, and engineering background
          through an AI assistant grounded in my portfolio.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
        {/* Assistant header */}
        <div className="border-b border-zinc-800 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-300">
                AI
              </div>

              <div>
                <h3 className="font-medium text-white">
                  Timothy&apos;s AI Assistant
                </h3>

                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Portfolio knowledge online
                </div>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={resetConversation}
                disabled={loading}
                className="text-xs text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                New conversation
              </button>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="min-h-[360px] max-h-[560px] overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex min-h-[310px] flex-col justify-center">
              <div className="max-w-2xl">
                <p className="text-lg font-medium text-zinc-100">
                  Hi, I&apos;m Timothy&apos;s AI Portfolio Assistant.
                </p>

                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Ask me about Timothy&apos;s AI projects, technical skills,
                  engineering experience, or the systems he has built.
                </p>

                <p className="mt-3 text-xs text-zinc-600">
                  Try a question below or ask your own.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    disabled={loading}
                    className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-left text-sm text-zinc-300 transition hover:border-cyan-400/50 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Conversation */
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-cyan-400 px-4 py-3 text-sm leading-6 text-zinc-950"
                        : "max-w-[85%] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-6 text-zinc-200"
                    }
                  >
                    {message.role === "assistant" ? (
                      <div className="space-y-3">
                        <ReactMarkdown>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex justify-start">
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
                  <div className="pt-2">
                    <p className="mb-3 text-xs text-zinc-600">
                      Continue exploring
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {followUpQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => void sendMessage(question)}
                          className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Auto-scroll target */}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="border-t border-red-500/20 bg-red-500/5 px-6 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Message input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-800 p-4"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about projects, skills, experience..."
              disabled={loading}
              maxLength={1000}
              className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}