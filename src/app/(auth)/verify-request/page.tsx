import { Mail } from "lucide-react";
import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-muted-foreground mb-6">
          A sign-in link has been sent to your email address. Click the link to sign in.
        </p>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive it?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Try again
          </Link>
        </p>
      </div>
    </div>
  );
}
