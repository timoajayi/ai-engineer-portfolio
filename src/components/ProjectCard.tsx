import type { Project } from "@/data/projects";

type ProjectCardProps = {
  project: Project;
};

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-7 transition hover:border-zinc-700 hover:bg-zinc-900/70">
      <p className="text-sm font-medium text-cyan-400">
        {project.category}
      </p>

      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        {project.title}
      </h3>

      <p className="mt-4 leading-7 text-zinc-400">
        {project.description}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {project.technologies.map((technology) => (
          <span
            key={technology}
            className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400"
          >
            {technology}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <span className="text-sm font-medium text-white transition group-hover:text-cyan-400">
          View case study →
        </span>
      </div>
    </article>
  );
}