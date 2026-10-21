export default function Contact() {
  return (
    <section
      id="contact"
      className="border-t border-zinc-900 bg-zinc-950 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
              Contact
            </p>

            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Let&apos;s build something intelligent.
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              I&apos;m open to opportunities where I can contribute to
              practical AI systems, continue developing as an engineer, and
              work across machine learning, applied AI, and intelligent
              software.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="mailto:tajayi669@yahoo.com"
                className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
              >
                Get in touch
              </a>

              <a
                href="https://www.linkedin.com/in/timothy-ajayi-de/"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-900"
              >
                LinkedIn ↗
              </a>

              <a
                href="https://github.com/timoajayi"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-900"
              >
                GitHub ↗
              </a>
            </div>
          </div>

          <div className="border-t border-zinc-800 lg:border-l lg:border-t-0 lg:pl-12">
            <div className="border-b border-zinc-800 py-6 lg:pt-0">
              <p className="text-sm text-zinc-500">Based in</p>
              <p className="mt-2 font-medium text-white">
                Germany
              </p>
            </div>

            <div className="border-b border-zinc-800 py-6">
              <p className="text-sm text-zinc-500">Open to</p>
              <p className="mt-2 font-medium text-white">
                Junior AI Engineer · ML Engineer · Applied AI roles
              </p>
            </div>

            <div className="border-b border-zinc-800 py-6">
              <p className="text-sm text-zinc-500">Languages</p>

              <div className="mt-2 space-y-1">
                <p className="font-medium text-white">English · Fluent</p>
                <p className="text-white-400">
                  German · B2
                </p>
              </div>
            </div>

            <div className="py-6">
              <p className="text-sm text-zinc-500">Current focus</p>
              <p className="mt-2 font-medium text-white">
                LLMs · RAG · Agentic AI · MLOps
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}