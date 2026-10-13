const journey = [
  {
    period: "Current Focus",
    title: "AI Engineering & Applied AI",
    description:
      "Building portfolio projects across machine learning, LLM applications, RAG, agentic AI, APIs, and production-oriented AI engineering.",
  },
  {
    period: "AI Engineering",
    title: "Data Science & ML Engineering",
    description:
      "Completed intensive hands-on training covering machine learning, deep learning, time-series forecasting, data engineering, APIs, Docker, MLOps, and end-to-end AI applications.",
  },
  {
    period: "Professional Experience",
    title: "Project Management & Operations",
    description:
      "Worked in operational and project environments where I developed experience coordinating complex workflows, improving processes, and working across teams.",
  },
  {
    period: "Engineering Foundation",
    title: "Mechanical Engineering",
    description:
      "Built my technical foundation through mechanical engineering studies and practical experience in aircraft maintenance and automotive environments.",
  },
];

export default function Experience() {
  return (
    <section
      id="experience"
      className="border-t border-zinc-900 bg-zinc-950 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
            Journey
          </p>

          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            An engineering path into AI.
          </h2>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            A progression from engineering and operations into machine learning
            and the development of practical AI systems.
          </p>
        </div>

        <div className="mt-14 border-t border-zinc-800">
          {journey.map((item) => (
            <div
              key={`${item.period}-${item.title}`}
              className="grid gap-4 border-b border-zinc-800 py-8 md:grid-cols-[0.35fr_0.65fr] md:gap-12"
            >
              <p className="text-sm font-medium text-cyan-400">
                {item.period}
              </p>

              <div>
                <h3 className="text-xl font-semibold text-white">
                  {item.title}
                </h3>

                <p className="mt-3 max-w-3xl leading-7 text-zinc-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
