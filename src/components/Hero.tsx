export default function Hero() {
  return (
    <section className="mx-auto flex min-h-screen max-w-7xl items-center px-6 pt-24 lg:px-8">
      <div className="max-w-4xl">
        <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
          AI Engineer
        </p>

        <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Timothy Ajayi
        </h1>

        <h2 className="mt-6 max-w-4xl text-3xl font-medium leading-tight text-zinc-300 sm:text-4xl lg:text-5xl">
          Building intelligent systems from models to production.
        </h2>

        <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
          I build practical AI systems combining machine learning, LLMs,
          agentic workflows, APIs, and production-focused engineering.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
          <span>Machine Learning</span>
          <span>LLMs</span>
          <span>Agentic AI</span>
          <span>MLOps</span>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#projects"
            className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
          >
            View Projects
          </a>

          <a
            href="#contact"
            className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Contact Me
          </a>
        </div>
      </div>
    </section>
  );
}