"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The parts the welcome card and the Settings card share: the three answers
 * to the safeguards question, and the short request form for answers b and c
 * (src/server/services/safeguards).
 */

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export type AnswerChoice = "shared_eu" | "managed" | "own_hardware";
export type RequestChoice = "managed" | "own_hardware";
export const ANSWER_CHOICES: readonly AnswerChoice[] = ["shared_eu", "managed", "own_hardware"];
const USER_COUNT_BANDS = ["1-5", "6-25", "26+"] as const;
type UserCountBand = (typeof USER_COUNT_BANDS)[number];

export function isRequestChoice(choice: string | null | undefined): choice is RequestChoice {
  return choice === "managed" || choice === "own_hardware";
}

/** The three answers as radio buttons (arrow keys move between them). */
export function SafeguardsChoiceList({
  value,
  onChange,
  disabled,
  legend,
}: {
  value: AnswerChoice | null;
  onChange: (choice: AnswerChoice) => void;
  disabled?: boolean;
  legend: string;
}) {
  const t = useTranslations("safeguards.choices");
  const name = useId();
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium mb-2">{legend}</legend>
      {ANSWER_CHOICES.map((choice) => {
        const id = `${name}-${choice}`;
        const selected = value === choice;
        return (
          <label
            key={choice}
            htmlFor={id}
            className={cn(
              "flex gap-3 rounded-md border p-3 cursor-pointer transition-colors",
              "focus-within:ring-2 focus-within:ring-ring",
              selected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={choice}
              checked={selected}
              onChange={() => onChange(choice)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 space-y-1">
              <span className="block text-sm font-medium">{t(`${choice}.title`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`${choice}.description`)}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export interface RequestDetails {
  name: string;
  email: string;
  organizationName: string;
  country: string;
  userCount: UserCountBand;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The short form for answers b and c. */
export function SafeguardsRequestForm({
  prefill,
  pending,
  error,
  onSubmit,
  onNotNow,
  autoFocus,
}: {
  prefill: { name: string; email: string; organizationName: string };
  pending: boolean;
  error: string | null;
  onSubmit: (details: RequestDetails) => void;
  onNotNow: () => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations("safeguards.form");
  const base = useId();
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [organizationName, setOrganizationName] = useState(prefill.organizationName);
  const [country, setCountry] = useState("");
  const [userCount, setUserCount] = useState<UserCountBand | null>(null);
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      !EMAIL_RE.test(email.trim()) ||
      !organizationName.trim() ||
      !country.trim() ||
      !userCount
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      organizationName: organizationName.trim(),
      country: country.trim(),
      userCount,
      message: message.trim() || undefined,
    });
  };

  const shown = invalid ? t("required") : error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${base}-name`}>{t("name")}</Label>
        <Input
          id={`${base}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={200}
          required
          autoFocus={autoFocus}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${base}-email`}>{t("email")}</Label>
        <Input
          id={`${base}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          maxLength={320}
          required
          aria-describedby={prefill.email ? `${base}-email-hint` : undefined}
        />
        {prefill.email && (
          <p id={`${base}-email-hint`} className="text-xs text-muted-foreground">
            {t("emailHint")}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${base}-org`}>{t("organization")}</Label>
          <Input
            id={`${base}-org`}
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            autoComplete="organization"
            maxLength={200}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${base}-country`}>{t("country")}</Label>
          <Input
            id={`${base}-country`}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            autoComplete="country-name"
            maxLength={100}
            required
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">{t("userCount")}</legend>
        <div className="flex flex-wrap gap-2">
          {USER_COUNT_BANDS.map((band) => {
            const id = `${base}-users-${band}`;
            return (
              <label
                key={band}
                htmlFor={id}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer focus-within:ring-2 focus-within:ring-ring",
                  userCount === band ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                )}
              >
                <input
                  id={id}
                  type="radio"
                  name={`${base}-users`}
                  value={band}
                  checked={userCount === band}
                  onChange={() => setUserCount(band)}
                  className="h-4 w-4 accent-primary"
                />
                {t(`userCountOptions.${band}`)}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`${base}-message`}>{t("message")}</Label>
        <Textarea
          id={`${base}-message`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>

      {shown && (
        <p role="alert" className="text-sm text-destructive">
          {shown}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button type="button" variant="ghost" onClick={onNotNow} disabled={pending}>
          {t("notNow")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {t("send")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("privacyNote")}{" "}
        <a
          href={brand.privacyPolicyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {t("privacyLink")}
        </a>
        .
      </p>
    </form>
  );
}
