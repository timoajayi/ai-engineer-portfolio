"use client";

import { Fragment, type FormEvent, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import "./EngineeringTerminal.css";

type TerminalProject = {
  title: string;
  slug: string;
};

const commands = {
  help: "Show available commands",
  whoami: "Meet Timothy and explore his focus",
  projects: "Browse engineering projects",
  skills: "Explore technical skills",
  contact: "Find email and social links",
  clear: "Reset the terminal",
} as const;

type Command = keyof typeof commands;
type HistoryEntry = {
  id: number;
  input: string;
  command: Command | null;
};

const MAX_HISTORY = 20;
const shortcuts = ["help", "projects", "skills", "contact"] as const;
const skillGroups = [
  { title: "AI & ML", skills: "Python, Scikit-learn, XGBoost, Time Series" },
  { title: "Generative AI", skills: "LLMs, RAG, LangGraph, Tool Calling" },
  { title: "Backend & Data", skills: "FastAPI, PostgreSQL, SQL, dbt" },
  { title: "MLOps", skills: "Docker, MLflow, Prefect, CI/CD" },
];
// These public links match the existing Contact section.
const contactLinks = [
  {
    label: "tajayi669@yahoo.com",
    href: "mailto:tajayi669@yahoo.com",
    external: false,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/timothy-ajayi-de/",
    external: true,
  },
  { label: "GitHub", href: "https://github.com/timoajayi", external: true },
];

const linkClassName =
  "rounded-sm text-cyan-300 underline decoration-cyan-400/40 underline-offset-4 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export default function EngineeringTerminal({
  projects,
}: {
  projects: TerminalProject[];
}) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState("");
  const terminalId = useId();
  const outputRef = useRef<HTMLDivElement | null>(null);
  const latestEntryRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) return;
    const padding = Number.parseFloat(window.getComputedStyle(output).paddingTop);
    // Scroll only the terminal, leaving the Hero and the reader's page position intact.
    output.scrollTo({
      top: Math.max(0, (latestEntryRef.current?.offsetTop ?? padding) - padding),
      behavior: "instant",
    });
  }, [history]);

  function runCommand(value: string) {
    const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
    if (!normalized) return;

    const command = Object.hasOwn(commands, normalized)
      ? (normalized as Command)
      : null;
    setInput("");
    setStatus("");

    if (command === "clear") {
      setHistory([]);
      setStatus("Terminal cleared.");
      return;
    }

    const entry: HistoryEntry = {
      id: nextIdRef.current++,
      input: normalized,
      command,
    };
    setHistory((current) => [...current.slice(-(MAX_HISTORY - 1)), entry]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runCommand(input);
  }

  function renderResponse(command: Command | null) {
    switch (command) {
      case "help":
        return (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            {Object.entries(commands).map(([name, description]) => (
              <Fragment key={name}>
                <dt className="text-cyan-300">{name}</dt>
                <dd>{description}</dd>
              </Fragment>
            ))}
          </dl>
        );
      case "whoami":
        return (
          <div className="space-y-2">
            <p className="font-medium text-zinc-100">
              Timothy Ajayi — AI Engineer based in Germany.
            </p>
            <p>Building practical AI systems from models to production.</p>
            <p>Current focus: LLMs, RAG, agentic AI, and MLOps.</p>
          </div>
        );
      case "projects":
        return (
          <ul className="space-y-2">
            {projects.map((project) => (
              <li key={project.slug}>
                <Link href={`/projects/${project.slug}`} className={linkClassName}>
                  {project.title}
                </Link>
              </li>
            ))}
          </ul>
        );
      case "skills":
        return (
          <dl className="space-y-2">
            {skillGroups.map((group) => (
              <div key={group.title}>
                <dt className="font-medium text-zinc-100">{group.title}</dt>
                <dd>{group.skills}</dd>
              </div>
            ))}
          </dl>
        );
      case "contact":
        return (
          <ul className="space-y-2">
            {contactLinks.map((contact) => (
              <li key={contact.href}>
                <a
                  href={contact.href}
                  className={linkClassName}
                  target={contact.external ? "_blank" : undefined}
                  rel={contact.external ? "noopener noreferrer" : undefined}
                >
                  {contact.label}
                  {contact.external && (
                    <span className="sr-only"> (opens in a new tab)</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        );
      default:
        return (
          <p>
            Unknown command. Type <span className="text-cyan-300">help</span> to
            see the available commands.
          </p>
        );
    }
  }

  return (
    <section
      aria-labelledby={`${terminalId}-title`}
      className="w-full min-w-0 max-w-xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 font-mono text-sm leading-6 text-zinc-300 [overflow-wrap:anywhere]"
    >
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-600" />
          <span className="h-2 w-2 rounded-full bg-zinc-500" />
          <span className="h-2 w-2 rounded-full bg-cyan-400/60" />
        </div>
        <h3 id={`${terminalId}-title`} className="min-w-0 text-xs text-zinc-400 sm:text-sm">
          <span className="sr-only">Engineering terminal: </span>timothy@portfolio:~
        </h3>
      </div>

      <div
        ref={outputRef}
        role="region"
        aria-label="Scrollable engineering terminal output"
        tabIndex={0}
        className="engineering-terminal-output relative h-40 overflow-y-auto overscroll-contain bg-zinc-950/60 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300 sm:h-44"
      >
        <div className="space-y-1">
          <p className="font-medium text-zinc-100">Timothy Ajayi · AI Engineer</p>
          <p className="text-xs text-zinc-400">Type help, or choose a command below.</p>
        </div>
        <div
          role="log"
          aria-label="Engineering terminal command responses"
          aria-relevant="additions"
          className="mt-4 space-y-4"
        >
          {history.map((entry, index) => (
            <div
              key={entry.id}
              ref={index === history.length - 1 ? latestEntryRef : null}
              className="space-y-2"
            >
              <p className="text-zinc-400">
                <span aria-hidden="true" className="mr-2 text-cyan-300">›</span>
                <span className="sr-only">Command: </span>
                {entry.input}
              </p>
              {renderResponse(entry.command)}
            </div>
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="Command shortcuts"
        className="flex flex-wrap gap-1 border-t border-zinc-800 px-3 py-2"
      >
        {shortcuts.map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => runCommand(command)}
            aria-label={`Run ${command} command`}
            className="min-h-11 min-w-11 rounded-lg px-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 motion-safe:transition-colors sm:min-h-9 sm:px-3"
          >
            {command}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex min-w-0 items-center gap-2 border-t border-zinc-800 p-3"
      >
        <label htmlFor={`${terminalId}-input`} className="sr-only">
          Engineering terminal command
        </label>
        <span aria-hidden="true" className="text-cyan-300">›</span>
        <input
          id={`${terminalId}-input`}
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.nativeEvent.isComposing) {
              event.preventDefault();
            }
          }}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={120}
          placeholder="Type a command…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="min-h-11 shrink-0 rounded-lg bg-cyan-400 px-3 text-sm font-medium text-zinc-950 hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 motion-safe:transition-colors"
        >
          Run
        </button>
      </form>
      <p role="status" className="sr-only">{status}</p>
    </section>
  );
}
