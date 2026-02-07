interface FlowStep {
  label: string;
  description?: string;
}

interface FlowDiagramProps {
  steps: FlowStep[];
  direction?: "horizontal" | "vertical";
}

export function FlowDiagram({
  steps,
  direction = "horizontal",
}: FlowDiagramProps) {
  if (direction === "vertical") {
    return (
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-semibold text-primary">
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px h-12 bg-primary/20" />
              )}
            </div>
            <div className="pb-12">
              <p className="text-sm font-medium text-foreground">{step.label}</p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2 min-w-0">
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-sm font-semibold text-primary">
              {i + 1}
            </div>
            <p className="text-xs font-medium text-foreground mt-2 text-center">
              {step.label}
            </p>
            {step.description && (
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                {step.description}
              </p>
            )}
          </div>
          {i < steps.length - 1 && (
            <div className="flex items-center h-10">
              <div className="w-8 h-px bg-primary/30" />
              <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-primary/30" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
