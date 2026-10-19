type ArchitectureDiagramProps = {
  steps: string[];
};

export default function ArchitectureDiagram({
  steps,
}: ArchitectureDiagramProps) {
  return (
    <div className="mt-8 overflow-x-auto">
      <div className="flex min-w-max items-center gap-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
              <p className="whitespace-nowrap text-sm font-medium text-zinc-200">
                {step}
              </p>
            </div>

            {index < steps.length - 1 && (
              <span className="text-lg text-cyan-400">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}