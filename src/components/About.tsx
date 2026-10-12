export default function About() {
  return (
    <section
      id="about"
      className="border-t border-zinc-900 bg-zinc-950 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
            About
          </p>

          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            From engineering and operations to intelligent systems.
          </h2>
        </div>

        <div className="space-y-6 text-lg leading-8 text-zinc-400">
          <p>
            My path into AI engineering started with a broader engineering and
            operations background, where I became increasingly interested in
            building and improving systems rather than only coordinating them.
          </p>

          <p>
            I moved into AI and machine learning through an intensive AI Engineering
            bootcamp, building projects across predictive modeling, time-series
            forecasting, APIs, containerized applications, and ML infrastructure.
          </p>

          <p>
            Today, I&apos;m extending that foundation into LLMs, retrieval-augmented
            generation, and agentic AI, with a focus on systems that can use tools,
            work with real data, and solve practical problems.
          </p>
        </div>
      </div>
    </section>
  );
}