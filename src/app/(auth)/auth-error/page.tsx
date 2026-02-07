import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div className="w-16 h-16 bg-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
        <p className="text-muted-foreground mb-6">
          Something went wrong during sign-in. The link may have expired or already been used.
        </p>
        <Link href="/sign-in" className="btn-brutal inline-block px-6 py-3">
          Try Again
        </Link>
      </div>
    </div>
  );
}
