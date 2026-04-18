"use client";

import { AlertTriangle, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

function AuthErrorContent() {
  const t = useTranslations("auth.authErrorPage");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const isAccountNotLinked = error === "OAuthAccountNotLinked";

  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div
          className={`w-16 h-16 ${isAccountNotLinked ? "bg-amber-500/20" : "bg-destructive/20"} flex items-center justify-center mx-auto mb-6`}
        >
          {isAccountNotLinked ? (
            <Mail className="w-8 h-8 text-amber-500" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-destructive" />
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {isAccountNotLinked ? t("titleAccountExists") : t("title")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isAccountNotLinked ? t("bodyAccountExists") : t("body")}
        </p>
        <Link href="/sign-in" className="btn-brutal inline-block px-6 py-3">
          {isAccountNotLinked ? t("ctaAccountExists") : t("cta")}
        </Link>
      </div>
    </div>
  );
}

function AuthErrorFallback() {
  const t = useTranslations("auth.authErrorPage");
  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div className="w-16 h-16 bg-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("title")}</h1>
        <p className="text-muted-foreground mb-6">{t("bodyFallback")}</p>
        <Link href="/sign-in" className="btn-brutal inline-block px-6 py-3">
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<AuthErrorFallback />}>
      <AuthErrorContent />
    </Suspense>
  );
}
