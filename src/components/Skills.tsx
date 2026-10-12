const skillGroups = [
  {
    title: "AI & Machine Learning",
    skills: [
      "Python",
      "Scikit-learn",
      "XGBoost",
      "LightGBM",
      "TensorFlow",
      "Time Series",
    ],
  },
  {
    title: "Generative AI",
    skills: [
      "LLMs",
      "RAG",
      "Agentic AI",
      "Prompt Engineering",
      "LangGraph",
      "Tool Calling",
    ],
  },
  {
    title: "Backend & Data",
    skills: [
      "FastAPI",
      "PostgreSQL",
      "SQL",
      "REST APIs",
      "Pandas",
      "dbt",
    ],
  },
  {
    title: "MLOps & Infrastructure",
    skills: [
      "Docker",
      "MLflow",
      "Prefect",
      "DVC",
      "Git",
      "CI/CD",
      "Prometheus",
      "Grafana",
    ],
  },
];

export default function Skills() {
  return (
    <section
      id="skills"
      className="border-t border-zinc-900 bg-zinc-950 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
            Technical Skills
          </p>

          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Tools I use to build AI systems.
          </h2>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            From model development and LLM applications to APIs, data
            infrastructure, and production-oriented ML workflows.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {skillGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6"
            >
              <h3 className="text-lg font-semibold text-white">
                {group.title}
              </h3>

              <div className="mt-5 flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}