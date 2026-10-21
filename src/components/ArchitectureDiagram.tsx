type ArchitectureDiagramProps = {
  steps: string[];
};

export default function ArchitectureDiagram({
  steps,
}: ArchitectureDiagramProps) {
  return (
    <div className="mt-8">
      <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex flex-col items-center gap-3 md:flex-row"
          >
            <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 md:w-auto">
              <p className="text-center text-sm font-medium text-zinc-200 md:whitespace-nowrap">
                {step}
              </p>
            </div>

            {index < steps.length - 1 && (
              <>
                <span
                  className="text-lg text-cyan-400 md:hidden"
                  aria-hidden="true"
                >
                  ↓
                </span>

                <span
                  className="hidden text-lg text-cyan-400 md:inline"
                  aria-hidden="true"
                >
                  →
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}