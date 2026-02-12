"use client";

import { AlertTriangle, Mail, X } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { brand } from "@/config/brand";
import { features } from "@/config/features";

interface AccessRequiredDialogProps {
  open: boolean;
  onClose: () => void;
  featureName: string;
  message?: string;
  onUpgrade?: () => void;
}

export function AccessRequiredDialog({
  open,
  onClose,
  featureName,
  message,
  onUpgrade,
}: AccessRequiredDialogProps) {
  if (!open) return null;

  const defaultMessage = `${featureName} is available as an add-on for €9/month.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <Card className="relative z-50 w-full max-w-md mx-4 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-lg">Access Required</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <CardDescription className="text-sm text-foreground/80">
            {message || defaultMessage}
          </CardDescription>

          <div className="mt-4 rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">Add-on Feature</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Enable this feature for your organization for €9/month. Cancel anytime.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {features.selfServiceUpgrade && onUpgrade ? (
            <Button onClick={onUpgrade}>
              Enable Feature
            </Button>
          ) : (
            <Button asChild>
              <a href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(brand.name + ' - Enable ' + featureName)}`}>
                <Mail className="mr-2 h-4 w-4" />
                Contact Us
              </a>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
