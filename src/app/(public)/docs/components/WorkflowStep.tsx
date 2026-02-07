interface WorkflowStepProps {
  number: number;
  title: string;
  description: string;
  actor?: string;
  details?: string[];
}

export function WorkflowStep({
  number,
  title,
  description,
  actor,
  details,
}: WorkflowStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
          {number}
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {actor && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
              {actor}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {details && details.length > 0 && (
          <ul className="mt-2 space-y-1">
            {details.map((detail, i) => (
              <li
                key={i}
                className="text-sm text-muted-foreground flex items-start gap-2"
              >
                <span className="text-primary mt-1.5 text-[6px]">&bull;</span>
                {detail}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
