"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function VerifyRequestPage() {
  const t = useTranslations("auth");
  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("checkEmail")}</h1>
        <p className="text-muted-foreground mb-6">{t("verifyRequestPage.body")}</p>
        <p className="text-sm text-muted-foreground">
          {t("didntReceive")}{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            {t("tryAgain")}
          </Link>
        </p>
      </div>
    </div>
  );
}
