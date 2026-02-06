interface Step {
  title: string;
  description: string;
  content?: React.ReactNode;
}

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <div className="relative space-y-0">
      {steps.map((step, index) => (
        <div key={index} className="relative flex gap-4 pb-6 last:pb-0">
          {/* Connector line */}
          {index < steps.length - 1 && (
            <div className="absolute left-[15px] top-8 bottom-0 w-px border-l-2 border-primary/30" />
          )}
          {/* Number circle */}
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {index + 1}
          </div>
          {/* Content */}
          <div className="flex-1 pt-0.5">
            <p className="font-medium leading-7">{step.title}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
            {step.content && <div className="mt-3">{step.content}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
