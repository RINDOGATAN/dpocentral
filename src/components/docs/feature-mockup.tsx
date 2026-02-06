import { Monitor } from "lucide-react";

interface FeatureMockupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FeatureMockup({ title, description, children }: FeatureMockupProps) {
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/30">
        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">UI Preview</span>
        <span className="text-xs text-muted-foreground">—</span>
        <span className="text-xs text-muted-foreground">{title}</span>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground px-4 pt-3">{description}</p>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
