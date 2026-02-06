import { Lightbulb, AlertTriangle, Info, StickyNote } from "lucide-react";

type CalloutType = "tip" | "warning" | "info" | "note";

interface InfoCalloutProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const calloutConfig: Record<CalloutType, { icon: React.ElementType; border: string; bg: string; iconColor: string }> = {
  tip: { icon: Lightbulb, border: "border-primary", bg: "bg-primary/5", iconColor: "text-primary" },
  warning: { icon: AlertTriangle, border: "border-destructive", bg: "bg-destructive/5", iconColor: "text-destructive" },
  info: { icon: Info, border: "border-blue-500", bg: "bg-blue-500/5", iconColor: "text-blue-500" },
  note: { icon: StickyNote, border: "border-muted-foreground", bg: "bg-muted/50", iconColor: "text-muted-foreground" },
};

export function InfoCallout({ type, title, children }: InfoCalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div className={`border-l-4 ${config.border} ${config.bg} rounded-r-lg p-4`}>
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconColor}`} />
        <div className="space-y-1">
          {title && <p className="font-medium text-sm">{title}</p>}
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
