"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2, Terminal } from "lucide-react";

const isDev = process.env.NODE_ENV === "development";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [devEmail, setDevEmail] = useState("dev@example.com");
  const [isLoading, setIsLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn("email", { email, callbackUrl: "/privacy" });
      setEmailSent(true);
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDevLoading(true);

    try {
      await signIn("dev-credentials", {
        email: devEmail,
        callbackUrl: "/privacy",
      });
    } catch (error) {
      console.error("Dev sign in error:", error);
    } finally {
      setIsDevLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/privacy" });
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 border-2 border-primary flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a sign-in link to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to sign in to your account.
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => setEmailSent(false)}
          >
            Use a different email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <Image src="/logo.png" alt="DPO Central" width={48} height={48} className="w-12 h-12" />
        </div>
        <CardTitle>Welcome to DPO Central</CardTitle>
        <CardDescription>
          A single source of truth for your privacy management program.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dev Login - Only in development */}
        {isDev && (
          <>
            <div className="p-4 border-2 border-primary bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Development Mode</span>
              </div>
              <form onSubmit={handleDevSignIn} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="dev-email" className="text-xs">Dev Email</Label>
                  <Input
                    id="dev-email"
                    type="email"
                    placeholder="dev@example.com"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isDevLoading}>
                  {isDevLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Terminal className="w-4 h-4 mr-2" />
                      Dev Sign In (Instant)
                    </>
                  )}
                </Button>
              </form>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or use production auth
                </span>
              </div>
            </div>
          </>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending link...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Sign in with Email
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
