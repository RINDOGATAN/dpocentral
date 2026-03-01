"use client";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/currency";

export function PremiumBadge() {
  return (
    <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
      {formatPrice(9)}/mo
    </Badge>
  );
}
