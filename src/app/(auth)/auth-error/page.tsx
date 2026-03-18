"use client";

import { AlertTriangle, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const isAccountNotLinked = error === "OAuthAccountNotLinked";

  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div className={`w-16 h-16 ${isAccountNotLinked ? "bg-amber-500/20" : "bg-destructive/20"} flex items-center justify-center mx-auto mb-6`}>
          {isAccountNotLinked ? (
            <Mail className="w-8 h-8 text-amber-500" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-destructive" />
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {isAccountNotLinked ? "Account Already Exists" : "Authentication Error"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isAccountNotLinked
            ? "An account with this email already exists using a different sign-in method. Please sign in using your original method (email magic link or Google) to access your account."
            : "Something went wrong during sign-in. The link may have expired or already been used."}
        </p>
        <Link href="/sign-in" className="btn-brutal inline-block px-6 py-3">
          {isAccountNotLinked ? "Sign In with Original Method" : "Try Again"}
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="card-brutal text-center">
            <div className="w-16 h-16 bg-destructive/20 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
            <p className="text-muted-foreground mb-6">
              Something went wrong during sign-in.
            </p>
            <Link href="/sign-in" className="btn-brutal inline-block px-6 py-3">
              Try Again
            </Link>
          </div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
