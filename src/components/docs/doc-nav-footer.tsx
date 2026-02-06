import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavLink {
  title: string;
  href: string;
}

interface DocNavFooterProps {
  previous?: NavLink;
  next?: NavLink;
}

export function DocNavFooter({ previous, next }: DocNavFooterProps) {
  return (
    <div className="flex items-center justify-between border-t pt-6 mt-10">
      {previous ? (
        <Button variant="ghost" asChild>
          <Link href={previous.href} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            {previous.title}
          </Link>
        </Button>
      ) : (
        <div />
      )}
      {next ? (
        <Button variant="ghost" asChild>
          <Link href={next.href} className="gap-2">
            {next.title}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}
