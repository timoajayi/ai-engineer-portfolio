import ProjectCard from "@/components/ProjectCard";
import { projects } from "@/data/projects";

export default function FeaturedProjects() {
  const featuredProjects = projects.filter((project) => project.featured);

  return (
    <section
      id="projects"
      className="border-t border-zinc-900 bg-zinc-950 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
            Selected Work
          </p>

          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Featured Projects
          </h2>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            A selection of AI and machine learning systems built around
            practical problems, production-oriented engineering, and
            end-to-end implementation.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {featuredProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}