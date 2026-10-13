import { notFound } from "next/navigation";
import { projects } from "@/data/projects";

type ProjectPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;

  const project = projects.find((project) => project.slug === slug);

  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-24 text-white">
      <div className="mx-auto max-w-7xl">

        {/* Project category */}
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
          {project.category}
        </p>

        {/* Project status */}
        <div className="mt-5">
          <span className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400">
            {project.status === "completed"
              ? "Completed"
              : "In Development"}
          </span>
        </div>

        {/* Project title */}
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {project.title}
        </h1>

        {/* Project description */}
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">
          {project.description}
        </p>

        {/* Technology stack */}
        <div className="mt-8 flex flex-wrap gap-2">
          {project.technologies.map((technology) => (
            <span
              key={technology}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400"
            >
              {technology}
            </span>
          ))}
        </div>

        {/* Problem and Solution */}
        <div className="mt-16 grid gap-12 border-t border-zinc-800 pt-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
              Problem
            </p>

            <p className="mt-5 text-lg leading-8 text-zinc-300">
              {project.problem}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
              Solution
            </p>

            <p className="mt-5 text-lg leading-8 text-zinc-300">
              {project.solution}
            </p>
          </div>
        </div>

        {/* Architecture */}
        {project.architecture && (
          <section className="mt-16 border-t border-zinc-800 pt-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
              Architecture
            </p>

            <p className="mt-5 max-w-4xl text-lg leading-8 text-zinc-300">
              {project.architecture}
            </p>
          </section>
        )}

        {/* My Contribution */}
        {project.contributions && (
          <section className="mt-16 border-t border-zinc-800 pt-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
              My Contribution
            </p>

            <ul className="mt-6 max-w-4xl space-y-4">
              {project.contributions.map((contribution) => (
                <li
                  key={contribution}
                  className="flex gap-4 text-lg leading-8 text-zinc-300"
                >
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  <span>{contribution}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Results */}
        {project.results && (
          <section className="mt-16 border-t border-zinc-800 pt-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
              Results
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {project.results.map((result) => (
                <div
                  key={result.label}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6"
                >
                  <p className="text-3xl font-semibold tracking-tight text-white">
                    {result.value}
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    {result.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}