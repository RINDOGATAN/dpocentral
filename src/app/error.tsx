"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { formatUserError } from "@/lib/format-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = formatUserError(error, "An unexpected error occurred.");

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full border-destructive/30">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{message}</p>
          <div className="flex justify-center gap-3">
            <Button onClick={reset} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try again
            </Button>
            <Link href="/privacy">
              <Button>Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
